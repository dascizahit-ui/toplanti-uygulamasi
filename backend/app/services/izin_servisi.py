"""
İzin Servisi
============
Toplantı içi izin yönetimi: mikrofon, kamera, ekran paylaşımı,
sohbet izinleri ve rol ataması.

Bu servis toplantı güvenliğinin temel taşıdır.
Admin/moderatör, katılımcıların medya erişimlerini kontrol eder.
"""

import uuid
from typing import Optional

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.hata_yonetimi import (
    BulunamadiHatasi,
    YetkisizErisimHatasi,
    UygulamaHatasi,
)
from app.core.redis import oda_durumu_kaydet, oda_durumu_getir
from app.models.kullanici import Kullanici, KullaniciRolu
from app.models.toplanti import (
    Toplanti,
    ToplantiKatilimci,
    KatilimciRolu,
)
from app.schemas.toplanti import KatilimciIzinGuncelle, KatilimciYanit
from app.services.redis_servisi import RedisServisi


class IzinServisi:
    """
    Toplantı içi izin ve rol yönetim servisi.
    
    İzin Hiyerarşisi:
        SAHIP > MODERATOR > KATILIMCI > IZLEYICI
        
    Kurallar:
        - Sahip: Her şeyi yapabilir, atılamaz
        - Moderatör: Katılımcı izinlerini yönetebilir
        - Katılımcı: Sadece izin verilen medyaları kullanabilir
        - İzleyici: Hiçbir medya izni yok, sadece izleyebilir
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.redis = RedisServisi()

    # =====================
    # İZİN GÜNCELLEME
    # =====================

    async def izin_guncelle(
        self,
        toplanti_id: uuid.UUID,
        hedef_kullanici_id: uuid.UUID,
        izinler: KatilimciIzinGuncelle,
        istek_yapan: Kullanici,
    ) -> KatilimciYanit:
        """
        Katılımcının izinlerini günceller.
        
        Args:
            toplanti_id: Toplantı UUID
            hedef_kullanici_id: İzinleri güncellenecek kullanıcı
            izinler: Yeni izin değerleri
            istek_yapan: İsteği yapan kullanıcı (admin/moderatör)
        
        Raises:
            YetkisizErisimHatasi: Yetki yoksa
            BulunamadiHatasi: Katılımcı bulunamazsa
        """
        # İstek yapanın yetkisini kontrol et
        istek_yapan_katilimci = await self._katilimci_getir(
            toplanti_id, istek_yapan.id
        )

        if not istek_yapan_katilimci:
            raise YetkisizErisimHatasi("Bu toplantıda değilsiniz")

        if not istek_yapan_katilimci.yonetici_mi:
            # Kullanıcı sadece kendi el_kaldirdi durumunu güncelleyebilir
            guncellenen_alanlar = list(izinler.model_dump(exclude_unset=True).keys())
            kendi_eli_mi = (istek_yapan.id == hedef_kullanici_id and guncellenen_alanlar == ["el_kaldirdi"])
            
            if not kendi_eli_mi and istek_yapan.rol != KullaniciRolu.ADMIN:
                raise YetkisizErisimHatasi(
                    "İzinleri güncellemek için sahip veya moderatör olmalısınız"
                )

        # Hedef katılımcıyı bul
        hedef = await self._katilimci_getir(toplanti_id, hedef_kullanici_id)
        if not hedef:
            raise BulunamadiHatasi("Katılımcı")

        # Sahip'in izinleri değiştirilemez (sadece kendisi yapabilir)
        if (
            hedef.rol == KatilimciRolu.SAHIP
            and hedef.kullanici_id != istek_yapan.id
        ):
            raise YetkisizErisimHatasi("Toplantı sahibinin izinleri değiştirilemez")

        # İzinleri güncelle
        guncelleme = izinler.model_dump(exclude_unset=True)
        
        # Rol güncelleme özel kontrolü
        if "rol" in guncelleme:
            await self._rol_guncelle(hedef, guncelleme.pop("rol"), istek_yapan_katilimci)

        for alan, deger in guncelleme.items():
            setattr(hedef, alan, deger)

        await self.db.flush()
        await self.db.refresh(hedef)

        # Redis'teki ana katılımcı verilerini ve medya durumunu güncelle
        await self.redis.katilimci_guncelle(
            str(toplanti_id),
            str(hedef_kullanici_id),
            {
                "onayi_bekliyor": hedef.onayi_bekliyor,
                "rol": hedef.rol.value,
                "mikrofon_izni": hedef.mikrofon_izni,
                "kamera_izni": hedef.kamera_izni,
                "ekran_paylasim_izni": hedef.ekran_paylasim_izni,
                "sohbet_izni": hedef.sohbet_izni,
            }
        )
        
        await self.redis.medya_durumu_guncelle(
            str(toplanti_id),
            str(hedef_kullanici_id),
            {
                "mikrofon_izni": hedef.mikrofon_izni,
                "kamera_izni": hedef.kamera_izni,
                "ekran_paylasim_izni": hedef.ekran_paylasim_izni,
                "sohbet_izni": hedef.sohbet_izni,
            },
        )

        logger.info(
            f"İzinler güncellendi: {hedef_kullanici_id} | "
            f"Toplantı: {toplanti_id} | Güncelleyen: {istek_yapan.email}"
        )

        return await self._katilimci_yaniti(hedef)

    # =====================
    # TOPLU İZİN İŞLEMLERİ
    # =====================

    async def tumu_sessize_al(
        self,
        toplanti_id: uuid.UUID,
        istek_yapan: Kullanici,
    ) -> list[KatilimciYanit]:
        """Toplantıdaki tüm katılımcıların mikrofonunu kapatır."""
        await self._yetki_kontrol(toplanti_id, istek_yapan)

        katilimcilar = await self._tum_katilimcilari_getir(toplanti_id)
        yanitlar = []

        for k in katilimcilar:
            # Sahip ve istek yapanı atla
            if k.rol == KatilimciRolu.SAHIP or k.kullanici_id == istek_yapan.id:
                continue

            k.mikrofon_izni = False
            await self.redis.katilimci_guncelle(
                str(toplanti_id),
                str(k.kullanici_id),
                {"mikrofon_izni": False},
            )
            await self.redis.medya_durumu_guncelle(
                str(toplanti_id),
                str(k.kullanici_id),
                {"mikrofon_izni": False},
            )
            yanitlar.append(await self._katilimci_yaniti(k))

        await self.db.flush()
        logger.info(f"Tüm katılımcılar sessize alındı: Toplantı {toplanti_id}")

        return yanitlar

    async def tum_kameralari_kapat(
        self,
        toplanti_id: uuid.UUID,
        istek_yapan: Kullanici,
    ) -> list[KatilimciYanit]:
        """Toplantıdaki tüm katılımcıların kamerasını kapatır."""
        await self._yetki_kontrol(toplanti_id, istek_yapan)

        katilimcilar = await self._tum_katilimcilari_getir(toplanti_id)
        yanitlar = []

        for k in katilimcilar:
            if k.rol == KatilimciRolu.SAHIP or k.kullanici_id == istek_yapan.id:
                continue

            k.kamera_izni = False
            await self.redis.katilimci_guncelle(
                str(toplanti_id),
                str(k.kullanici_id),
                {"kamera_izni": False},
            )
            await self.redis.medya_durumu_guncelle(
                str(toplanti_id),
                str(k.kullanici_id),
                {"kamera_izni": False},
            )
            yanitlar.append(await self._katilimci_yaniti(k))

        await self.db.flush()
        logger.info(f"Tüm kameralar kapatıldı: Toplantı {toplanti_id}")

        return yanitlar

    # =====================
    # İZİN SORGULAMA
    # =====================

    async def izin_kontrol(
        self,
        toplanti_id: uuid.UUID,
        kullanici_id: uuid.UUID,
        izin_adi: str,
    ) -> bool:
        """
        Belirli bir izni kontrol eder.
        
        Args:
            izin_adi: "mikrofon_izni", "kamera_izni", "ekran_paylasim_izni", "sohbet_izni"
        """
        katilimci = await self._katilimci_getir(toplanti_id, kullanici_id)
        if not katilimci or not katilimci.aktif:
            return False

        # Sahip her zaman yetkili
        if katilimci.rol == KatilimciRolu.SAHIP:
            return True

        return getattr(katilimci, izin_adi, False)

    async def kullanici_izinleri_getir(
        self,
        toplanti_id: uuid.UUID,
        kullanici_id: uuid.UUID,
    ) -> dict:
        """Kullanıcının tüm izinlerini döndürür."""
        katilimci = await self._katilimci_getir(toplanti_id, kullanici_id)
        if not katilimci:
            return {
                "mikrofon_izni": False,
                "kamera_izni": False,
                "ekran_paylasim_izni": False,
                "sohbet_izni": False,
                "kalici_susturuldu": False,
                "el_kaldirdi": False,
                "onayi_bekliyor": False,
                "rol": "yok",
            }

        return {
            "mikrofon_izni": katilimci.mikrofon_izni,
            "kamera_izni": katilimci.kamera_izni,
            "ekran_paylasim_izni": katilimci.ekran_paylasim_izni,
            "sohbet_izni": katilimci.sohbet_izni,
            "kalici_susturuldu": katilimci.kalici_susturuldu,
            "el_kaldirdi": katilimci.el_kaldirdi,
            "onayi_bekliyor": katilimci.onayi_bekliyor,
            "rol": katilimci.rol.value,
        }

    # =====================
    # ROL YÖNETİMİ
    # =====================

    async def _rol_guncelle(
        self,
        hedef: ToplantiKatilimci,
        yeni_rol: str,
        istek_yapan: ToplantiKatilimci,
    ):
        """
        Katılımcı rolünü günceller.
        
        Kurallar:
            - Sadece sahip, moderatör atayabilir
            - Moderatör, sahip yapamaz
            - Sahip rolü değiştirilemez (transfer hariç)
        """
        yeni_rol_enum = KatilimciRolu(yeni_rol)

        # Sahip rolü ataması sadece mevcut sahip yapabilir
        if yeni_rol_enum == KatilimciRolu.SAHIP:
            if istek_yapan.rol != KatilimciRolu.SAHIP:
                raise YetkisizErisimHatasi(
                    "Sahiplik sadece mevcut sahip tarafından transfer edilebilir"
                )
            # Sahipliği transfer et
            istek_yapan.rol = KatilimciRolu.MODERATOR

        hedef.rol = yeni_rol_enum

        # İzleyici rolüne düşürülünce tüm izinleri kapat
        if yeni_rol_enum == KatilimciRolu.IZLEYICI:
            hedef.mikrofon_izni = False
            hedef.kamera_izni = False
            hedef.ekran_paylasim_izni = False
            hedef.sohbet_izni = False

        # Moderatör yapılınca tüm izinleri aç
        elif yeni_rol_enum == KatilimciRolu.MODERATOR:
            hedef.mikrofon_izni = True
            hedef.kamera_izni = True
            hedef.ekran_paylasim_izni = True
            hedef.sohbet_izni = True

        logger.info(
            f"Rol güncellendi: {hedef.kullanici_id} → {yeni_rol} | "
            f"Toplantı: {hedef.toplanti_id}"
        )

    # =====================
    # YARDIMCI METODLAR
    # =====================

    async def _katilimci_getir(
        self,
        toplanti_id: uuid.UUID,
        kullanici_id: uuid.UUID,
    ) -> Optional[ToplantiKatilimci]:
        sorgu = (
            select(ToplantiKatilimci)
            .options(selectinload(ToplantiKatilimci.kullanici))
            .where(
                ToplantiKatilimci.toplanti_id == toplanti_id,
                ToplantiKatilimci.kullanici_id == kullanici_id,
                ToplantiKatilimci.aktif == True,
            )
        )
        sonuc = await self.db.execute(sorgu)
        return sonuc.scalar_one_or_none()

    async def _tum_katilimcilari_getir(
        self,
        toplanti_id: uuid.UUID,
    ) -> list[ToplantiKatilimci]:
        sorgu = (
            select(ToplantiKatilimci)
            .options(selectinload(ToplantiKatilimci.kullanici))
            .where(
                ToplantiKatilimci.toplanti_id == toplanti_id,
                ToplantiKatilimci.aktif == True,
            )
        )
        sonuc = await self.db.execute(sorgu)
        return list(sonuc.scalars().all())

    async def _yetki_kontrol(
        self,
        toplanti_id: uuid.UUID,
        kullanici: Kullanici,
    ):
        """İstek yapanın yönetici yetkisi olup olmadığını kontrol eder."""
        katilimci = await self._katilimci_getir(toplanti_id, kullanici.id)

        if not katilimci:
            raise YetkisizErisimHatasi("Bu toplantıda değilsiniz")

        if not katilimci.yonetici_mi and kullanici.rol != KullaniciRolu.ADMIN:
            raise YetkisizErisimHatasi(
                "Bu işlem için sahip veya moderatör yetkisi gereklidir"
            )

    async def _katilimci_yaniti(
        self,
        katilimci: ToplantiKatilimci,
    ) -> KatilimciYanit:
        """Katılımcı modelinden yanıt şeması oluşturur."""
        return KatilimciYanit(
            id=katilimci.id,
            kullanici_id=katilimci.kullanici_id,
            kullanici_adi=katilimci.kullanici.kullanici_adi if katilimci.kullanici else "",
            ad_soyad=katilimci.kullanici.ad_soyad if katilimci.kullanici else "",
            profil_resmi=katilimci.kullanici.profil_resmi if katilimci.kullanici else None,
            rol=katilimci.rol.value,
            mikrofon_izni=katilimci.mikrofon_izni,
            kamera_izni=katilimci.kamera_izni,
            ekran_paylasim_izni=katilimci.ekran_paylasim_izni,
            sohbet_izni=katilimci.sohbet_izni,
            kalici_susturuldu=katilimci.kalici_susturuldu,
            el_kaldirdi=katilimci.el_kaldirdi,
            onayi_bekliyor=katilimci.onayi_bekliyor,
            aktif=katilimci.aktif,
            katilma_zamani=katilimci.katilma_zamani,
        )

"""
Toplantı Servisi (Düzeltilmiş)
===============================
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from loguru import logger
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.hata_yonetimi import (
    BulunamadiHatasi,
    YetkisizErisimHatasi,
    UygulamaHatasi,
)
from app.core.redis import (
    onbellek_sil,
    oda_durumu_kaydet,
)
from app.models.kullanici import Kullanici, KullaniciRolu
from app.models.toplanti import (
    Toplanti,
    ToplantiDurumu,
    ToplantiKatilimci,
    KatilimciRolu,
)
from app.schemas.toplanti import (
    ToplantiOlustur,
    ToplantiGuncelle,
    ToplantiYanit,
    ToplantiListeYanit,
    KatilimciYanit,
)
from app.services.redis_servisi import RedisServisi
from app.utils.yardimcilar import toplanti_kodu_olustur


class ToplantiServisi:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def toplanti_olustur(
        self, veri: ToplantiOlustur, olusturan: Kullanici
    ) -> ToplantiYanit:
        if olusturan.rol not in (KullaniciRolu.ADMIN, KullaniciRolu.MODERATOR):
            raise YetkisizErisimHatasi(
                "Toplantı oluşturmak için admin veya moderatör yetkisi gereklidir"
            )

        kod = await self._benzersiz_kod_uret()

        toplanti = Toplanti(
            baslik=veri.baslik,
            aciklama=veri.aciklama,
            toplanti_kodu=kod,
            olusturan_id=olusturan.id,
            durum=ToplantiDurumu.PLANLANMIS,
            baslangic_zamani=veri.baslangic_zamani,
            bitis_zamani=veri.bitis_zamani,
            maks_katilimci=veri.maks_katilimci,
            sifre=veri.sifre,
            bekleme_odasi_aktif=veri.bekleme_odasi_aktif,
        )

        self.db.add(toplanti)
        await self.db.flush()
        await self.db.refresh(toplanti)

        sahip = ToplantiKatilimci(
            toplanti_id=toplanti.id,
            kullanici_id=olusturan.id,
            rol=KatilimciRolu.SAHIP,
            mikrofon_izni=True,
            kamera_izni=True,
            ekran_paylasim_izni=True,
            sohbet_izni=True,
            kalici_susturuldu=False,
            el_kaldirdi=False,
            onayi_bekliyor=False,
        )
        self.db.add(sahip)
        await self.db.flush()

        await oda_durumu_kaydet(
            str(toplanti.id), "bilgi",
            {"toplanti_id": str(toplanti.id), "kod": kod, "baslik": toplanti.baslik,
             "durum": toplanti.durum.value, "olusturan_id": str(olusturan.id)},
        )
        await oda_durumu_kaydet(str(toplanti.id), "katilimcilar", {})

        logger.info(f"Toplantı oluşturuldu: {toplanti.baslik} ({kod})")
        return await self._toplanti_yaniti_olustur(toplanti)

    async def toplantiya_katil(
        self, toplanti_kodu: str, kullanici: Kullanici, sifre: Optional[str] = None
    ) -> ToplantiYanit:
        toplanti = await self._kod_ile_getir(toplanti_kodu)
        if not toplanti:
            raise BulunamadiHatasi("Toplantı")

        if toplanti.durum == ToplantiDurumu.BITMIS:
            raise UygulamaHatasi("Bu toplantı sona ermiş", 400)
        if toplanti.durum == ToplantiDurumu.IPTAL:
            raise UygulamaHatasi("Bu toplantı iptal edilmiş", 400)

        if toplanti.sifre and toplanti.sifre != sifre:
            raise YetkisizErisimHatasi("Toplantı şifresi yanlış")

        mevcut = await self._katilimci_getir(toplanti.id, kullanici.id)

        if mevcut and mevcut.engellendi:
            raise UygulamaHatasi("Toplantıdan çıkarıldınız, tekrar katılamazsınız", 403)

        # Zaten aktifse direkt döndür (hata verme)
        if mevcut and mevcut.aktif:
            return await self._toplanti_yaniti_olustur(toplanti)

        # Daha önce ayrılmışsa tekrar aktifleştir
        if mevcut and not mevcut.aktif:
            mevcut.aktif = True
            mevcut.katilma_zamani = datetime.now(timezone.utc)
            mevcut.ayrilma_zamani = None
            await self.db.flush()

            if toplanti.durum == ToplantiDurumu.PLANLANMIS:
                toplanti.durum = ToplantiDurumu.AKTIF
                await self.db.flush()

            return await self._toplanti_yaniti_olustur(toplanti)

        aktif_sayisi = await self._aktif_katilimci_sayisi(toplanti.id)
        if aktif_sayisi >= toplanti.maks_katilimci:
            raise UygulamaHatasi("Toplantı kapasitesi dolu", 400)

        if toplanti.durum == ToplantiDurumu.PLANLANMIS:
            toplanti.durum = ToplantiDurumu.AKTIF
            await self.db.flush()

        katilimci = ToplantiKatilimci(
            id=uuid.uuid4(),
            toplanti=toplanti,
            kullanici=kullanici,
            rol=KatilimciRolu.KATILIMCI,
            mikrofon_izni=True,
            kamera_izni=True,
            ekran_paylasim_izni=True,
            sohbet_izni=True,
            kalici_susturuldu=False,
            el_kaldirdi=False,
            onayi_bekliyor=toplanti.bekleme_odasi_aktif,
            engellendi=False,
            katilma_zamani=datetime.now(timezone.utc),
        )
        self.db.add(katilimci)
        await self.db.flush()

        logger.info(f"Katılım: {kullanici.email} → {toplanti.baslik}")
        return await self._toplanti_yaniti_olustur(toplanti)

    async def toplanti_bilgisi_halka_acik(self, toplanti_kodu: str) -> dict:
        """Halka açık toplantı bilgisi."""
        toplanti = await self._kod_ile_getir(toplanti_kodu)
        if not toplanti:
            raise BulunamadiHatasi("Toplantı")
        
        return {
            "id": str(toplanti.id),
            "baslik": toplanti.baslik,
            "sifreli": bool(toplanti.sifre),
            "aktif": toplanti.durum == ToplantiDurumu.AKTIF or toplanti.durum == ToplantiDurumu.PLANLANMIS
        }

    async def misafir_katil(self, toplanti_kodu: str, rumuz: str, sifre: Optional[str] = None) -> dict:
        """Misafir olarak bir toplantıya katıl (ve token al)."""
        logger.info(f"Servis: misafir_katil başladı - Kod: {toplanti_kodu}, Rumuz: {rumuz}")
        
        try:
            toplanti = await self._kod_ile_getir(toplanti_kodu)
            if not toplanti:
                logger.warning(f"Toplantı bulunamadı: {toplanti_kodu}")
                raise BulunamadiHatasi("Toplantı")
            
            if toplanti.sifre and toplanti.sifre != sifre:
                logger.warning(f"Hatalı şifre denemesi: {toplanti_kodu}")
                raise YetkisizErisimHatasi("Toplantı şifresi yanlış")

            # Geçici misafir kullanıcısı oluştur
            if await self._engellenen_misafir_var_mi(toplanti.id, rumuz):
                raise UygulamaHatasi("Bu toplantıdan çıkarıldınız, aynı rumuzla tekrar katılamazsınız", 403)

            misafir_id = uuid.uuid4()
            logger.debug(f"Yeni misafir ID oluşturuldu: {misafir_id}")
            
            misafir = Kullanici(
                id=misafir_id,
                email=f"guest_{misafir_id.hex}@toplanti.local",
                kullanici_adi=f"guest_{misafir_id.hex[:8]}",
                ad_soyad=rumuz,
                sifre_hash="guest_no_password",
                rol=KullaniciRolu.MISAFIR,
                aktif=True,
                olusturulma_tarihi=datetime.now(timezone.utc),
                guncelleme_tarihi=datetime.now(timezone.utc),
                son_giris=datetime.now(timezone.utc),
            )
            self.db.add(misafir)
            await self.db.flush()
            logger.debug("Misafir kullanıcı veritabanına eklendi (flushed)")

            # Toplantıya katılım işlemi
            await self.toplantiya_katil(toplanti_kodu, misafir, sifre)
            logger.debug("Toplantıya katılım işlemi tamamlandı")

            # Token oluştur
            from app.core.guvenlik import erisim_tokeni_olustur, yenileme_tokeni_olustur
            from app.config import ayarlari_getir
            from app.schemas.kullanici import KullaniciYanit
            
            ayarlar = ayarlari_getir()
            logger.debug("Token oluşturuluyor...")
            
            erisim_tokeni = erisim_tokeni_olustur(misafir.id, misafir.email, misafir.rol.value)
            yenileme_tokeni = yenileme_tokeni_olustur(misafir.id, misafir.email, misafir.rol.value)
            
            logger.debug("Kullanıcı yanıtı serileştiriliyor...")
            kullanici_yanit = KullaniciYanit.model_validate(misafir).model_dump()
            
            logger.info(f"Misafir katılımı başarılı: {rumuz} (ID: {misafir_id})")
            
            return {
                "erisim_tokeni": erisim_tokeni,
                "yenileme_tokeni": yenileme_tokeni,
                "token_tipi": "Bearer",
                "sure_dakika": ayarlar.ERISIM_TOKEN_SURESI_DAKIKA,
                "kullanici": kullanici_yanit,
            }
        except Exception as e:
            logger.exception(f"misafir_katil içinde beklenmeyen hata: {str(e)}")
            raise e

    async def toplantidan_ayril(self, toplanti_id: uuid.UUID, kullanici_id: uuid.UUID) -> bool:
        katilimci = await self._katilimci_getir(toplanti_id, kullanici_id)
        if not katilimci:
            return False
        katilimci.aktif = False
        katilimci.ayrilma_zamani = datetime.now(timezone.utc)
        await self.db.flush()
        return True

    async def toplantilari_listele(
        self, kullanici: Kullanici, durum: Optional[str] = None,
        atlama: int = 0, sinir: int = 20
    ) -> ToplantiListeYanit:
        kosullar = []
        if kullanici.rol != KullaniciRolu.ADMIN:
            katildigi_ids = (
                select(ToplantiKatilimci.toplanti_id)
                .where(ToplantiKatilimci.kullanici_id == kullanici.id)
                .scalar_subquery()
            )
            kosullar.append(
                Toplanti.id.in_(katildigi_ids) | (Toplanti.olusturan_id == kullanici.id)
            )
        if durum:
            kosullar.append(Toplanti.durum == ToplantiDurumu(durum))

        sayim_sorgusu = select(func.count(Toplanti.id))
        if kosullar:
            sayim_sorgusu = sayim_sorgusu.where(and_(*kosullar))
        sayim_sonucu = await self.db.execute(sayim_sorgusu)
        toplam = sayim_sonucu.scalar() or 0

        sorgu = (
            select(Toplanti)
            .options(selectinload(Toplanti.katilimcilar).selectinload(ToplantiKatilimci.kullanici))
            .order_by(Toplanti.olusturulma_tarihi.desc())
        )
        if kosullar:
            sorgu = sorgu.where(and_(*kosullar))
        sorgu = sorgu.offset(atlama).limit(sinir)

        sonuc = await self.db.execute(sorgu)
        toplantilar = sonuc.scalars().unique().all()

        yanit_listesi = []
        for t in toplantilar:
            yanit_listesi.append(await self._toplanti_yaniti_olustur(t))

        return ToplantiListeYanit(
            toplantilar=yanit_listesi, toplam=toplam,
            sayfa=(atlama // sinir) + 1, sayfa_boyutu=sinir,
        )

    async def toplanti_detay(self, toplanti_id: uuid.UUID) -> ToplantiYanit:
        toplanti = await self._id_ile_getir(toplanti_id)
        if not toplanti:
            raise BulunamadiHatasi("Toplantı")
        return await self._toplanti_yaniti_olustur(toplanti)

    async def toplanti_kod_ile_getir(self, toplanti_kodu: str) -> ToplantiYanit:
        toplanti = await self._kod_ile_getir(toplanti_kodu)
        if not toplanti:
            raise BulunamadiHatasi("Toplantı")
        return await self._toplanti_yaniti_olustur(toplanti)

    async def toplanti_guncelle(
        self, toplanti_id: uuid.UUID, veri: ToplantiGuncelle, kullanici: Kullanici
    ) -> ToplantiYanit:
        toplanti = await self._id_ile_getir(toplanti_id)
        if not toplanti:
            raise BulunamadiHatasi("Toplantı")
        if toplanti.olusturan_id != kullanici.id and kullanici.rol != KullaniciRolu.ADMIN:
            raise YetkisizErisimHatasi("Bu toplantıyı düzenleme yetkiniz yok")

        guncelleme = veri.model_dump(exclude_unset=True)
        if "durum" in guncelleme:
            guncelleme["durum"] = ToplantiDurumu(guncelleme["durum"])
        for alan, deger in guncelleme.items():
            setattr(toplanti, alan, deger)
        await self.db.flush()
        await self.db.refresh(toplanti)
        await onbellek_sil(f"toplanti:{toplanti_id}")
        return await self._toplanti_yaniti_olustur(toplanti)

    async def toplanti_sonlandir(
        self, toplanti_id: uuid.UUID, kullanici: Kullanici
    ) -> ToplantiYanit:
        toplanti = await self._id_ile_getir(toplanti_id)
        if not toplanti:
            raise BulunamadiHatasi("Toplantı")
        if toplanti.olusturan_id != kullanici.id and kullanici.rol != KullaniciRolu.ADMIN:
            raise YetkisizErisimHatasi("Bu toplantıyı sonlandırma yetkiniz yok")
        await self._toplanti_bitir(toplanti_id)
        await self.db.refresh(toplanti)
        return await self._toplanti_yaniti_olustur(toplanti)

    async def katilimci_at(
        self, toplanti_id: uuid.UUID, hedef_id: uuid.UUID, atan: Kullanici
    ) -> bool:
        atan_katilimci = await self._katilimci_getir(toplanti_id, atan.id)
        if not atan_katilimci or not atan_katilimci.yonetici_mi:
            if atan.rol != KullaniciRolu.ADMIN:
                raise YetkisizErisimHatasi("Katılımcı atma yetkiniz yok")

        hedef = await self._katilimci_getir(toplanti_id, hedef_id)
        if not hedef:
            raise BulunamadiHatasi("Katılımcı")
        if hedef.rol == KatilimciRolu.SAHIP:
            raise YetkisizErisimHatasi("Toplantı sahibi atılamaz")

        hedef.engellendi = True
        hedef.aktif = False
        hedef.el_kaldirdi = False
        hedef.onayi_bekliyor = False
        hedef.ayrilma_zamani = datetime.now(timezone.utc)
        await self.db.flush()
        return True

    async def katilimcilari_getir(self, toplanti_id: uuid.UUID) -> list[KatilimciYanit]:
        sorgu = (
            select(ToplantiKatilimci)
            .options(selectinload(ToplantiKatilimci.kullanici))
            .where(
                ToplantiKatilimci.toplanti_id == toplanti_id,
                ToplantiKatilimci.aktif == True,
            )
            .order_by(ToplantiKatilimci.katilma_zamani)
        )
        sonuc = await self.db.execute(sorgu)
        katilimcilar = sonuc.scalars().all()

        return [
            KatilimciYanit(
                id=k.id, kullanici_id=k.kullanici_id,
                kullanici_adi=k.kullanici.kullanici_adi if k.kullanici else "",
                ad_soyad=k.kullanici.ad_soyad if k.kullanici else "",
                profil_resmi=k.kullanici.profil_resmi if k.kullanici else None,
                rol=k.rol.value, mikrofon_izni=k.mikrofon_izni,
                kamera_izni=k.kamera_izni, ekran_paylasim_izni=k.ekran_paylasim_izni,
                sohbet_izni=k.sohbet_izni, kalici_susturuldu=k.kalici_susturuldu,
                el_kaldirdi=k.el_kaldirdi, onayi_bekliyor=k.onayi_bekliyor,
                aktif=k.aktif, katilma_zamani=k.katilma_zamani,
            )
            for k in katilimcilar
        ]

    # --- Yardımcılar ---

    async def _id_ile_getir(self, toplanti_id: uuid.UUID) -> Optional[Toplanti]:
        sorgu = (
            select(Toplanti)
            .options(selectinload(Toplanti.katilimcilar).selectinload(ToplantiKatilimci.kullanici))
            .where(Toplanti.id == toplanti_id)
        )
        sonuc = await self.db.execute(sorgu)
        return sonuc.scalar_one_or_none()

    async def _kod_ile_getir(self, kod: str) -> Optional[Toplanti]:
        sorgu = (
            select(Toplanti)
            .options(selectinload(Toplanti.katilimcilar).selectinload(ToplantiKatilimci.kullanici))
            .where(Toplanti.toplanti_kodu == kod)
        )
        sonuc = await self.db.execute(sorgu)
        return sonuc.scalar_one_or_none()

    async def _katilimci_getir(self, toplanti_id: uuid.UUID, kullanici_id: uuid.UUID) -> Optional[ToplantiKatilimci]:
        sorgu = select(ToplantiKatilimci).where(
            ToplantiKatilimci.toplanti_id == toplanti_id,
            ToplantiKatilimci.kullanici_id == kullanici_id,
        )
        sonuc = await self.db.execute(sorgu)
        return sonuc.scalar_one_or_none()

    async def _aktif_katilimci_sayisi(self, toplanti_id: uuid.UUID) -> int:
        sorgu = select(func.count(ToplantiKatilimci.id)).where(
            ToplantiKatilimci.toplanti_id == toplanti_id,
            ToplantiKatilimci.aktif == True,
        )
        sonuc = await self.db.execute(sorgu)
        return sonuc.scalar() or 0

    async def _engellenen_misafir_var_mi(self, toplanti_id: uuid.UUID, rumuz: str) -> bool:
        sorgu = (
            select(ToplantiKatilimci.id)
            .join(Kullanici, ToplantiKatilimci.kullanici_id == Kullanici.id)
            .where(
                ToplantiKatilimci.toplanti_id == toplanti_id,
                ToplantiKatilimci.engellendi == True,
                Kullanici.rol == KullaniciRolu.MISAFIR,
                func.lower(Kullanici.ad_soyad) == rumuz.strip().lower(),
            )
            .limit(1)
        )
        sonuc = await self.db.execute(sorgu)
        return sonuc.scalar_one_or_none() is not None

    async def _toplanti_bitir(self, toplanti_id: uuid.UUID):
        toplanti = await self._id_ile_getir(toplanti_id)
        if toplanti:
            toplanti.durum = ToplantiDurumu.BITMIS
            toplanti.bitis_zamani = datetime.now(timezone.utc)
            for k in toplanti.katilimcilar:
                if k.aktif:
                    k.aktif = False
                    k.ayrilma_zamani = datetime.now(timezone.utc)
            await self.db.flush()
            await RedisServisi().oda_sil(str(toplanti_id))

    async def _benzersiz_kod_uret(self) -> str:
        for _ in range(10):
            kod = toplanti_kodu_olustur()
            mevcut = await self._kod_ile_getir(kod)
            if not mevcut:
                return kod
        raise UygulamaHatasi("Benzersiz toplantı kodu üretilemedi")

    async def _toplanti_yaniti_olustur(self, toplanti: Toplanti) -> ToplantiYanit:
        katilimci_yanitlari = []
        aktif_sayisi = 0
        olusturan_adi = ""

        for k in toplanti.katilimcilar:
            if k.aktif:
                aktif_sayisi += 1
            katilimci_yanitlari.append(
                KatilimciYanit(
                    id=k.id, kullanici_id=k.kullanici_id,
                    kullanici_adi=k.kullanici.kullanici_adi if k.kullanici else "",
                    ad_soyad=k.kullanici.ad_soyad if k.kullanici else "",
                    profil_resmi=k.kullanici.profil_resmi if k.kullanici else None,
                    rol=k.rol.value, mikrofon_izni=k.mikrofon_izni,
                    kamera_izni=k.kamera_izni, ekran_paylasim_izni=k.ekran_paylasim_izni,
                    sohbet_izni=k.sohbet_izni, kalici_susturuldu=k.kalici_susturuldu,
                    el_kaldirdi=k.el_kaldirdi, onayi_bekliyor=k.onayi_bekliyor,
                    aktif=k.aktif, katilma_zamani=k.katilma_zamani,
                )
            )
            if k.kullanici_id == toplanti.olusturan_id and k.kullanici:
                olusturan_adi = k.kullanici.ad_soyad

        return ToplantiYanit(
            id=toplanti.id, baslik=toplanti.baslik, aciklama=toplanti.aciklama,
            toplanti_kodu=toplanti.toplanti_kodu, olusturan_id=toplanti.olusturan_id,
            olusturan_adi=olusturan_adi, durum=toplanti.durum.value,
            baslangic_zamani=toplanti.baslangic_zamani, bitis_zamani=toplanti.bitis_zamani,
            maks_katilimci=toplanti.maks_katilimci, bekleme_odasi_aktif=toplanti.bekleme_odasi_aktif,
            kayit_aktif=toplanti.kayit_aktif, katilimci_sayisi=aktif_sayisi,
            katilimcilar=katilimci_yanitlari, olusturulma_tarihi=toplanti.olusturulma_tarihi,
        )

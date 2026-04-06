"""
Auth Servisi (Düzeltilmiş)
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from loguru import logger
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.guvenlik import erisim_tokeni_olustur, sifre_dogrula, sifre_hashle, yenileme_tokeni_olustur, token_coz
from app.core.hata_yonetimi import BulunamadiHatasi, YetkilendirmeHatasi, ZatenVarHatasi
from app.core.redis import onbellek_kaydet, onbellek_getir, onbellek_sil
from app.models.kullanici import Kullanici, KullaniciRolu
from app.schemas.kullanici import KullaniciGuncelle, KullaniciOlustur, KullaniciYanit, TokenYanit


class AuthServisi:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def kullanici_kaydet(self, veri: KullaniciOlustur) -> TokenYanit:
        mevcut = await self._kullanici_var_mi(veri.email, veri.kullanici_adi)
        if mevcut:
            if mevcut.email == veri.email:
                raise ZatenVarHatasi("Bu e-posta zaten kayıtlı")
            raise ZatenVarHatasi("Bu kullanıcı adı kullanılıyor")

        # İlk kayıt olan kullanıcıyı admin yap
        sonuc = await self.db.execute(select(func.count(Kullanici.id)))
        kullanici_sayisi = sonuc.scalar() or 0
        
        rol = KullaniciRolu.ADMIN if kullanici_sayisi == 0 else KullaniciRolu.KULLANICI

        yeni = Kullanici(
            email=veri.email, 
            kullanici_adi=veri.kullanici_adi, 
            ad_soyad=veri.ad_soyad,
            sifre_hash=sifre_hashle(veri.sifre), 
            rol=rol,
            son_giris=datetime.now(timezone.utc),
        )
        self.db.add(yeni)
        await self.db.flush()
        await self.db.refresh(yeni)
        logger.info(f"Yeni kullanıcı: {yeni.email}")
        return self._token_yaniti(yeni)

    async def giris_yap(self, email: str, sifre: str) -> TokenYanit:
        kullanici = await self._email_ile_getir(email)
        if not kullanici:
            raise YetkilendirmeHatasi("E-posta veya şifre hatalı")
        if not kullanici.aktif:
            raise YetkilendirmeHatasi("Hesap devre dışı")
        if not sifre_dogrula(sifre, kullanici.sifre_hash):
            raise YetkilendirmeHatasi("E-posta veya şifre hatalı")

        kullanici.son_giris = datetime.now(timezone.utc)
        await self.db.flush()
        logger.info(f"Giriş: {kullanici.email}")
        return self._token_yaniti(kullanici)

    async def token_yenile(self, yenileme_tokeni: str) -> TokenYanit:
        payload = token_coz(yenileme_tokeni)
        if not payload or payload.get("tip") != "yenileme":
            raise YetkilendirmeHatasi("Geçersiz yenileme token'ı")
        kullanici = await self._id_ile_getir(uuid.UUID(payload["sub"]))
        if not kullanici or not kullanici.aktif:
            raise YetkilendirmeHatasi("Kullanıcı bulunamadı")
        return self._token_yaniti(kullanici)

    async def profil_getir(self, kullanici_id: uuid.UUID) -> KullaniciYanit:
        kullanici = await self._id_ile_getir(kullanici_id)
        if not kullanici:
            raise BulunamadiHatasi("Kullanıcı")
        return KullaniciYanit.model_validate(kullanici)

    async def profil_guncelle(self, kullanici_id: uuid.UUID, veri: KullaniciGuncelle) -> KullaniciYanit:
        kullanici = await self._id_ile_getir(kullanici_id)
        if not kullanici:
            raise BulunamadiHatasi("Kullanıcı")
        for alan, deger in veri.model_dump(exclude_unset=True).items():
            setattr(kullanici, alan, deger)
        await self.db.flush()
        await self.db.refresh(kullanici)
        await onbellek_sil(f"kullanici:{kullanici_id}")
        return KullaniciYanit.model_validate(kullanici)

    async def tum_kullanicilari_getir(self, atlama: int = 0, sinir: int = 20):
        # Toplam sayı
        sayim = await self.db.execute(select(func.count(Kullanici.id)))
        toplam = sayim.scalar() or 0

        # Sayfalanmış liste
        sorgu = select(Kullanici).order_by(Kullanici.olusturulma_tarihi.desc()).offset(atlama).limit(sinir)
        sonuc = await self.db.execute(sorgu)
        kullanicilar = sonuc.scalars().all()

        return ([KullaniciYanit.model_validate(k) for k in kullanicilar], toplam)

    async def kullanici_rolunu_guncelle(self, kullanici_id: uuid.UUID, yeni_rol: str) -> KullaniciYanit:
        kullanici = await self._id_ile_getir(kullanici_id)
        if not kullanici:
            raise BulunamadiHatasi("Kullanıcı")
        kullanici.rol = KullaniciRolu(yeni_rol)
        await self.db.flush()
        await self.db.refresh(kullanici)
        await onbellek_sil(f"kullanici:{kullanici_id}")
        return KullaniciYanit.model_validate(kullanici)

    async def kullanici_durumunu_degistir(self, kullanici_id: uuid.UUID, aktif: bool) -> KullaniciYanit:
        kullanici = await self._id_ile_getir(kullanici_id)
        if not kullanici:
            raise BulunamadiHatasi("Kullanıcı")
        kullanici.aktif = aktif
        await self.db.flush()
        await self.db.refresh(kullanici)
        await onbellek_sil(f"kullanici:{kullanici_id}")
        return KullaniciYanit.model_validate(kullanici)

    # --- Yardımcılar ---
    async def _email_ile_getir(self, email: str) -> Optional[Kullanici]:
        sonuc = await self.db.execute(select(Kullanici).where(Kullanici.email == email))
        return sonuc.scalar_one_or_none()

    async def _id_ile_getir(self, kid: uuid.UUID) -> Optional[Kullanici]:
        sonuc = await self.db.execute(select(Kullanici).where(Kullanici.id == kid))
        return sonuc.scalar_one_or_none()

    async def _kullanici_var_mi(self, email: str, kullanici_adi: str) -> Optional[Kullanici]:
        sonuc = await self.db.execute(
            select(Kullanici).where(or_(Kullanici.email == email, Kullanici.kullanici_adi == kullanici_adi))
        )
        return sonuc.scalar_one_or_none()

    def _token_yaniti(self, k: Kullanici) -> TokenYanit:
        from app.config import ayarlari_getir
        ayarlar = ayarlari_getir()
        return TokenYanit(
            erisim_tokeni=erisim_tokeni_olustur(k.id, k.email, k.rol.value),
            yenileme_tokeni=yenileme_tokeni_olustur(k.id, k.email, k.rol.value),
            token_tipi="Bearer",
            sure_dakika=ayarlar.ERISIM_TOKEN_SURESI_DAKIKA,
            kullanici=KullaniciYanit.model_validate(k),
        )

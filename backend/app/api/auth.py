"""
Kimlik Doğrulama API
====================
Kayıt, giriş, token yenileme ve profil endpoint'leri.

Rotalar:
    POST /api/auth/kayit          → Yeni kullanıcı kaydı
    POST /api/auth/giris          → Kullanıcı girişi
    POST /api/auth/token-yenile   → Token yenileme
    GET  /api/auth/profil         → Mevcut kullanıcı profili
    PUT  /api/auth/profil         → Profil güncelleme
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import veritabani_oturumu_getir
from app.dependencies import mevcut_kullanici
from app.models.kullanici import Kullanici
from app.schemas.kullanici import (
    KullaniciGiris,
    KullaniciGuncelle,
    KullaniciOlustur,
    KullaniciYanit,
    TokenYanit,
)
from app.services.auth_servisi import AuthServisi
from app.utils.yardimcilar import basarili_yanit

router = APIRouter(prefix="/api/auth", tags=["Kimlik Doğrulama"])


@router.post(
    "/kayit",
    response_model=TokenYanit,
    status_code=201,
    summary="Yeni Kullanıcı Kaydı",
    description="E-posta, kullanıcı adı ve şifre ile yeni hesap oluşturur.",
)
async def kayit(
    veri: KullaniciOlustur,
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    """
    Yeni kullanıcı kaydı oluşturur.
    
    Gereksinimler:
    - E-posta benzersiz olmalı
    - Kullanıcı adı benzersiz olmalı (3-50 karakter, harf/rakam/alt çizgi)
    - Şifre en az 8 karakter, büyük harf, küçük harf ve rakam içermeli
    """
    servis = AuthServisi(db)
    return await servis.kullanici_kaydet(veri)


@router.post(
    "/giris",
    response_model=TokenYanit,
    summary="Kullanıcı Girişi",
    description="E-posta ve şifre ile giriş yapar, JWT token çifti döndürür.",
)
async def giris(
    veri: KullaniciGiris,
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    """
    Kullanıcı girişi yapar.
    
    Başarılı girişte erişim ve yenileme token'ları döndürür.
    Erişim token'ı süresi: 30 dakika (yapılandırılabilir)
    """
    servis = AuthServisi(db)
    return await servis.giris_yap(veri.email, veri.sifre)


@router.post(
    "/token-yenile",
    response_model=TokenYanit,
    summary="Token Yenileme",
    description="Yenileme token'ı ile yeni erişim token'ı üretir.",
)
async def token_yenile(
    yenileme_tokeni: str,
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    """
    Süresi dolan erişim token'ını yeniler.
    
    Yenileme token'ı geçerli olmalıdır (varsayılan: 7 gün).
    """
    servis = AuthServisi(db)
    return await servis.token_yenile(yenileme_tokeni)


@router.get(
    "/profil",
    response_model=KullaniciYanit,
    summary="Profil Bilgileri",
    description="Giriş yapmış kullanıcının profil bilgilerini döndürür.",
)
async def profil_getir(
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    """Mevcut kullanıcının profil bilgilerini getirir."""
    servis = AuthServisi(db)
    return await servis.profil_getir(kullanici.id)


@router.put(
    "/profil",
    response_model=KullaniciYanit,
    summary="Profil Güncelleme",
    description="Ad, e-posta veya profil resmini günceller.",
)
async def profil_guncelle(
    veri: KullaniciGuncelle,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    """
    Kullanıcı profil bilgilerini günceller.
    
    Sadece gönderilen alanlar güncellenir (kısmi güncelleme).
    """
    servis = AuthServisi(db)
    return await servis.profil_guncelle(kullanici.id, veri)

"""
Kullanıcı Şemaları
==================
Kullanıcı ile ilgili tüm istek/yanıt şemaları.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class KullaniciTemel(BaseModel):
    """Kullanıcı temel alanları."""
    email: EmailStr = Field(..., description="E-posta adresi")
    kullanici_adi: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Kullanıcı adı (3-50 karakter)",
    )
    ad_soyad: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Ad ve soyad",
    )


class KullaniciOlustur(KullaniciTemel):
    """Kullanıcı kayıt şeması."""
    sifre: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Şifre (en az 8 karakter)",
    )
    sifre_tekrar: str = Field(
        ...,
        description="Şifre tekrarı",
    )

    @field_validator("sifre")
    @classmethod
    def sifre_guclu_mu(cls, v: str) -> str:
        """Şifre güçlülük kontrolü."""
        if not any(c.isupper() for c in v):
            raise ValueError("Şifre en az bir büyük harf içermelidir")
        if not any(c.islower() for c in v):
            raise ValueError("Şifre en az bir küçük harf içermelidir")
        if not any(c.isdigit() for c in v):
            raise ValueError("Şifre en az bir rakam içermelidir")
        return v

    @field_validator("sifre_tekrar")
    @classmethod
    def sifreler_eslesir_mi(cls, v: str, info) -> str:
        """Şifre ve şifre tekrarı eşleşiyor mu?"""
        if "sifre" in info.data and v != info.data["sifre"]:
            raise ValueError("Şifreler eşleşmiyor")
        return v

    @field_validator("kullanici_adi")
    @classmethod
    def kullanici_adi_gecerli_mi(cls, v: str) -> str:
        """Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir."""
        if not v.replace("_", "").isalnum():
            raise ValueError(
                "Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir"
            )
        return v.lower()


class KullaniciGuncelle(BaseModel):
    """Kullanıcı güncelleme şeması (kısmi güncelleme)."""
    ad_soyad: Optional[str] = Field(None, min_length=2, max_length=100)
    profil_resmi: Optional[str] = None
    email: Optional[EmailStr] = None


class KullaniciRolGuncelle(BaseModel):
    """Admin tarafından kullanıcı rolü güncelleme."""
    rol: str = Field(..., description="Yeni rol: admin, moderator, kullanici")

    @field_validator("rol")
    @classmethod
    def rol_gecerli_mi(cls, v: str) -> str:
        gecerli_roller = ["admin", "moderator", "kullanici"]
        if v not in gecerli_roller:
            raise ValueError(f"Geçersiz rol. Geçerli roller: {gecerli_roller}")
        return v


class KullaniciYanit(BaseModel):
    """Kullanıcı yanıt şeması (hassas veriler çıkarılmış)."""
    id: uuid.UUID
    email: str
    kullanici_adi: str
    ad_soyad: str
    rol: str
    aktif: bool
    profil_resmi: Optional[str] = None
    olusturulma_tarihi: datetime
    son_giris: Optional[datetime] = None

    model_config = {"from_attributes": True}


class KullaniciGiris(BaseModel):
    """Giriş isteği şeması."""
    email: EmailStr = Field(..., description="E-posta adresi")
    sifre: str = Field(..., description="Şifre")


class TokenYanit(BaseModel):
    """JWT token yanıt şeması."""
    erisim_tokeni: str = Field(..., description="Erişim token'ı")
    yenileme_tokeni: str = Field(..., description="Yenileme token'ı")
    token_tipi: str = Field(default="Bearer", description="Token tipi")
    sure_dakika: int = Field(..., description="Token geçerlilik süresi (dakika)")
    kullanici: KullaniciYanit


class TokenVerisi(BaseModel):
    """Token içindeki veri şeması (JWT payload)."""
    kullanici_id: str
    email: str
    rol: str
    tip: str = "erisim"  # erisim veya yenileme

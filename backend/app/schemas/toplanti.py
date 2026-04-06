"""
Toplantı Şemaları
=================
Toplantı CRUD ve katılımcı izin şemaları.
"""

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class ToplantiOlustur(BaseModel):
    """Toplantı oluşturma isteği."""
    baslik: str = Field(
        ...,
        min_length=3,
        max_length=200,
        description="Toplantı başlığı",
    )
    aciklama: Optional[str] = Field(
        None,
        max_length=1000,
        description="Toplantı açıklaması",
    )
    baslangic_zamani: Optional[datetime] = Field(
        None,
        description="Planlanan başlangıç zamanı",
    )
    bitis_zamani: Optional[datetime] = Field(
        None,
        description="Planlanan bitiş zamanı",
    )
    maks_katilimci: int = Field(
        default=50,
        ge=2,
        le=100,
        description="Maksimum katılımcı sayısı (2-100)",
    )
    sifre: Optional[str] = Field(
        None,
        max_length=50,
        description="Toplantı şifresi (opsiyonel)",
    )
    bekleme_odasi_aktif: bool = Field(
        default=False,
        description="Bekleme odası aktif mi?",
    )

    @field_validator("bitis_zamani")
    @classmethod
    def bitis_baslangictan_sonra_mi(cls, v, info):
        """Bitiş zamanı başlangıçtan sonra olmalı."""
        if v and "baslangic_zamani" in info.data and info.data["baslangic_zamani"]:
            if v <= info.data["baslangic_zamani"]:
                raise ValueError("Bitiş zamanı başlangıç zamanından sonra olmalıdır")
        return v


class ToplantiGuncelle(BaseModel):
    """Toplantı güncelleme isteği (kısmi)."""
    baslik: Optional[str] = Field(None, min_length=3, max_length=200)
    aciklama: Optional[str] = Field(None, max_length=1000)
    baslangic_zamani: Optional[datetime] = None
    bitis_zamani: Optional[datetime] = None
    maks_katilimci: Optional[int] = Field(None, ge=2, le=100)
    sifre: Optional[str] = Field(None, max_length=50)
    bekleme_odasi_aktif: Optional[bool] = None
    durum: Optional[str] = None

    @field_validator("durum")
    @classmethod
    def durum_gecerli_mi(cls, v):
        if v is not None:
            gecerli = ["planlanmis", "aktif", "bitmis", "iptal"]
            if v not in gecerli:
                raise ValueError(f"Geçersiz durum. Geçerli: {gecerli}")
        return v


class KatilimciIzinGuncelle(BaseModel):
    """Katılımcı izinlerini güncelleme (admin/moderatör kullanır)."""
    mikrofon_izni: Optional[bool] = Field(None, description="Mikrofon izni")
    kamera_izni: Optional[bool] = Field(None, description="Kamera izni")
    ekran_paylasim_izni: Optional[bool] = Field(None, description="Ekran paylaşım izni")
    sohbet_izni: Optional[bool] = Field(None, description="Sohbet izni")
    kalici_susturuldu: Optional[bool] = Field(None, description="Kalıcı susturuldu mu?")
    el_kaldirdi: Optional[bool] = Field(None, description="El kaldırdı mı?")
    onayi_bekliyor: Optional[bool] = Field(None, description="Bekleme odası onayı bekliyor mu?")
    rol: Optional[str] = Field(None, description="Katılımcı rolü")

    @field_validator("rol")
    @classmethod
    def rol_gecerli_mi(cls, v):
        if v is not None:
            gecerli = ["sahip", "moderator", "katilimci", "izleyici"]
            if v not in gecerli:
                raise ValueError(f"Geçersiz rol. Geçerli: {gecerli}")
        return v


class KatilimciYanit(BaseModel):
    """Katılımcı bilgi yanıtı."""
    id: uuid.UUID
    kullanici_id: uuid.UUID
    kullanici_adi: str = ""
    ad_soyad: str = ""
    profil_resmi: Optional[str] = None
    rol: str
    mikrofon_izni: bool
    kamera_izni: bool
    ekran_paylasim_izni: bool
    sohbet_izni: bool
    kalici_susturuldu: bool
    el_kaldirdi: bool
    onayi_bekliyor: bool
    aktif: bool
    katilma_zamani: datetime

    model_config = {"from_attributes": True}


class ToplantiYanit(BaseModel):
    """Toplantı detay yanıtı."""
    id: uuid.UUID
    baslik: str
    aciklama: Optional[str] = None
    toplanti_kodu: str
    olusturan_id: uuid.UUID
    olusturan_adi: str = ""
    durum: str
    baslangic_zamani: Optional[datetime] = None
    bitis_zamani: Optional[datetime] = None
    maks_katilimci: int
    bekleme_odasi_aktif: bool
    kayit_aktif: bool
    katilimci_sayisi: int = 0
    katilimcilar: List[KatilimciYanit] = []
    olusturulma_tarihi: datetime

    model_config = {"from_attributes": True}


class ToplantiListeYanit(BaseModel):
    """Toplantı listesi yanıtı (sayfalama ile)."""
    toplantilar: List[ToplantiYanit]
    toplam: int
    sayfa: int
    sayfa_boyutu: int


class ToplantiKatilIsteği(BaseModel):
    """Toplantıya katılma isteği."""
    toplanti_kodu: str = Field(..., description="Toplantı erişim kodu")
    sifre: Optional[str] = Field(None, description="Toplantı şifresi (varsa)")


class MisafirKatilIsteği(BaseModel):
    """Misafir (nickname ile) katılma isteği."""
    rumuz: str = Field(..., min_length=2, max_length=50, description="Kullanılacak rumuz")
    sifre: Optional[str] = Field(None, description="Toplantı şifresi (varsa)")

"""
Mesaj Şemaları
==============
Sohbet mesajları ve WebSocket mesaj şemaları.
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class MesajOlustur(BaseModel):
    """Yeni mesaj oluşturma isteği."""
    icerik: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Mesaj içeriği (1-2000 karakter)",
    )
    tip: str = Field(
        default="metin",
        description="Mesaj tipi: metin, dosya, emoji",
    )


class MesajYanit(BaseModel):
    """Mesaj yanıt şeması."""
    id: uuid.UUID
    toplanti_id: uuid.UUID
    gonderen_id: Optional[uuid.UUID] = None
    gonderen_adi: str = "Sistem"
    gonderen_resmi: Optional[str] = None
    icerik: str
    tip: str
    gonderilme_zamani: datetime

    model_config = {"from_attributes": True}


class WebSocketMesaj(BaseModel):
    """
    WebSocket üzerinden gönderilen/alınan genel mesaj yapısı.
    
    Olay Tipleri:
        - katildi: Kullanıcı toplantıya katıldı
        - ayrildi: Kullanıcı toplantıdan ayrıldı
        - sohbet_mesaji: Sohbet mesajı
        - mikrofon_degisti: Mikrofon durumu değişti
        - kamera_degisti: Kamera durumu değişti
        - ekran_paylasimi_basladi: Ekran paylaşımı başladı
        - ekran_paylasimi_bitti: Ekran paylaşımı bitti
        - izin_guncellendi: Katılımcı izinleri güncellendi
        - kullanici_atildi: Kullanıcı toplantıdan atıldı
        - rol_degisti: Kullanıcı rolü değişti
        - sinyal_teklif: WebRTC teklif sinyali
        - sinyal_yanit: WebRTC yanıt sinyali
        - sinyal_aday: WebRTC ICE aday sinyali
        - toplanti_bitti: Toplantı sonlandırıldı
        - hata: Hata mesajı
    """
    olay: str = Field(..., description="Olay tipi")
    veri: Any = Field(default=None, description="Olay verisi")
    gonderen_id: Optional[str] = Field(None, description="Gönderen kullanıcı ID")
    hedef_id: Optional[str] = Field(None, description="Hedef kullanıcı ID")
    toplanti_id: Optional[str] = Field(None, description="Toplantı ID")
    zaman: Optional[str] = Field(None, description="Mesaj zamanı")


class SinyalMesaji(BaseModel):
    """WebRTC sinyal mesajı."""
    tip: str = Field(
        ...,
        description="Sinyal tipi: teklif, yanit, aday",
    )
    veri: Any = Field(..., description="SDP veya ICE aday verisi")
    hedef_id: str = Field(..., description="Hedef kullanıcı ID")

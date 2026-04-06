"""
Uygulama Yapılandırması
=======================
Tüm ortam değişkenlerini merkezi olarak yönetir.
pydantic-settings kullanılarak tip güvenli yapılandırma sağlanır.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Ayarlar(BaseSettings):
    """
    Ana yapılandırma sınıfı.
    .env dosyasından veya ortam değişkenlerinden otomatik yüklenir.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---------- Genel ----------
    APP_ADI: str = "ToplantiUygulamasi"
    APP_SURUMU: str = "1.0.0"
    ORTAM: str = "gelistirme"  # gelistirme | test | uretim
    DEBUG: bool = True

    # ---------- Veritabanı ----------
    POSTGRES_SUNUCU: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_KULLANICI: str = "toplanti_admin"
    POSTGRES_SIFRE: str = "guclu_sifre_123"
    POSTGRES_DB: str = "toplanti_db"
    VERITABANI_URL: str = ""

    @property
    def veritabani_baglanti_url(self) -> str:
        """Veritabanı bağlantı URL'sini oluşturur ve Railway uyumlu hale getirir."""
        url = self.VERITABANI_URL
        if not url:
            url = (
                f"postgresql://{self.POSTGRES_KULLANICI}:{self.POSTGRES_SIFRE}"
                f"@{self.POSTGRES_SUNUCU}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        
        # Railway'den gelen 'postgresql://' kısmını 'postgresql+asyncpg://' yapıyoruz
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def veritabani_sync_url(self) -> str:
        """Alembic için senkron veritabanı URL'si."""
        return self.veritabani_baglanti_url.replace(
            "postgresql+asyncpg", "postgresql+psycopg2"
        )

    # ---------- Redis ----------
    REDIS_SUNUCU: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_SIFRE: str = ""
    REDIS_DB: int = 0
    REDIS_URL: str = ""

    @property
    def redis_baglanti_url(self) -> str:
        """Redis bağlantı URL'sini oluşturur."""
        if self.REDIS_URL:
            return self.REDIS_URL
        sifre_kismi = f":{self.REDIS_SIFRE}@" if self.REDIS_SIFRE else ""
        return f"redis://{sifre_kismi}{self.REDIS_SUNUCU}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # ---------- JWT & Güvenlik ----------
    JWT_GIZLI_ANAHTAR: str = "degistirin-bu-anahtari-uretimde"
    JWT_ALGORITMA: str = "HS256"
    ERISIM_TOKEN_SURESI_DAKIKA: int = 30
    YENILEME_TOKEN_SURESI_GUN: int = 7

    # ---------- CORS ----------
    IZIN_VERILEN_KAYNAKLAR: str = "http://localhost:3000"

    @property
    def cors_kaynaklari(self) -> List[str]:
        """CORS için izin verilen kaynakları liste olarak döndürür."""
        return [
            kaynak.strip()
            for kaynak in self.IZIN_VERILEN_KAYNAKLAR.split(",")
            if kaynak.strip()
        ]

    # ---------- Mediasoup ----------
    MEDIASOUP_DINLEME_IP: str = "0.0.0.0"
    MEDIASOUP_DUYURULAN_IP: str = "127.0.0.1"
    MEDIASOUP_PORT: int = 3478
    MEDIASOUP_WS_PORT: int = 4443

    # ---------- TURN/STUN ----------
    TURN_SUNUCU: str = "turn:localhost:3478"
    TURN_KULLANICI: str = "toplanti_turn"
    TURN_SIFRE: str = "turn_sifre_123"
    STUN_SUNUCU: str = "stun:stun.l.google.com:19302"

    # ---------- Backend ----------
    BACKEND_SUNUCU: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    @property
    def uretim_modu(self) -> bool:
        """Üretim modunda olup olmadığını kontrol eder."""
        return self.ORTAM == "uretim"

    @property
    def ice_sunuculari(self) -> list:
        """WebRTC ICE sunucularını döndürür (Aşırı Uyumluluk Modu)."""
        # Pinggy ve güvenlik duvarlarını aşmak için OpenRelay (Relay) sunucusunu zorluyoruz.
        return [
            {"urls": "stun:stun.l.google.com:19302"},
            {
                "urls": "turn:openrelay.metered.ca:443?transport=tcp",
                "username": "openrelayproject",
                "credential": "openrelayproject"
            }
        ]


@lru_cache()
def ayarlari_getir() -> Ayarlar:
    """
    Yapılandırma tekil örneğini döndürür.
    lru_cache sayesinde her çağrıda yeniden oluşturulmaz.
    """
    return Ayarlar()

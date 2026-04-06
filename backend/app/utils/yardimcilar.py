"""
Yardımcı Fonksiyonlar
=====================
Proje genelinde kullanılan yardımcı araçlar.
"""

import random
import string
import uuid
from datetime import datetime, timezone


def toplanti_kodu_olustur(uzunluk: int = 10) -> str:
    """
    Benzersiz toplantı kodu oluşturur.
    Format: xxx-xxxx-xxx (Google Meet tarzı)
    
    Örnek: abc-defg-hij
    """
    harfler = string.ascii_lowercase
    parca1 = "".join(random.choices(harfler, k=3))
    parca2 = "".join(random.choices(harfler, k=4))
    parca3 = "".join(random.choices(harfler, k=3))
    return f"{parca1}-{parca2}-{parca3}"


def kisaltilmis_id() -> str:
    """Kısa benzersiz ID oluşturur (8 karakter)."""
    return uuid.uuid4().hex[:8]


def simdi() -> datetime:
    """UTC zaman damgası döndürür."""
    return datetime.now(timezone.utc)


def zaman_formatla(dt: datetime | None) -> str | None:
    """Datetime nesnesini ISO format stringe çevirir."""
    if dt is None:
        return None
    return dt.isoformat()


def metin_kisalt(metin: str, maks: int = 100) -> str:
    """Metni belirli uzunlukta kısaltır."""
    if len(metin) <= maks:
        return metin
    return metin[: maks - 3] + "..."


def basarili_yanit(veri: dict | list | None = None, mesaj: str = "Başarılı") -> dict:
    """Standart başarılı API yanıt formatı."""
    yanit = {
        "basarili": True,
        "mesaj": mesaj,
    }
    if veri is not None:
        yanit["veri"] = veri
    return yanit


def sayfalama_bilgisi(
    toplam: int,
    sayfa: int,
    boyut: int,
) -> dict:
    """Sayfalama meta bilgisi oluşturur."""
    toplam_sayfa = (toplam + boyut - 1) // boyut  # Yukarı yuvarlama
    return {
        "toplam_kayit": toplam,
        "mevcut_sayfa": sayfa,
        "sayfa_boyutu": boyut,
        "toplam_sayfa": toplam_sayfa,
        "sonraki_var": sayfa < toplam_sayfa,
        "onceki_var": sayfa > 1,
    }


def redis_anahtar(*parcalar: str) -> str:
    """Redis anahtar adı oluşturur (namespace ile)."""
    return ":".join(["toplanti_app", *parcalar])


def ws_olay_olustur(
    olay: str,
    veri: dict | None = None,
    gonderen_id: str | None = None,
    toplanti_id: str | None = None,
) -> dict:
    """Standart WebSocket olay mesajı oluşturur."""
    return {
        "olay": olay,
        "veri": veri or {},
        "gonderen_id": gonderen_id,
        "toplanti_id": toplanti_id,
        "zaman": simdi().isoformat(),
    }

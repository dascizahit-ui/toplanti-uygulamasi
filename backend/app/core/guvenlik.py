"""
Güvenlik Modülü
===============
JWT token yönetimi ve şifre hashleme işlemleri.
Tüm kimlik doğrulama altyapısı bu modülde bulunur.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import ayarlari_getir

ayarlar = ayarlari_getir()

# --- Şifre Hashleme ---
# bcrypt algoritması ile otomatik salt eklenir
sifre_konteksti = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def sifre_hashle(sifre: str) -> str:
    """Düz metin şifreyi bcrypt ile hashler."""
    return sifre_konteksti.hash(sifre)


def sifre_dogrula(duz_sifre: str, hash_sifre: str) -> bool:
    """Düz metin şifreyi hash ile karşılaştırır."""
    return sifre_konteksti.verify(duz_sifre, hash_sifre)


# --- JWT Token İşlemleri ---

def erisim_tokeni_olustur(
    kullanici_id: uuid.UUID,
    email: str,
    rol: str,
    ek_veriler: Optional[dict] = None,
) -> str:
    """
    Erişim token'ı oluşturur.
    
    Args:
        kullanici_id: Kullanıcı UUID
        email: Kullanıcı e-postası
        rol: Kullanıcı rolü
        ek_veriler: Token'a eklenecek ek veriler
    
    Returns:
        JWT token string
    """
    bitis = datetime.now(timezone.utc) + timedelta(
        minutes=ayarlar.ERISIM_TOKEN_SURESI_DAKIKA
    )
    
    payload = {
        "sub": str(kullanici_id),
        "email": email,
        "rol": rol,
        "tip": "erisim",
        "exp": bitis,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # Token benzersiz kimliği
    }
    
    if ek_veriler:
        payload.update(ek_veriler)
    
    return jwt.encode(
        payload,
        ayarlar.JWT_GIZLI_ANAHTAR,
        algorithm=ayarlar.JWT_ALGORITMA,
    )


def yenileme_tokeni_olustur(
    kullanici_id: uuid.UUID,
    email: str,
    rol: str,
) -> str:
    """
    Yenileme token'ı oluşturur.
    Erişim token'ından daha uzun ömürlüdür.
    """
    bitis = datetime.now(timezone.utc) + timedelta(
        days=ayarlar.YENILEME_TOKEN_SURESI_GUN
    )
    
    payload = {
        "sub": str(kullanici_id),
        "email": email,
        "rol": rol,
        "tip": "yenileme",
        "exp": bitis,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }
    
    return jwt.encode(
        payload,
        ayarlar.JWT_GIZLI_ANAHTAR,
        algorithm=ayarlar.JWT_ALGORITMA,
    )


def token_coz(token: str) -> Optional[dict]:
    """
    JWT token'ını çözer ve payload'ı döndürür.
    
    Args:
        token: JWT token string
    
    Returns:
        Token payload dict veya None (geçersizse)
    """
    try:
        payload = jwt.decode(
            token,
            ayarlar.JWT_GIZLI_ANAHTAR,
            algorithms=[ayarlar.JWT_ALGORITMA],
        )
        return payload
    except JWTError:
        return None


def token_gecerli_mi(token: str, beklenen_tip: str = "erisim") -> bool:
    """
    Token'ın geçerli olup olmadığını kontrol eder.
    
    Args:
        token: JWT token
        beklenen_tip: Beklenen token tipi (erisim/yenileme)
    """
    payload = token_coz(token)
    if not payload:
        return False
    
    # Token tipi kontrolü
    if payload.get("tip") != beklenen_tip:
        return False
    
    # Süre kontrolü (jose kütüphanesi otomatik yapar ama ek kontrol)
    bitis = payload.get("exp")
    if bitis and datetime.fromtimestamp(bitis, tz=timezone.utc) < datetime.now(timezone.utc):
        return False
    
    return True

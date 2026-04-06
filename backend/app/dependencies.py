"""
Bağımlılık Enjeksiyonları (Düzeltilmiş)
"""
import uuid
from typing import Optional

from fastapi import Depends, Header, WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.guvenlik import token_coz
from app.core.hata_yonetimi import YetkilendirmeHatasi, YetkisizErisimHatasi, BulunamadiHatasi
from app.database import veritabani_oturumu_getir
from app.models.kullanici import Kullanici, KullaniciRolu


async def mevcut_kullanici(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
) -> Kullanici:
    if not authorization:
        raise YetkilendirmeHatasi("Yetkilendirme başlığı eksik")

    parcalar = authorization.split()
    if len(parcalar) != 2 or parcalar[0].lower() != "bearer":
        raise YetkilendirmeHatasi("Geçersiz format. 'Bearer <token>' bekleniyor")

    payload = token_coz(parcalar[1])
    if not payload:
        raise YetkilendirmeHatasi("Geçersiz veya süresi dolmuş token")
    if payload.get("tip") != "erisim":
        raise YetkilendirmeHatasi("Geçersiz token tipi")

    kullanici_id = payload.get("sub")
    if not kullanici_id:
        raise YetkilendirmeHatasi("Token'da kullanıcı bilgisi yok")

    # Sadece kullanıcıyı getir, ilişkileri YÜKLEME
    sorgu = select(Kullanici).where(Kullanici.id == uuid.UUID(kullanici_id))
    sonuc = await db.execute(sorgu)
    kullanici = sonuc.scalar_one_or_none()

    if not kullanici:
        raise BulunamadiHatasi("Kullanıcı")
    if not kullanici.aktif:
        raise YetkilendirmeHatasi("Hesabınız devre dışı")

    return kullanici


async def admin_gerekli(kullanici: Kullanici = Depends(mevcut_kullanici)) -> Kullanici:
    if kullanici.rol != KullaniciRolu.ADMIN:
        raise YetkisizErisimHatasi("Admin yetkisi gerekli")
    return kullanici


async def moderator_gerekli(kullanici: Kullanici = Depends(mevcut_kullanici)) -> Kullanici:
    if kullanici.rol not in (KullaniciRolu.ADMIN, KullaniciRolu.MODERATOR):
        raise YetkisizErisimHatasi("Admin veya moderatör yetkisi gerekli")
    return kullanici


async def websocket_kimlik_dogrula(websocket: WebSocket, db: AsyncSession) -> Optional[Kullanici]:
    token = websocket.query_params.get("token")
    if not token:
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        return None

    payload = token_coz(token)
    if not payload or payload.get("tip") != "erisim":
        return None

    kullanici_id = payload.get("sub")
    if not kullanici_id:
        return None

    sorgu = select(Kullanici).where(Kullanici.id == uuid.UUID(kullanici_id), Kullanici.aktif == True)
    sonuc = await db.execute(sorgu)
    return sonuc.scalar_one_or_none()


class SayfalamaParametreleri:
    def __init__(self, sayfa: int = 1, boyut: int = 20):
        self.sayfa = max(1, sayfa)
        self.boyut = min(max(1, boyut), 100)
        self.atlama = (self.sayfa - 1) * self.boyut

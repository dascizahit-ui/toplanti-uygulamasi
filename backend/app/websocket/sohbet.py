"""
Sohbet Modülü (Düzeltilmiş)
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from loguru import logger
from sqlalchemy import select

from app.database import AsyncOturumFabrikasi
from app.models.mesaj import Mesaj, MesajTipi
from app.websocket.yonetici import baglanti_yoneticisi
from app.services.redis_servisi import RedisServisi


class SohbetYoneticisi:
    def __init__(self):
        self.redis = RedisServisi()

    async def mesaj_isle(
        self, toplanti_id: str, kullanici_id: str, kullanici_bilgi: dict, icerik: str, tip: str = "metin"
    ) -> Optional[dict]:
        icerik = icerik.strip()
        if not icerik or len(icerik) > 2000:
            return None

        mesaj_id = uuid.uuid4()
        zaman = datetime.now(timezone.utc)

        mesaj_veri = {
            "id": str(mesaj_id),
            "toplanti_id": toplanti_id,
            "gonderen_id": kullanici_id,
            "gonderen_adi": kullanici_bilgi.get("ad_soyad", "Bilinmeyen"),
            "gonderen_resmi": kullanici_bilgi.get("profil_resmi"),
            "icerik": icerik,
            "tip": tip,
            "gonderilme_zamani": zaman.isoformat(),
        }

        # 1. Odadaki herkese ANINDA gönder
        await baglanti_yoneticisi.odaya_yayinla_json(
            toplanti_id, "sohbet_mesaji", mesaj_veri, gonderen_id=kullanici_id,
        )

        # 2. Arka planda veritabanına kaydet
        try:
            async with AsyncOturumFabrikasi() as db:
                yeni = Mesaj(
                    id=mesaj_id, toplanti_id=uuid.UUID(toplanti_id),
                    gonderen_id=uuid.UUID(kullanici_id), icerik=icerik,
                    tip=MesajTipi.METIN, gonderilme_zamani=zaman,
                )
                db.add(yeni)
                await db.commit()
        except Exception as e:
            logger.error(f"Mesaj kaydetme hatası: {e}")

        return mesaj_veri

        return mesaj_veri

    async def sistem_mesaji_gonder(self, toplanti_id: str, icerik: str) -> dict:
        mesaj_id = uuid.uuid4()
        zaman = datetime.now(timezone.utc)

        try:
            async with AsyncOturumFabrikasi() as db:
                yeni = Mesaj(
                    id=mesaj_id, toplanti_id=uuid.UUID(toplanti_id),
                    gonderen_id=None, icerik=icerik,
                    tip=MesajTipi.SISTEM, gonderilme_zamani=zaman,
                )
                db.add(yeni)
                await db.commit()
        except Exception as e:
            logger.error(f"Sistem mesajı kaydetme hatası: {e}")

        mesaj_veri = {
            "id": str(mesaj_id), "toplanti_id": toplanti_id,
            "gonderen_id": None, "gonderen_adi": "Sistem",
            "icerik": icerik, "tip": "sistem",
            "gonderilme_zamani": zaman.isoformat(),
        }

        await baglanti_yoneticisi.odaya_yayinla_json(toplanti_id, "sohbet_mesaji", mesaj_veri)
        return mesaj_veri


sohbet_yoneticisi = SohbetYoneticisi()

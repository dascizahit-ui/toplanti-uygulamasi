"""
Redis room state service.
"""

from typing import Optional

from loguru import logger

from app.core.redis import (
    kanal_yayinla,
    oda_durumu_getir,
    oda_durumu_kaydet,
    oda_durumu_sil,
    redis_getir,
)
from app.utils.yardimcilar import simdi, ws_olay_olustur


class RedisServisi:
    """Meeting room state, media state and heartbeat helpers."""

    ODA_PREFIX = "oda"
    KATILIMCI_PREFIX = "katilimci"
    CEVRIMICI_PREFIX = "cevrimici"
    MEDYA_PREFIX = "medya"

    async def oda_olustur(self, toplanti_id: str, bilgi: dict) -> bool:
        try:
            await oda_durumu_kaydet(toplanti_id, "bilgi", bilgi)
            await oda_durumu_kaydet(toplanti_id, "katilimcilar", {})
            await oda_durumu_kaydet(toplanti_id, "medya_durumlari", {})
            logger.info(f"Redis oda olusturuldu: {toplanti_id}")
            return True
        except Exception as e:
            logger.error(f"Oda olusturma hatasi: {e}")
            return False

    async def oda_sil(self, toplanti_id: str) -> bool:
        """Remove room hash, online set and per-user heartbeats."""
        try:
            await oda_durumu_sil(toplanti_id)
            r = await redis_getir()
            await r.delete(f"{self.CEVRIMICI_PREFIX}:{toplanti_id}")
            async for anahtar in r.scan_iter(match=f"heartbeat:{toplanti_id}:*"):
                await r.delete(anahtar)
            logger.info(f"Redis oda silindi: {toplanti_id}")
            return True
        except Exception as e:
            logger.error(f"Oda silme hatasi: {e}")
            return False

    async def oda_bilgisi_getir(self, toplanti_id: str) -> Optional[dict]:
        return await oda_durumu_getir(toplanti_id, "bilgi")

    async def katilimci_ekle(
        self,
        toplanti_id: str,
        kullanici_id: str,
        kullanici_bilgi: dict,
    ) -> bool:
        try:
            katilimcilar = await oda_durumu_getir(toplanti_id, "katilimcilar") or {}
            katilimcilar[kullanici_id] = {
                **kullanici_bilgi,
                "katilma_zamani": simdi().isoformat(),
                "aktif": True,
            }
            await oda_durumu_kaydet(toplanti_id, "katilimcilar", katilimcilar)

            r = await redis_getir()
            await r.sadd(f"{self.CEVRIMICI_PREFIX}:{toplanti_id}", kullanici_id)
            await r.expire(f"{self.CEVRIMICI_PREFIX}:{toplanti_id}", 86400)

            logger.info(f"Katilimci eklendi: {kullanici_id} -> Oda {toplanti_id}")
            return True
        except Exception as e:
            logger.error(f"Katilimci ekleme hatasi: {e}")
            return False

    async def katilimci_guncelle(
        self,
        toplanti_id: str,
        kullanici_id: str,
        guncelleme: dict,
    ) -> bool:
        try:
            katilimcilar = await oda_durumu_getir(toplanti_id, "katilimcilar") or {}
            if kullanici_id in katilimcilar:
                katilimcilar[kullanici_id].update(guncelleme)
                await oda_durumu_kaydet(toplanti_id, "katilimcilar", katilimcilar)
                return True
            return False
        except Exception as e:
            logger.error(f"Katilimci guncelleme hatasi: {e}")
            return False

    async def katilimci_cikar(
        self,
        toplanti_id: str,
        kullanici_id: str,
    ) -> bool:
        try:
            katilimcilar = await oda_durumu_getir(toplanti_id, "katilimcilar") or {}
            if kullanici_id in katilimcilar:
                del katilimcilar[kullanici_id]
                await oda_durumu_kaydet(toplanti_id, "katilimcilar", katilimcilar)

            r = await redis_getir()
            await r.srem(f"{self.CEVRIMICI_PREFIX}:{toplanti_id}", kullanici_id)
            await r.delete(f"heartbeat:{toplanti_id}:{kullanici_id}")

            medya = await oda_durumu_getir(toplanti_id, "medya_durumlari") or {}
            if kullanici_id in medya:
                del medya[kullanici_id]
                await oda_durumu_kaydet(toplanti_id, "medya_durumlari", medya)

            logger.info(f"Katilimci cikarildi: {kullanici_id} <- Oda {toplanti_id}")
            return True
        except Exception as e:
            logger.error(f"Katilimci cikarma hatasi: {e}")
            return False

    async def katilimci_listesi(self, toplanti_id: str) -> dict:
        return await oda_durumu_getir(toplanti_id, "katilimcilar") or {}

    async def cevrimici_sayisi(self, toplanti_id: str) -> int:
        try:
            r = await redis_getir()
            return await r.scard(f"{self.CEVRIMICI_PREFIX}:{toplanti_id}")
        except Exception:
            return 0

    async def medya_durumu_guncelle(
        self,
        toplanti_id: str,
        kullanici_id: str,
        durum: dict,
    ) -> bool:
        try:
            medya = await oda_durumu_getir(toplanti_id, "medya_durumlari") or {}
            mevcut = medya.get(kullanici_id, {})
            mevcut.update(durum)
            medya[kullanici_id] = mevcut
            await oda_durumu_kaydet(toplanti_id, "medya_durumlari", medya)
            return True
        except Exception as e:
            logger.error(f"Medya durumu guncelleme hatasi: {e}")
            return False

    async def medya_durumu_getir(self, toplanti_id: str, kullanici_id: str) -> dict:
        medya = await oda_durumu_getir(toplanti_id, "medya_durumlari") or {}
        return medya.get(
            kullanici_id,
            {
                "mikrofon": False,
                "kamera": False,
                "ekran_paylasimi": False,
            },
        )

    async def medya_durumlari_getir(self, toplanti_id: str) -> dict:
        return await oda_durumu_getir(toplanti_id, "medya_durumlari") or {}

    async def odaya_yayinla(
        self,
        toplanti_id: str,
        olay: str,
        veri: dict,
        gonderen_id: Optional[str] = None,
    ) -> bool:
        kanal = f"toplanti:{toplanti_id}"
        mesaj = ws_olay_olustur(
            olay=olay,
            veri=veri,
            gonderen_id=gonderen_id,
            toplanti_id=toplanti_id,
        )
        return await kanal_yayinla(kanal, mesaj)

    async def sistem_mesaji_yayinla(self, toplanti_id: str, mesaj_metni: str) -> bool:
        return await self.odaya_yayinla(
            toplanti_id=toplanti_id,
            olay="sistem_mesaji",
            veri={"mesaj": mesaj_metni},
        )

    async def heartbeat_guncelle(self, toplanti_id: str, kullanici_id: str) -> bool:
        try:
            r = await redis_getir()
            await r.setex(f"heartbeat:{toplanti_id}:{kullanici_id}", 60, simdi().isoformat())
            return True
        except Exception:
            return False

    async def kullanici_canli_mi(self, toplanti_id: str, kullanici_id: str) -> bool:
        try:
            r = await redis_getir()
            return await r.exists(f"heartbeat:{toplanti_id}:{kullanici_id}") > 0
        except Exception:
            return False

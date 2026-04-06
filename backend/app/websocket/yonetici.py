"""
WebSocket connection manager.
"""

import asyncio
from collections import defaultdict
from typing import Any, Dict, Optional

from fastapi import WebSocket
from loguru import logger

from app.utils.yardimcilar import simdi


class BaglantiYoneticisi:
    """Room-scoped WebSocket registry and broadcast helper."""

    def __init__(self):
        self.odalar: Dict[str, Dict[str, WebSocket]] = defaultdict(dict)
        self.kullanici_bilgileri: Dict[str, dict] = {}
        self._kilit = asyncio.Lock()

    async def baglan(
        self,
        websocket: WebSocket,
        oda_id: str,
        kullanici_id: str,
        bilgi: dict | None = None,
    ):
        """Attach a user to a room and close any previous socket for that user."""
        await websocket.accept()

        eski_ws = None
        async with self._kilit:
            onceki_oda = self.kullanici_bilgileri.get(kullanici_id, {}).get("oda")
            if not onceki_oda:
                for mevcut_oda, katilimcilar in self.odalar.items():
                    if kullanici_id in katilimcilar:
                        onceki_oda = mevcut_oda
                        break

            if onceki_oda and kullanici_id in self.odalar.get(onceki_oda, {}):
                eski_ws = self.odalar[onceki_oda].pop(kullanici_id)
                if not self.odalar[onceki_oda]:
                    del self.odalar[onceki_oda]

            if oda_id not in self.odalar:
                self.odalar[oda_id] = {}

            self.odalar[oda_id][kullanici_id] = websocket
            self.kullanici_bilgileri[kullanici_id] = {
                **(bilgi or {}),
                "oda": oda_id,
            }

        if eski_ws and eski_ws is not websocket:
            try:
                await eski_ws.close(code=4001)
            except Exception:
                pass

        logger.info(
            f"WS Baglanti: {(bilgi or {}).get('ad_soyad', '')} -> Oda {oda_id} "
            f"(Toplam: {len(self.odalar[oda_id])} kisi)"
        )

    async def kopar(
        self,
        toplanti_id: str,
        kullanici_id: str,
        websocket: Optional[WebSocket] = None,
    ):
        """Detach a socket from a room.

        If `websocket` is provided, cleanup only happens when it is still the
        currently registered socket. This prevents an old socket from removing a
        newer connection for the same user.
        """
        kapatilacak_ws = None
        async with self._kilit:
            mevcut_ws = self.odalar.get(toplanti_id, {}).get(kullanici_id)
            if mevcut_ws and (websocket is None or mevcut_ws is websocket):
                kapatilacak_ws = self.odalar[toplanti_id].pop(kullanici_id)
                if not self.odalar[toplanti_id]:
                    del self.odalar[toplanti_id]

            bilgi = self.kullanici_bilgileri.get(kullanici_id)
            if bilgi and bilgi.get("oda") == toplanti_id:
                self.kullanici_bilgileri.pop(kullanici_id, None)

        if kapatilacak_ws:
            try:
                await kapatilacak_ws.close()
            except Exception:
                pass

        logger.info(f"WS Kopma: {kullanici_id} <- Oda {toplanti_id}")

    async def kisisel_gonder(self, kullanici_id: str, mesaj: dict) -> bool:
        """Send a message to a single user."""
        bilgi = self.kullanici_bilgileri.get(kullanici_id)
        if not bilgi:
            return False

        toplanti_id = bilgi.get("oda")
        if not toplanti_id:
            return False

        ws = self.odalar.get(toplanti_id, {}).get(kullanici_id)
        if not ws:
            return False

        try:
            await ws.send_json(mesaj)
            return True
        except Exception as e:
            logger.warning(f"Kisisel mesaj gonderilemedi: {kullanici_id} - {e}")
            await self.kopar(toplanti_id, kullanici_id, ws)
            return False

    async def _guvenli_gonder(
        self,
        toplanti_id: str,
        kullanici_id: str,
        websocket: WebSocket,
        mesaj: dict,
    ):
        """Send a message and cleanup only the failing socket."""
        try:
            await websocket.send_json(mesaj)
        except Exception as e:
            logger.warning(f"Mesaj iletilemedi: {kullanici_id} - {e}")
            await self.kopar(toplanti_id, kullanici_id, websocket)

    async def odaya_yayinla(
        self,
        toplanti_id: str,
        mesaj: dict,
        haric_tut: Optional[str] = None,
    ):
        """Broadcast to a room in parallel."""
        baglananlar = self.odalar.get(toplanti_id, {})
        if not baglananlar:
            return

        gorevler = []
        for kid, ws in baglananlar.items():
            if kid == haric_tut:
                continue
            gorevler.append(self._guvenli_gonder(toplanti_id, kid, ws, mesaj))

        if gorevler:
            await asyncio.gather(*gorevler)

    async def odaya_yayinla_json(
        self,
        toplanti_id: str,
        olay: str,
        veri: Any = None,
        gonderen_id: Optional[str] = None,
        haric_tut: Optional[str] = None,
    ):
        """Broadcast a standard event envelope."""
        mesaj = {
            "olay": olay,
            "veri": veri or {},
            "gonderen_id": gonderen_id,
            "toplanti_id": toplanti_id,
            "zaman": simdi().isoformat(),
        }
        await self.odaya_yayinla(toplanti_id, mesaj, haric_tut)

    def oda_katilimcilari(self, toplanti_id: str) -> list[str]:
        return list(self.odalar.get(toplanti_id, {}).keys())

    def oda_katilimci_sayisi(self, toplanti_id: str) -> int:
        return len(self.odalar.get(toplanti_id, {}))

    def kullanici_bagli_mi(self, kullanici_id: str) -> bool:
        return kullanici_id in self.kullanici_bilgileri

    def kullanici_odasi(self, kullanici_id: str) -> Optional[str]:
        bilgi = self.kullanici_bilgileri.get(kullanici_id)
        return bilgi.get("oda") if bilgi else None

    def tum_oda_bilgileri(self) -> dict:
        return {
            oda_id: {
                "katilimci_sayisi": len(katilimcilar),
                "katilimcilar": list(katilimcilar.keys()),
            }
            for oda_id, katilimcilar in self.odalar.items()
        }

    @property
    def toplam_baglanti_sayisi(self) -> int:
        return sum(len(katilimcilar) for katilimcilar in self.odalar.values())


baglanti_yoneticisi = BaglantiYoneticisi()

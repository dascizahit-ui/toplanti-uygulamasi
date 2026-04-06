"""
Medya Servisi
=============
Mediasoup SFU sunucusuyla iletişim ve WebRTC medya yönetimi.
Python backend, mediasoup Node.js sunucusuna HTTP/WebSocket
üzerinden komut gönderir.
"""

from typing import Any, Dict, List, Optional

import httpx
from loguru import logger

from app.config import ayarlari_getir

ayarlar = ayarlari_getir()


class MedyaServisi:
    """
    Mediasoup SFU sunucusuyla iletişim servisi.
    
    Mimari:
        Python Backend ←→ (HTTP API) ←→ Mediasoup Node.js
        
    Sorumluluklar:
        - Oda oluşturma/silme
        - Transport oluşturma (WebRTC bağlantı kanalı)
        - Producer/Consumer yönetimi (medya akışları)
        - Router kapasiteleri (codec bilgileri)
    """

    def __init__(self):
        self.mediasoup_url = (
            f"http://localhost:{ayarlar.MEDIASOUP_WS_PORT}"
        )
        self.http_istemci = httpx.AsyncClient(timeout=10.0)

    async def kapat(self):
        """HTTP istemcisini kapatır."""
        await self.http_istemci.aclose()

    # =====================
    # ODA İŞLEMLERİ
    # =====================

    async def oda_olustur(self, toplanti_id: str) -> Optional[dict]:
        """
        Mediasoup'ta yeni bir oda (Router) oluşturur.
        
        Returns:
            Router bilgileri (rtpCapabilities dahil)
        """
        try:
            yanit = await self.http_istemci.post(
                f"{self.mediasoup_url}/api/oda/olustur",
                json={"toplanti_id": toplanti_id},
            )
            yanit.raise_for_status()
            veri = yanit.json()
            logger.info(f"Mediasoup oda oluşturuldu: {toplanti_id}")
            return veri
        except httpx.HTTPError as e:
            logger.error(f"Mediasoup oda oluşturma hatası: {e}")
            return None

    async def oda_sil(self, toplanti_id: str) -> bool:
        """Mediasoup'taki odayı siler."""
        try:
            yanit = await self.http_istemci.post(
                f"{self.mediasoup_url}/api/oda/sil",
                json={"toplanti_id": toplanti_id},
            )
            yanit.raise_for_status()
            logger.info(f"Mediasoup oda silindi: {toplanti_id}")
            return True
        except httpx.HTTPError as e:
            logger.error(f"Mediasoup oda silme hatası: {e}")
            return False

    async def router_yetenekleri(
        self, toplanti_id: str
    ) -> Optional[dict]:
        """
        Odanın RTP yeteneklerini (codec bilgileri) döndürür.
        İstemci tarafında device.load() için gereklidir.
        """
        try:
            yanit = await self.http_istemci.get(
                f"{self.mediasoup_url}/api/oda/{toplanti_id}/rtp-yetenekler",
            )
            yanit.raise_for_status()
            return yanit.json()
        except httpx.HTTPError as e:
            logger.error(f"RTP yetenekleri getirme hatası: {e}")
            return None

    # =====================
    # TRANSPORT İŞLEMLERİ
    # =====================

    async def transport_olustur(
        self,
        toplanti_id: str,
        kullanici_id: str,
        yon: str = "gonderim",  # "gonderim" veya "alim"
    ) -> Optional[dict]:
        """
        WebRTC Transport oluşturur.
        
        Args:
            toplanti_id: Toplantı ID
            kullanici_id: Kullanıcı ID
            yon: "gonderim" (produce) veya "alim" (consume)
            
        Returns:
            Transport parametreleri (id, iceParameters, iceCandidates, dtlsParameters)
        """
        try:
            yanit = await self.http_istemci.post(
                f"{self.mediasoup_url}/api/transport/olustur",
                json={
                    "toplanti_id": toplanti_id,
                    "kullanici_id": kullanici_id,
                    "yon": yon,
                },
            )
            yanit.raise_for_status()
            veri = yanit.json()
            logger.debug(
                f"Transport oluşturuldu: {yon} | "
                f"Kullanıcı: {kullanici_id} | Oda: {toplanti_id}"
            )
            return veri
        except httpx.HTTPError as e:
            logger.error(f"Transport oluşturma hatası: {e}")
            return None

    async def transport_bagla(
        self,
        toplanti_id: str,
        kullanici_id: str,
        transport_id: str,
        dtls_parametreleri: dict,
    ) -> bool:
        """
        Transport'u DTLS parametreleriyle bağlar.
        İstemci tarafında transport.connect() sonrası çağrılır.
        """
        try:
            yanit = await self.http_istemci.post(
                f"{self.mediasoup_url}/api/transport/bagla",
                json={
                    "toplanti_id": toplanti_id,
                    "kullanici_id": kullanici_id,
                    "transport_id": transport_id,
                    "dtls_parametreleri": dtls_parametreleri,
                },
            )
            yanit.raise_for_status()
            return True
        except httpx.HTTPError as e:
            logger.error(f"Transport bağlama hatası: {e}")
            return False

    # =====================
    # PRODUCER İŞLEMLERİ
    # =====================

    async def uretici_olustur(
        self,
        toplanti_id: str,
        kullanici_id: str,
        transport_id: str,
        tur: str,  # "ses" veya "video"
        rtp_parametreleri: dict,
    ) -> Optional[dict]:
        """
        Medya üreticisi (Producer) oluşturur.
        Kullanıcının ses/video akışını sunucuya gönderir.
        
        Returns:
            Producer bilgileri (id)
        """
        try:
            yanit = await self.http_istemci.post(
                f"{self.mediasoup_url}/api/uretici/olustur",
                json={
                    "toplanti_id": toplanti_id,
                    "kullanici_id": kullanici_id,
                    "transport_id": transport_id,
                    "tur": tur,
                    "rtp_parametreleri": rtp_parametreleri,
                },
            )
            yanit.raise_for_status()
            return yanit.json()
        except httpx.HTTPError as e:
            logger.error(f"Üretici oluşturma hatası: {e}")
            return None

    async def uretici_duraklat(
        self,
        toplanti_id: str,
        uretici_id: str,
    ) -> bool:
        """Üreticiyi duraklatır (mikrofon/kamera kapatma)."""
        try:
            yanit = await self.http_istemci.post(
                f"{self.mediasoup_url}/api/uretici/duraklat",
                json={
                    "toplanti_id": toplanti_id,
                    "uretici_id": uretici_id,
                },
            )
            yanit.raise_for_status()
            return True
        except httpx.HTTPError as e:
            logger.error(f"Üretici duraklatma hatası: {e}")
            return False

    async def uretici_devam(
        self,
        toplanti_id: str,
        uretici_id: str,
    ) -> bool:
        """Duraklatılmış üreticiyi devam ettirir."""
        try:
            yanit = await self.http_istemci.post(
                f"{self.mediasoup_url}/api/uretici/devam",
                json={
                    "toplanti_id": toplanti_id,
                    "uretici_id": uretici_id,
                },
            )
            yanit.raise_for_status()
            return True
        except httpx.HTTPError as e:
            logger.error(f"Üretici devam ettirme hatası: {e}")
            return False

    # =====================
    # CONSUMER İŞLEMLERİ
    # =====================

    async def tuketici_olustur(
        self,
        toplanti_id: str,
        tuketici_kullanici_id: str,
        uretici_id: str,
        rtp_yetenekler: dict,
    ) -> Optional[dict]:
        """
        Medya tüketicisi (Consumer) oluşturur.
        Başka kullanıcının akışını almak için kullanılır.
        
        Returns:
            Consumer bilgileri (id, producerId, kind, rtpParameters)
        """
        try:
            yanit = await self.http_istemci.post(
                f"{self.mediasoup_url}/api/tuketici/olustur",
                json={
                    "toplanti_id": toplanti_id,
                    "tuketici_kullanici_id": tuketici_kullanici_id,
                    "uretici_id": uretici_id,
                    "rtp_yetenekler": rtp_yetenekler,
                },
            )
            yanit.raise_for_status()
            return yanit.json()
        except httpx.HTTPError as e:
            logger.error(f"Tüketici oluşturma hatası: {e}")
            return None

    # =====================
    # YARDIMCI
    # =====================

    async def oda_mevcut_mu(self, toplanti_id: str) -> bool:
        """Mediasoup'ta odanın mevcut olup olmadığını kontrol eder."""
        try:
            yanit = await self.http_istemci.get(
                f"{self.mediasoup_url}/api/oda/{toplanti_id}/durum",
            )
            return yanit.status_code == 200
        except httpx.HTTPError:
            return False

    async def oda_istatistikleri(self, toplanti_id: str) -> Optional[dict]:
        """Oda medya istatistiklerini döndürür."""
        try:
            yanit = await self.http_istemci.get(
                f"{self.mediasoup_url}/api/oda/{toplanti_id}/istatistikler",
            )
            yanit.raise_for_status()
            return yanit.json()
        except httpx.HTTPError:
            return None

    def ice_sunuculari_getir(self) -> list:
        """İstemciye gönderilecek ICE sunucu listesini döndürür."""
        return ayarlar.ice_sunuculari

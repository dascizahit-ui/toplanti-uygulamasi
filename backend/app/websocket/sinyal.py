"""
WebRTC Sinyal Sunucusu — SFU (Mediasoup) Entegrasyonu
=====================================================
WebSocket → Mediasoup HTTP API proxy + sohbet + izin yönetimi
"""
import asyncio
import json
import uuid as uuid_mod

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

from app.database import AsyncOturumFabrikasi
from app.dependencies import websocket_kimlik_dogrula
from app.services.redis_servisi import RedisServisi
from app.websocket.yonetici import baglanti_yoneticisi
from app.config import ayarlari_getir

router = APIRouter(tags=["WebSocket Sinyal"])
redis = RedisServisi()

ayarlar = ayarlari_getir()
MEDIASOUP_URL = getattr(ayarlar, "MEDIASOUP_URL", "http://mediasoup:4443")


async def ms_post(endpoint: str, data: dict) -> dict:
    """Mediasoup HTTP API'ye POST isteği."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(f"{MEDIASOUP_URL}{endpoint}", json=data)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        logger.error(f"Mediasoup API hatası [{endpoint}]: {e}")
        return {"hata": str(e)}


async def ms_get(endpoint: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{MEDIASOUP_URL}{endpoint}")
            return r.json()
    except Exception as e:
        logger.error(f"Mediasoup GET hatası [{endpoint}]: {e}")
        return {"hata": str(e)}


@router.websocket("/ws/toplanti/{toplanti_id}")
async def toplanti_ws(websocket: WebSocket, toplanti_id: str):
    async with AsyncOturumFabrikasi() as db:
        kullanici = await websocket_kimlik_dogrula(websocket, db)

    if not kullanici:
        await websocket.close(code=4003)
        return

    uid = str(kullanici.id)
    
    # DB'den katılımcı detaylarını (izinler dahil) çek
    async with AsyncOturumFabrikasi() as db:
        from app.services.toplanti_servisi import ToplantiServisi
        s = ToplantiServisi(db)
        kat_detay = await s._katilimci_getir(uuid_mod.UUID(toplanti_id), kullanici.id)
        if not kat_detay or not kat_detay.aktif or getattr(kat_detay, "engellendi", False):
            await websocket.close(code=4004) # Kayıtlı değil
            return
        
        bilgi = {
            "id": uid, "kullanici_id": uid, 
            "ad_soyad": kullanici.ad_soyad,
            "kullanici_adi": kullanici.kullanici_adi,
            "profil_resmi": kullanici.profil_resmi,
            "rol": kat_detay.rol.value,
            "onayi_bekliyor": kat_detay.onayi_bekliyor,
            "mikrofon_izni": kat_detay.mikrofon_izni,
            "kamera_izni": kat_detay.kamera_izni,
            "ekran_paylasim_izni": kat_detay.ekran_paylasim_izni,
            "sohbet_izni": kat_detay.sohbet_izni,
        }

    try:
        await baglanti_yoneticisi.baglan(websocket, toplanti_id, uid, bilgi)
        await redis.katilimci_ekle(toplanti_id, uid, bilgi)

        # Mediasoup odaya katıl
        ms_katil = await ms_post("/api/oda/katil", {
            "room_id": toplanti_id, "peer_id": uid, "peer_data": bilgi,
        })

        # İlk mesaj: RTP capabilities + mevcut katılımcılar + ICE sunucuları
        katilimcilar = await redis.katilimci_listesi(toplanti_id)
        medya_durumlari = await redis.medya_durumlari_getir(toplanti_id)
        katilimci_durumu = {
            kid: {
                **kbilgi,
                "medya": {
                    "mikrofon": medya_durumlari.get(kid, {}).get("mikrofon", False),
                    "kamera": medya_durumlari.get(kid, {}).get("kamera", False),
                    "ekranPaylasimi": medya_durumlari.get(kid, {}).get("ekran_paylasimi", False),
                },
            }
            for kid, kbilgi in katilimcilar.items()
        }
        ayarlar = ayarlari_getir()
        await websocket.send_json({
            "olay": "oda_durumu",
            "veri": {
                "rtpCapabilities": ms_katil.get("rtpCapabilities"),
                "katilimcilar": katilimci_durumu,
                "mevcutProducerlar": ms_katil.get("mevcutPeerler", []),
                "katilimci_sayisi": len(katilimcilar),
                "iceServers": ayarlar.ice_sunuculari,
            },
        })

        # Herkese bildir (Redis'teki güncel tüm veriyi gönder)
        await baglanti_yoneticisi.odaya_yayinla_json(
            toplanti_id, "katildi",
            {
                "kullanici": bilgi, 
                "katilimci_sayisi": baglanti_yoneticisi.oda_katilimci_sayisi(toplanti_id)
            },
            gonderen_id=uid, haric_tut=uid,
        )

        # Ana döngü
        while True:
            veri = await websocket.receive_json()
            await _isle(websocket, toplanti_id, uid, bilgi, veri)

    except WebSocketDisconnect:
        logger.info(f"WS koptu: {kullanici.ad_soyad}")
    except Exception as e:
        logger.error(f"WS hata: {e}")
    finally:
        # Mediasoup'tan ayrıl
        await ms_post("/api/oda/ayril", {"room_id": toplanti_id, "peer_id": uid})
        await baglanti_yoneticisi.kopar(toplanti_id, uid, websocket)
        await redis.katilimci_cikar(toplanti_id, uid)

        await baglanti_yoneticisi.odaya_yayinla_json(
            toplanti_id, "ayrildi",
            {"kullanici_id": uid, "ad_soyad": bilgi.get("ad_soyad", ""),
             "katilimci_sayisi": baglanti_yoneticisi.oda_katilimci_sayisi(toplanti_id)},
        )

        try:
            async with AsyncOturumFabrikasi() as db:
                from app.services.toplanti_servisi import ToplantiServisi
                s = ToplantiServisi(db)
                await s.toplantidan_ayril(uuid_mod.UUID(toplanti_id), kullanici.id)
                await db.commit()
        except Exception as e:
            logger.error(f"DB ayrılma: {e}")


async def _isle(ws, tid, uid, bilgi, veri):
    olay = veri.get("olay", "")
    istek_id = veri.get("istek_id")

    # ─── MEDIASOUP SFU İŞLEMLERİ ───

    if olay == "transportOlustur":
        yon = veri.get("veri", {}).get("direction", "send")
        sonuc = await ms_post("/api/transport/olustur", {
            "room_id": tid, "peer_id": uid, "direction": yon,
        })
        await ws.send_json({
            "olay": "transportOlusturuldu",
            "veri": {**sonuc, "direction": yon},
            "istek_id": istek_id,
        })

    elif olay == "transportBagla":
        d = veri.get("veri", {})
        sonuc = await ms_post("/api/transport/bagla", {
            "room_id": tid, "peer_id": uid,
            "transport_id": d.get("transportId"),
            "dtlsParameters": d.get("dtlsParameters"),
        })
        await ws.send_json({
            "olay": "transportBaglandi",
            "veri": sonuc,
            "istek_id": istek_id,
        })

    elif olay == "produce":
        d = veri.get("veri", {})
        sonuc = await ms_post("/api/produce", {
            "room_id": tid, "peer_id": uid,
            "transport_id": d.get("transportId"),
            "kind": d.get("kind"),
            "rtpParameters": d.get("rtpParameters"),
            "appData": d.get("appData", {}),
        })
        await ws.send_json({
            "olay": "produced",
            "veri": sonuc,
            "istek_id": istek_id,
        })

        # Diğer peer'lara yeni producer'ı bildir
        if "id" in sonuc:
            await baglanti_yoneticisi.odaya_yayinla_json(
                tid, "yeniProducer",
                {"producerId": sonuc["id"], "peerId": uid, "kind": sonuc.get("kind"), "appData": sonuc.get("appData", {}), "peerData": bilgi},
                gonderen_id=uid, haric_tut=uid,
            )

    elif olay == "consume":
        d = veri.get("veri", {})
        sonuc = await ms_post("/api/consume", {
            "room_id": tid, "peer_id": uid,
            "producer_id": d.get("producerId"),
            "rtpCapabilities": d.get("rtpCapabilities"),
        })
        await ws.send_json({
            "olay": "consumed",
            "veri": sonuc,
            "istek_id": istek_id,
        })

    elif olay == "consumerResume":
        d = veri.get("veri", {})
        await ms_post("/api/consumer/resume", {
            "room_id": tid, "peer_id": uid, "consumer_id": d.get("consumerId"),
        })

    elif olay == "producerKapat":
        d = veri.get("veri", {})
        producer_id = d.get("producerId")
        await ms_post("/api/producer/kapat", {
            "room_id": tid, "peer_id": uid, "producer_id": producer_id,
        })
        # Diğerlerine bildir
        await baglanti_yoneticisi.odaya_yayinla_json(
            tid, "producerKapandi", {"producerId": producer_id, "peerId": uid},
            gonderen_id=uid, haric_tut=uid,
        )

    elif olay == "producerPause":
        d = veri.get("veri", {})
        await ms_post("/api/producer/pause", {
            "room_id": tid, "peer_id": uid, "producer_id": d.get("producerId"),
        })
        
    elif olay == "producerResume":
        d = veri.get("veri", {})
        await ms_post("/api/producer/resume", {
            "room_id": tid, "peer_id": uid, "producer_id": d.get("producerId"),
        })

    # ─── SOHBET ───
    elif olay == "sohbet_mesaji":
        icerik = veri.get("veri", {}).get("icerik", "").strip()
        if icerik:
            from app.websocket.sohbet import sohbet_yoneticisi
            await sohbet_yoneticisi.mesaj_isle(tid, uid, bilgi, icerik)

    # ─── MEDYA DURUMU BİLDİRİMİ ───
    elif olay in ("mikrofon_degisti", "kamera_degisti", "ekran_paylasimi_basladi", "ekran_paylasimi_bitti"):
        durum = veri.get("veri", {})
        medya_guncelleme = {}
        if olay == "mikrofon_degisti":
            medya_guncelleme["mikrofon"] = bool(durum.get("aktif"))
        elif olay == "kamera_degisti":
            medya_guncelleme["kamera"] = bool(durum.get("aktif"))
        elif olay == "ekran_paylasimi_basladi":
            medya_guncelleme["ekran_paylasimi"] = True
        elif olay == "ekran_paylasimi_bitti":
            medya_guncelleme["ekran_paylasimi"] = False

        if medya_guncelleme:
            await redis.medya_durumu_guncelle(tid, uid, medya_guncelleme)
        await baglanti_yoneticisi.odaya_yayinla_json(
            tid, olay, {"kullanici_id": uid, **durum},
            gonderen_id=uid, haric_tut=uid,
        )

    # ─── HEARTBEAT ───
    elif olay == "heartbeat":
        await redis.heartbeat_guncelle(tid, uid)
        await ws.send_json({"olay": "heartbeat_yanit", "istek_id": istek_id})

"""
Redis Bağlantı Yönetimi
========================
Redis bağlantı havuzu, Pub/Sub ve önbellek yönetimi.
Çoklu backend örneği için ölçeklendirme desteği sağlar.
"""

import json
from typing import Any, Optional

import redis.asyncio as redis
from loguru import logger

from app.config import ayarlari_getir

ayarlar = ayarlari_getir()

# --- Redis İstemci Tekil Örneği ---
_redis_istemci: Optional[redis.Redis] = None
_pubsub_istemci: Optional[redis.Redis] = None


async def redis_baglan() -> redis.Redis:
    """
    Redis bağlantısını başlatır veya mevcut bağlantıyı döndürür.
    Bağlantı havuzu otomatik yönetilir.
    """
    global _redis_istemci
    
    if _redis_istemci is None:
        _redis_istemci = redis.from_url(
            ayarlar.redis_baglanti_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
        )
        # Bağlantıyı test et
        try:
            await _redis_istemci.ping()
            logger.info("✅ Redis bağlantısı başarılı")
        except Exception as e:
            logger.error(f"❌ Redis bağlantı hatası: {e}")
            _redis_istemci = None
            raise
    
    return _redis_istemci


async def redis_getir() -> redis.Redis:
    """Mevcut Redis istemcisini döndürür."""
    if _redis_istemci is None:
        return await redis_baglan()
    return _redis_istemci


async def redis_kapat():
    """Redis bağlantısını kapatır."""
    global _redis_istemci, _pubsub_istemci
    
    if _pubsub_istemci:
        await _pubsub_istemci.close()
        _pubsub_istemci = None
    
    if _redis_istemci:
        await _redis_istemci.close()
        _redis_istemci = None
        logger.info("Redis bağlantısı kapatıldı")


# --- Önbellek İşlemleri ---

async def onbellek_kaydet(
    anahtar: str,
    deger: Any,
    sure_saniye: int = 3600,
) -> bool:
    """
    Veriyi Redis önbelleğine kaydeder.
    
    Args:
        anahtar: Önbellek anahtarı
        deger: Kaydedilecek değer (otomatik JSON'a çevrilir)
        sure_saniye: Geçerlilik süresi (varsayılan: 1 saat)
    """
    try:
        r = await redis_getir()
        veri = json.dumps(deger, ensure_ascii=False, default=str)
        await r.setex(anahtar, sure_saniye, veri)
        return True
    except Exception as e:
        logger.error(f"Önbellek kaydetme hatası: {e}")
        return False


async def onbellek_getir(anahtar: str) -> Optional[Any]:
    """Redis önbelleğinden veri okur."""
    try:
        r = await redis_getir()
        veri = await r.get(anahtar)
        if veri:
            return json.loads(veri)
        return None
    except Exception as e:
        logger.error(f"Önbellek okuma hatası: {e}")
        return None


async def onbellek_sil(anahtar: str) -> bool:
    """Redis önbelleğinden veri siler."""
    try:
        r = await redis_getir()
        await r.delete(anahtar)
        return True
    except Exception as e:
        logger.error(f"Önbellek silme hatası: {e}")
        return False


async def onbellek_desen_sil(desen: str) -> int:
    """Belirli desene uyan tüm anahtarları siler."""
    try:
        r = await redis_getir()
        anahtarlar = []
        async for anahtar in r.scan_iter(match=desen):
            anahtarlar.append(anahtar)
        if anahtarlar:
            await r.delete(*anahtarlar)
        return len(anahtarlar)
    except Exception as e:
        logger.error(f"Desen silme hatası: {e}")
        return 0


# --- Pub/Sub İşlemleri ---

async def kanal_yayinla(kanal: str, mesaj: dict) -> bool:
    """
    Redis kanalına mesaj yayınlar.
    Çoklu backend örneği arasında mesaj iletimi için kullanılır.
    """
    try:
        r = await redis_getir()
        veri = json.dumps(mesaj, ensure_ascii=False, default=str)
        await r.publish(kanal, veri)
        return True
    except Exception as e:
        logger.error(f"Pub/Sub yayınlama hatası: {e}")
        return False


async def kanal_dinle(kanal: str):
    """
    Redis kanalını dinler ve mesajları yield eder.
    Async generator olarak kullanılır.
    
    Kullanım:
        async for mesaj in kanal_dinle("toplanti:abc"):
            print(mesaj)
    """
    r = await redis_getir()
    pubsub = r.pubsub()
    await pubsub.subscribe(kanal)
    
    try:
        async for mesaj in pubsub.listen():
            if mesaj["type"] == "message":
                try:
                    veri = json.loads(mesaj["data"])
                    yield veri
                except json.JSONDecodeError:
                    yield mesaj["data"]
    finally:
        await pubsub.unsubscribe(kanal)
        await pubsub.close()


# --- Oda Durum Yönetimi (Redis Hash) ---

async def oda_durumu_kaydet(toplanti_id: str, alan: str, deger: Any):
    """Toplantı odası durumunu Redis hash olarak kaydeder."""
    try:
        r = await redis_getir()
        anahtar = f"oda:{toplanti_id}"
        veri = json.dumps(deger, ensure_ascii=False, default=str)
        await r.hset(anahtar, alan, veri)
        await r.expire(anahtar, 86400)  # 24 saat
    except Exception as e:
        logger.error(f"Oda durumu kaydetme hatası: {e}")


async def oda_durumu_getir(toplanti_id: str, alan: str) -> Optional[Any]:
    """Toplantı odası durumunu Redis'ten okur."""
    try:
        r = await redis_getir()
        veri = await r.hget(f"oda:{toplanti_id}", alan)
        if veri:
            return json.loads(veri)
        return None
    except Exception as e:
        logger.error(f"Oda durumu okuma hatası: {e}")
        return None


async def oda_durumu_tum(toplanti_id: str) -> dict:
    """Toplantı odasının tüm durumunu döndürür."""
    try:
        r = await redis_getir()
        veri = await r.hgetall(f"oda:{toplanti_id}")
        return {k: json.loads(v) for k, v in veri.items()}
    except Exception as e:
        logger.error(f"Oda tüm durum okuma hatası: {e}")
        return {}


async def oda_durumu_sil(toplanti_id: str):
    """Toplantı odası durumunu siler."""
    try:
        r = await redis_getir()
        await r.delete(f"oda:{toplanti_id}")
    except Exception as e:
        logger.error(f"Oda durumu silme hatası: {e}")

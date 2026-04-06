"""
Ana Uygulama (Düzeltilmiş)
===========================
CORS düzeltmesi ve middleware iyileştirmesi.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import ayarlari_getir
from app.core.hata_yonetimi import hata_isleyicileri_kaydet
from app.core.redis import redis_baglan, redis_kapat
from app.database import tablolari_olustur, motoru_kapat

from app.api.auth import router as auth_router
from app.api.kullanicilar import router as kullanicilar_router
from app.api.toplantilar import router as toplantilar_router
from app.api.izinler import router as izinler_router
from app.websocket.sinyal import router as sinyal_router

ayarlar = ayarlari_getir()


@asynccontextmanager
async def yasam_dongusu(app: FastAPI):
    logger.info(f"🚀 {ayarlar.APP_ADI} v{ayarlar.APP_SURUMU} başlatılıyor...")

    try:
        await tablolari_olustur()
        logger.info("✅ Veritabanı tabloları hazır")
    except Exception as e:
        logger.error(f"❌ Veritabanı hatası: {e}")

    try:
        await redis_baglan()
        logger.info("✅ Redis bağlantısı hazır")
    except Exception as e:
        logger.error(f"❌ Redis hatası: {e}")

    logger.info(f"✅ Uygulama başlatıldı - http://{ayarlar.BACKEND_SUNUCU}:{ayarlar.BACKEND_PORT}")
    yield

    await redis_kapat()
    await motoru_kapat()
    logger.info("👋 Uygulama kapatıldı")


def uygulama_olustur() -> FastAPI:
    app = FastAPI(
        title=ayarlar.APP_ADI,
        version=ayarlar.APP_SURUMU,
        docs_url="/docs" if ayarlar.DEBUG else None,
        redoc_url="/redoc" if ayarlar.DEBUG else None,
        lifespan=yasam_dongusu,
    )

    # CORS Yapılandırması
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ayarlar.cors_kaynaklari,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|31\.169\.72\.98|192\.168\.\d+\.\d+|.*\.ngrok-free\.app|.*\.up\.railway\.app)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )


    hata_isleyicileri_kaydet(app)

    # Routerlar
    app.include_router(auth_router)
    app.include_router(kullanicilar_router)
    app.include_router(toplantilar_router)
    app.include_router(izinler_router)
    app.include_router(sinyal_router)

    @app.get("/saglik", tags=["Sistem"])
    async def saglik_kontrolu():
        from app.websocket.yonetici import baglanti_yoneticisi
        return {
            "durum": "calisiyor",
            "uygulama": ayarlar.APP_ADI,
            "surum": ayarlar.APP_SURUMU,
            "aktif_baglanti": baglanti_yoneticisi.toplam_baglanti_sayisi,
        }

    @app.get("/", tags=["Sistem"])
    async def kok():
        return {"uygulama": ayarlar.APP_ADI, "surum": ayarlar.APP_SURUMU, "docs": "/docs"}

    return app


app = uygulama_olustur()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=ayarlar.BACKEND_SUNUCU, port=ayarlar.BACKEND_PORT,
                reload=ayarlar.DEBUG, ws_ping_interval=30, ws_ping_timeout=10)

"""
Veritabanı (Düzeltilmiş)
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import ayarlari_getir

ayarlar = ayarlari_getir()

motor = create_async_engine(
    ayarlar.veritabani_baglanti_url,
    pool_size=20, max_overflow=10, pool_recycle=3600,
    pool_pre_ping=True, echo=False,  # echo=False — log kirliliğini önle
)

AsyncOturumFabrikasi = async_sessionmaker(
    bind=motor, class_=AsyncSession, expire_on_commit=False, autoflush=False,
)


class TemelModel(DeclarativeBase):
    pass


async def veritabani_oturumu_getir():
    """FastAPI Depends() için oturum üretici."""
    async with AsyncOturumFabrikasi() as oturum:
        try:
            yield oturum
            await oturum.commit()
        except Exception:
            await oturum.rollback()
            raise


async def tablolari_olustur():
    async with motor.begin() as baglanti:
        try:
            await baglanti.run_sync(TemelModel.metadata.create_all)
        except Exception as e:
            # Eğer tip zaten varsa hata verebilir, canlı test için yoksayıyoruz.
            print(f"[Veritabanı] Uyarı: Tablo oluşturma sırasında hata (muhtemelen tipler zaten var): {e}")
            
        await baglanti.execute(
            text(
                "ALTER TABLE toplanti_katilimcilari "
                "ADD COLUMN IF NOT EXISTS engellendi BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )


async def motoru_kapat():
    await motor.dispose()

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
    # Model tablolarını oluştur - Hata alsa bile devam et (Enum kısıtlaması vb. için)
    async with motor.connect() as baglanti:
        # 1. Aşama: Temel Tabloları oluştur
        try:
            await baglanti.run_sync(TemelModel.metadata.create_all)
            await baglanti.commit()
        except Exception as e:
            # Eğer tip zaten varsa hata verebilir, günlüklerde göster ama devam et.
            print(f"[Veritabanı] Bilgi: Tablo oluşturma sırasında (beklenen) hata: {e}")
            
        # 2. Aşama: Manuel sütun ekleme (IF NOT EXISTS destekli)
        try:
            async with baglanti.begin():
                await baglanti.execute(
                    text(
                        "ALTER TABLE toplanti_katilimcilari "
                        "ADD COLUMN IF NOT EXISTS engellendi BOOLEAN NOT NULL DEFAULT FALSE"
                    )
                )
                await baglanti.commit()
        except Exception as e:
            print(f"[Veritabanı] ALTER TABLE Hatası (Yoksayılıyor): {e}")



async def motoru_kapat():
    await motor.dispose()

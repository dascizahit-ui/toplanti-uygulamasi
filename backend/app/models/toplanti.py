"""
Toplantı Modeli (Düzeltilmiş)
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import TemelModel


class ToplantiDurumu(str, enum.Enum):
    PLANLANMIS = "planlanmis"
    AKTIF = "aktif"
    BITMIS = "bitmis"
    IPTAL = "iptal"


class KatilimciRolu(str, enum.Enum):
    SAHIP = "sahip"
    MODERATOR = "moderator"
    KATILIMCI = "katilimci"
    IZLEYICI = "izleyici"


class Toplanti(TemelModel):
    __tablename__ = "toplantilar"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    baslik: Mapped[str] = mapped_column(String(200), nullable=False)
    aciklama: Mapped[str | None] = mapped_column(Text, nullable=True)
    toplanti_kodu: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    olusturan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("kullanicilar.id", ondelete="CASCADE"), nullable=False)
    durum: Mapped[ToplantiDurumu] = mapped_column(Enum(ToplantiDurumu), default=ToplantiDurumu.PLANLANMIS, nullable=False, index=True)
    baslangic_zamani: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bitis_zamani: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    maks_katilimci: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    sifre: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bekleme_odasi_aktif: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    kayit_aktif: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    olusturulma_tarihi: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    guncelleme_tarihi: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # lazy="noload" — ilişkiler sorgularda explicit yüklenir
    olusturan = relationship("Kullanici", back_populates="olusturulan_toplantilar", lazy="noload")
    katilimcilar = relationship("ToplantiKatilimci", back_populates="toplanti", lazy="noload", cascade="all, delete-orphan")
    mesajlar = relationship("Mesaj", back_populates="toplanti", lazy="noload", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Toplanti(id={self.id}, baslik={self.baslik})>"


class ToplantiKatilimci(TemelModel):
    __tablename__ = "toplanti_katilimcilari"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    toplanti_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("toplantilar.id", ondelete="CASCADE"), nullable=False, index=True)
    kullanici_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("kullanicilar.id", ondelete="CASCADE"), nullable=False, index=True)
    rol: Mapped[KatilimciRolu] = mapped_column(Enum(KatilimciRolu), default=KatilimciRolu.KATILIMCI, nullable=False)
    mikrofon_izni: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    kamera_izni: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ekran_paylasim_izni: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sohbet_izni: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    kalici_susturuldu: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    el_kaldirdi: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    onayi_bekliyor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    engellendi: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    katilma_zamani: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ayrilma_zamani: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    toplanti = relationship("Toplanti", back_populates="katilimcilar", lazy="noload")
    kullanici = relationship("Kullanici", back_populates="katilimlar", lazy="noload")

    @property
    def yonetici_mi(self) -> bool:
        return self.rol in (KatilimciRolu.SAHIP, KatilimciRolu.MODERATOR)

    def __repr__(self) -> str:
        return f"<ToplantiKatilimci(toplanti={self.toplanti_id}, kullanici={self.kullanici_id})>"

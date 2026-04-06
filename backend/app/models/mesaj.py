"""
Mesaj Modeli (Düzeltilmiş)
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import TemelModel


class MesajTipi(str, enum.Enum):
    METIN = "metin"
    SISTEM = "sistem"
    DOSYA = "dosya"
    EMOJI = "emoji"


class Mesaj(TemelModel):
    __tablename__ = "mesajlar"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    toplanti_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("toplantilar.id", ondelete="CASCADE"), nullable=False, index=True)
    gonderen_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("kullanicilar.id", ondelete="SET NULL"), nullable=True)
    icerik: Mapped[str] = mapped_column(Text, nullable=False)
    tip: Mapped[MesajTipi] = mapped_column(Enum(MesajTipi), default=MesajTipi.METIN, nullable=False)
    gonderilme_zamani: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    toplanti = relationship("Toplanti", back_populates="mesajlar", lazy="noload")
    gonderen = relationship("Kullanici", back_populates="mesajlar", lazy="noload")

    def __repr__(self) -> str:
        return f"<Mesaj(id={self.id}, tip={self.tip})>"

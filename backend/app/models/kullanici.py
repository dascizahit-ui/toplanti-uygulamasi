"""
Kullanıcı Modeli (Düzeltilmiş)
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import TemelModel


class KullaniciRolu(str, enum.Enum):
    ADMIN = "admin"
    MODERATOR = "moderator"
    KULLANICI = "kullanici"
    MISAFIR = "misafir"


class Kullanici(TemelModel):
    __tablename__ = "kullanicilar"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    kullanici_adi: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    ad_soyad: Mapped[str] = mapped_column(String(100), nullable=False)
    sifre_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[KullaniciRolu] = mapped_column(Enum(KullaniciRolu), default=KullaniciRolu.KULLANICI, nullable=False)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    profil_resmi: Mapped[str | None] = mapped_column(Text, nullable=True)
    olusturulma_tarihi: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    guncelleme_tarihi: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    son_giris: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # İlişkiler - lazy="noload" ile MissingGreenlet hatası önlenir
    olusturulan_toplantilar = relationship("Toplanti", back_populates="olusturan", lazy="noload")
    katilimlar = relationship("ToplantiKatilimci", back_populates="kullanici", lazy="noload")
    mesajlar = relationship("Mesaj", back_populates="gonderen", lazy="noload")

    @property
    def admin_mi(self) -> bool:
        return self.rol == KullaniciRolu.ADMIN

    @property
    def moderator_mi(self) -> bool:
        return self.rol in (KullaniciRolu.ADMIN, KullaniciRolu.MODERATOR)

    def __repr__(self) -> str:
        return f"<Kullanici(id={self.id}, email={self.email}, rol={self.rol})>"

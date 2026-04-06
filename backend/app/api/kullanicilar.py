"""
Kullanıcı Yönetim API (Düzeltilmiş)
"""
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import veritabani_oturumu_getir
from app.dependencies import admin_gerekli
from app.models.kullanici import Kullanici
from app.schemas.kullanici import KullaniciRolGuncelle, KullaniciYanit
from app.services.auth_servisi import AuthServisi

router = APIRouter(prefix="/api/kullanicilar", tags=["Kullanıcı Yönetimi"])


@router.get("", summary="Tüm Kullanıcıları Listele")
async def kullanicilari_listele(
    sayfa: int = Query(1, ge=1),
    boyut: int = Query(20, ge=1, le=100),
    admin: Kullanici = Depends(admin_gerekli),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = AuthServisi(db)
    atlama = (sayfa - 1) * boyut
    kullanicilar, toplam = await servis.tum_kullanicilari_getir(atlama, boyut)
    return {
        "basarili": True,
        "veri": {
            "kullanicilar": [k.model_dump() for k in kullanicilar],
            "sayfalama": {
                "toplam_kayit": toplam,
                "mevcut_sayfa": sayfa,
                "sayfa_boyutu": boyut,
            },
        },
    }


@router.get("/{kullanici_id}", response_model=KullaniciYanit)
async def kullanici_detay(
    kullanici_id: uuid.UUID,
    admin: Kullanici = Depends(admin_gerekli),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = AuthServisi(db)
    return await servis.profil_getir(kullanici_id)


@router.put("/{kullanici_id}/rol", response_model=KullaniciYanit)
async def rol_guncelle(
    kullanici_id: uuid.UUID,
    veri: KullaniciRolGuncelle,
    admin: Kullanici = Depends(admin_gerekli),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = AuthServisi(db)
    return await servis.kullanici_rolunu_guncelle(kullanici_id, veri.rol)


@router.put("/{kullanici_id}/durum", response_model=KullaniciYanit)
async def durum_degistir(
    kullanici_id: uuid.UUID,
    aktif: bool = Query(...),
    admin: Kullanici = Depends(admin_gerekli),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = AuthServisi(db)
    return await servis.kullanici_durumunu_degistir(kullanici_id, aktif)

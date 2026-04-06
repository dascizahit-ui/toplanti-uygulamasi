"""
İzin Yönetim API
================
Toplantı içi katılımcı izinlerini yönetir.

Rotalar:
    GET  /api/izinler/{tid}/{uid}            → İzinleri getir
    PUT  /api/izinler/{tid}/{uid}            → İzinleri güncelle
    POST /api/izinler/{tid}/tumu-sessize-al  → Herkesi sessize al
    POST /api/izinler/{tid}/kameralari-kapat → Tüm kameraları kapat
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import veritabani_oturumu_getir
from app.dependencies import mevcut_kullanici
from app.models.kullanici import Kullanici
from app.schemas.toplanti import KatilimciIzinGuncelle, KatilimciYanit
from app.services.izin_servisi import IzinServisi
from app.utils.yardimcilar import basarili_yanit
from app.websocket.yonetici import baglanti_yoneticisi

router = APIRouter(prefix="/api/izinler", tags=["İzin Yönetimi"])


@router.get(
    "/{toplanti_id}/{kullanici_id}",
    summary="İzinleri Getir",
    description="Belirli bir katılımcının toplantı izinlerini döndürür.",
)
async def izinleri_getir(
    toplanti_id: uuid.UUID,
    kullanici_id: uuid.UUID,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    """
    Katılımcının izin durumunu getirir.
    
    Döndürülen izinler:
    - mikrofon_izni
    - kamera_izni
    - ekran_paylasim_izni
    - sohbet_izni
    - rol
    """
    servis = IzinServisi(db)
    izinler = await servis.kullanici_izinleri_getir(toplanti_id, kullanici_id)
    return basarili_yanit(veri=izinler)


@router.put(
    "/{toplanti_id}/{hedef_kullanici_id}",
    response_model=KatilimciYanit,
    summary="İzinleri Güncelle",
    description="Katılımcının mikrofon, kamera, ekran paylaşımı ve sohbet izinlerini günceller.",
)
async def izinleri_guncelle(
    toplanti_id: uuid.UUID,
    hedef_kullanici_id: uuid.UUID,
    izinler: KatilimciIzinGuncelle,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    """
    Katılımcı izinlerini günceller.
    
    Yetki gereksinimleri:
    - Toplantı sahibi veya moderatörü olmalısınız
    - Veya sistem admin'i olmalısınız
    
    Kurallar:
    - Sahip'in izinleri değiştirilemez
    - İzleyici rolüne düşürülünce tüm izinler kapanır
    - Moderatör yapılınca tüm izinler açılır
    """
    servis = IzinServisi(db)
    sonuc = await servis.izin_guncelle(
        toplanti_id, hedef_kullanici_id, izinler, kullanici
    )

    # WebSocket ile hedef kullanıcıya doğrudan bildir
    # (Redis pub/sub yerine doğrudan WS broadcast — subscriber aktif değil)
    await baglanti_yoneticisi.odaya_yayinla_json(
        str(toplanti_id),
        "izin_guncellendi",
        {
            "kullanici_id": str(hedef_kullanici_id),
            "katilimci": sonuc.model_dump(mode="json"),
            "izinler": {
                "mikrofon_izni": sonuc.mikrofon_izni,
                "kamera_izni": sonuc.kamera_izni,
                "ekran_paylasim_izni": sonuc.ekran_paylasim_izni,
                "sohbet_izni": sonuc.sohbet_izni,
                "kalici_susturuldu": sonuc.kalici_susturuldu,
                "el_kaldirdi": sonuc.el_kaldirdi,
                "onayi_bekliyor": sonuc.onayi_bekliyor,
                "rol": sonuc.rol,
            },
        },
        gonderen_id=str(kullanici.id),
    )

    return sonuc


@router.post(
    "/{toplanti_id}/tumu-sessize-al",
    summary="Herkesi Sessize Al",
    description="Toplantıdaki tüm katılımcıların mikrofonunu kapatır.",
)
async def tumu_sessize_al(
    toplanti_id: uuid.UUID,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    """
    Tüm katılımcıları sessize alır.
    
    - Sahip ve istek yapan etkilenmez
    - Sahip/moderatör/admin yetkisi gerekir
    """
    servis = IzinServisi(db)
    sonuclar = await servis.tumu_sessize_al(toplanti_id, kullanici)

    # WebSocket ile doğrudan bildir
    await baglanti_yoneticisi.odaya_yayinla_json(
        str(toplanti_id),
        "tumu_sessize_alindi",
        {"yapan": kullanici.ad_soyad},
        gonderen_id=str(kullanici.id),
        haric_tut=str(kullanici.id),
    )

    return basarili_yanit(
        mesaj=f"{len(sonuclar)} katılımcı sessize alındı",
        veri={"etkilenen_sayisi": len(sonuclar)},
    )


@router.post(
    "/{toplanti_id}/kameralari-kapat",
    summary="Tüm Kameraları Kapat",
    description="Toplantıdaki tüm katılımcıların kamerasını kapatır.",
)
async def kameralari_kapat(
    toplanti_id: uuid.UUID,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    """Tüm katılımcıların kamerasını kapatır (sahip/moderatör)."""
    servis = IzinServisi(db)
    sonuclar = await servis.tum_kameralari_kapat(toplanti_id, kullanici)

    await baglanti_yoneticisi.odaya_yayinla_json(
        str(toplanti_id),
        "tum_kameralar_kapatildi",
        {"yapan": kullanici.ad_soyad},
        gonderen_id=str(kullanici.id),
        haric_tut=str(kullanici.id),
    )

    return basarili_yanit(
        mesaj=f"{len(sonuclar)} katılımcının kamerası kapatıldı",
        veri={"etkilenen_sayisi": len(sonuclar)},
    )

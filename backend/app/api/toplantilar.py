"""
Meeting API routes.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import veritabani_oturumu_getir
from app.dependencies import mevcut_kullanici, moderator_gerekli
from app.models.kullanici import Kullanici
from app.schemas.toplanti import (
    KatilimciYanit,
    MisafirKatilIsteği,
    ToplantiGuncelle,
    ToplantiKatilIsteği,
    ToplantiListeYanit,
    ToplantiOlustur,
    ToplantiYanit,
)
from app.services.toplanti_servisi import ToplantiServisi
from app.utils.yardimcilar import basarili_yanit

router = APIRouter(prefix="/api/toplantilar", tags=["Toplantilar"])


@router.get("/kod/{toplanti_kodu}/bilgi", summary="Halka acik toplanti bilgisi")
async def toplanti_bilgi_halka_acik(
    toplanti_kodu: str,
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    toplanti = await servis.toplanti_bilgisi_halka_acik(toplanti_kodu)
    return basarili_yanit(veri=toplanti)


@router.post("/kod/{toplanti_kodu}/misafir-katil", summary="Misafir olarak katil")
async def misafir_katil(
    toplanti_kodu: str,
    req: MisafirKatilIsteği,
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    logger.info(f"Misafir katilim istegi: Kod={toplanti_kodu}, Rumuz={req.rumuz}")
    servis = ToplantiServisi(db)
    token_yaniti = await servis.misafir_katil(toplanti_kodu, req.rumuz, req.sifre)
    return basarili_yanit(veri=token_yaniti)


@router.post("", response_model=ToplantiYanit, status_code=201, summary="Toplanti olustur")
async def toplanti_olustur(
    veri: ToplantiOlustur,
    kullanici: Kullanici = Depends(moderator_gerekli),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    return await servis.toplanti_olustur(veri, kullanici)


@router.get("", response_model=ToplantiListeYanit, summary="Toplantilari listele")
async def toplantilari_listele(
    durum: Optional[str] = Query(None, description="Durum filtresi"),
    sayfa: int = Query(1, ge=1),
    boyut: int = Query(20, ge=1, le=100),
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    atlama = (sayfa - 1) * boyut
    return await servis.toplantilari_listele(kullanici, durum, atlama, boyut)


@router.get("/{toplanti_id}", response_model=ToplantiYanit, summary="Toplanti detayi")
async def toplanti_detay(
    toplanti_id: uuid.UUID,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    return await servis.toplanti_detay(toplanti_id)


@router.get("/kod/{toplanti_kodu}", response_model=ToplantiYanit, summary="Kod ile toplanti getir")
async def toplanti_kod_ile(
    toplanti_kodu: str,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    return await servis.toplanti_kod_ile_getir(toplanti_kodu)


@router.put("/{toplanti_id}", response_model=ToplantiYanit, summary="Toplanti guncelle")
async def toplanti_guncelle(
    toplanti_id: uuid.UUID,
    veri: ToplantiGuncelle,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    return await servis.toplanti_guncelle(toplanti_id, veri, kullanici)


@router.post("/katil", response_model=ToplantiYanit, summary="Toplantiya katil")
async def toplantiya_katil(
    veri: ToplantiKatilIsteği,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    return await servis.toplantiya_katil(veri.toplanti_kodu, kullanici, veri.sifre)


@router.post("/{toplanti_id}/ayril", summary="Toplantidan ayril")
async def toplantidan_ayril(
    toplanti_id: uuid.UUID,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    sonuc = await servis.toplantidan_ayril(toplanti_id, kullanici.id)
    mesaj = "Toplantidan ayrildiniz" if sonuc else "Islem basarisiz"
    return basarili_yanit(mesaj=mesaj)


@router.post("/{toplanti_id}/sonlandir", response_model=ToplantiYanit, summary="Toplantiyi sonlandir")
async def toplanti_sonlandir(
    toplanti_id: uuid.UUID,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    sonuc = await servis.toplanti_sonlandir(toplanti_id, kullanici)

    from app.websocket.yonetici import baglanti_yoneticisi

    await baglanti_yoneticisi.odaya_yayinla_json(
        str(toplanti_id),
        "toplanti_bitti",
        {"yapan": kullanici.ad_soyad},
        haric_tut=str(kullanici.id),
    )
    return sonuc


@router.get(
    "/{toplanti_id}/katilimcilar",
    response_model=list[KatilimciYanit],
    summary="Katilimci listesi",
)
async def katilimcilari_getir(
    toplanti_id: uuid.UUID,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    return await servis.katilimcilari_getir(toplanti_id)


@router.post("/{toplanti_id}/at/{hedef_id}", summary="Katilimciyi toplantidan cikar")
async def katilimci_at(
    toplanti_id: uuid.UUID,
    hedef_id: uuid.UUID,
    kullanici: Kullanici = Depends(mevcut_kullanici),
    db: AsyncSession = Depends(veritabani_oturumu_getir),
):
    servis = ToplantiServisi(db)
    await servis.katilimci_at(toplanti_id, hedef_id, kullanici)

    from app.services.redis_servisi import RedisServisi
    from app.websocket.sinyal import ms_post
    from app.websocket.yonetici import baglanti_yoneticisi

    oda_id = str(toplanti_id)
    hedef = str(hedef_id)
    hedef_bagli_oda = baglanti_yoneticisi.kullanici_odasi(hedef)
    hedef_odada_bagli = hedef_bagli_oda == oda_id

    if hedef_odada_bagli:
        await baglanti_yoneticisi.kisisel_gonder(
            hedef,
            {
                "olay": "atildiniz",
                "veri": {"hedef_id": hedef},
                "gonderen_id": str(kullanici.id),
                "toplanti_id": oda_id,
            },
        )

    await ms_post("/api/oda/ayril", {"room_id": oda_id, "peer_id": hedef})
    await RedisServisi().katilimci_cikar(oda_id, hedef)
    await baglanti_yoneticisi.kopar(oda_id, hedef)

    if not hedef_odada_bagli:
        await baglanti_yoneticisi.odaya_yayinla_json(
            oda_id,
            "ayrildi",
            {
                "kullanici_id": hedef,
                "katilimci_sayisi": baglanti_yoneticisi.oda_katilimci_sayisi(oda_id),
            },
            gonderen_id=str(kullanici.id),
        )

    return basarili_yanit(mesaj="Katilimci toplantidan atildi")

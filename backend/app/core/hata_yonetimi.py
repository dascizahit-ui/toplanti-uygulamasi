"""
Hata Yönetimi
=============
Merkezi hata yakalama ve HTTP hata yanıtları.
FastAPI exception handler'ları burada tanımlanır.
"""

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger


# --- Özel Hata Sınıfları ---

class UygulamaHatasi(Exception):
    """Uygulama genel hata sınıfı."""
    def __init__(
        self,
        mesaj: str = "Bir hata oluştu",
        durum_kodu: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        detay: dict | None = None,
    ):
        self.mesaj = mesaj
        self.durum_kodu = durum_kodu
        self.detay = detay or {}
        super().__init__(mesaj)


class YetkilendirmeHatasi(UygulamaHatasi):
    """Yetkilendirme ile ilgili hatalar."""
    def __init__(self, mesaj: str = "Yetkilendirme başarısız"):
        super().__init__(
            mesaj=mesaj,
            durum_kodu=status.HTTP_401_UNAUTHORIZED,
        )


class YetkisizErisimHatasi(UygulamaHatasi):
    """Yetkisiz erişim hataları."""
    def __init__(self, mesaj: str = "Bu işlem için yetkiniz yok"):
        super().__init__(
            mesaj=mesaj,
            durum_kodu=status.HTTP_403_FORBIDDEN,
        )


class BulunamadiHatasi(UygulamaHatasi):
    """Kaynak bulunamadı hataları."""
    def __init__(self, kaynak: str = "Kaynak"):
        super().__init__(
            mesaj=f"{kaynak} bulunamadı",
            durum_kodu=status.HTTP_404_NOT_FOUND,
        )


class ZatenVarHatasi(UygulamaHatasi):
    """Çakışma hataları (kayıt zaten var)."""
    def __init__(self, mesaj: str = "Bu kayıt zaten mevcut"):
        super().__init__(
            mesaj=mesaj,
            durum_kodu=status.HTTP_409_CONFLICT,
        )


class HizSiniriHatasi(UygulamaHatasi):
    """Hız sınırı aşıldığında."""
    def __init__(self):
        super().__init__(
            mesaj="Çok fazla istek gönderildi. Lütfen biraz bekleyin.",
            durum_kodu=status.HTTP_429_TOO_MANY_REQUESTS,
        )


# --- FastAPI Hata İşleyicileri ---

def hata_isleyicileri_kaydet(app: FastAPI):
    """Tüm hata işleyicilerini FastAPI uygulamasına kaydeder."""

    @app.exception_handler(UygulamaHatasi)
    async def uygulama_hatasi_isleyici(
        request: Request, hata: UygulamaHatasi
    ) -> JSONResponse:
        """Özel uygulama hatalarını yakalar."""
        logger.warning(
            f"Uygulama hatası: {hata.mesaj} | "
            f"Yol: {request.url.path} | "
            f"Durum: {hata.durum_kodu}"
        )
        return JSONResponse(
            status_code=hata.durum_kodu,
            content={
                "basarili": False,
                "hata": {
                    "mesaj": hata.mesaj,
                    "kod": hata.durum_kodu,
                    "detay": hata.detay,
                },
            },
        )

    @app.exception_handler(HTTPException)
    async def http_hatasi_isleyici(
        request: Request, hata: HTTPException
    ) -> JSONResponse:
        """FastAPI HTTP hatalarını yakalar."""
        return JSONResponse(
            status_code=hata.status_code,
            content={
                "basarili": False,
                "hata": {
                    "mesaj": hata.detail,
                    "kod": hata.status_code,
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def dogrulama_hatasi_isleyici(
        request: Request, hata: RequestValidationError
    ) -> JSONResponse:
        """Pydantic doğrulama hatalarını yakalar ve Türkçe döndürür."""
        hatalar = []
        for err in hata.errors():
            alan = " → ".join(str(loc) for loc in err["loc"] if loc != "body")
            hatalar.append({
                "alan": alan,
                "mesaj": err["msg"],
                "tip": err["type"],
            })
        
        logger.warning(
            f"Doğrulama hatası: {request.url.path} | "
            f"Hatalar: {hatalar}"
        )
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "basarili": False,
                "hata": {
                    "mesaj": "Gönderilen veriler geçersiz",
                    "kod": 422,
                    "detay": hatalar,
                },
            },
        )

    @app.exception_handler(Exception)
    async def genel_hata_isleyici(
        request: Request, hata: Exception
    ) -> JSONResponse:
        """Yakalanmamış tüm hataları yakalar."""
        logger.exception(
            f"Beklenmeyen hata: {type(hata).__name__}: {str(hata)} | "
            f"Yol: {request.url.path}"
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "basarili": False,
                "hata": {
                    "mesaj": "Sunucu hatası oluştu",
                    "kod": 500,
                },
            },
        )

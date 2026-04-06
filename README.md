
# 🎥 TopMeet - Gerçek Zamanlı Toplantı Uygulaması

Modern, ölçeklenebilir ve güvenli video konferans platformu. Zoom/Google Meet benzeri özelliklerle, 
güçlü izin yönetimi ve gerçek zamanlı iletişim altyapısı sunar.

---

## 📐 Mimari

```
┌─────────────────────┐     ┌──────────────────────┐
│   Frontend          │     │   Backend             │
│   (Next.js + React) │────▶│   (FastAPI + Python)  │
│   Port: 3000        │ REST│   Port: 8000          │
│                     │◀────│                       │
│   - Zustand Store   │ WS  │   - JWT Auth          │
│   - WebRTC          │     │   - SQLAlchemy ORM    │
│   - Tailwind CSS    │     │   - WebSocket Sinyal  │
└─────────────────────┘     └───────┬───────────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
              ┌────────────┐ ┌──────────┐ ┌──────────────┐
              │   Redis    │ │ PostgreSQL│ │  Mediasoup   │
              │  Pub/Sub   │ │    DB    │ │  SFU Server  │
              │  Port:6379 │ │ Port:5432│ │  Port:4443   │
              └────────────┘ └──────────┘ └──────────────┘
                                                │
                                         ┌──────────────┐
                                         │   coturn      │
                                         │  TURN/STUN   │
                                         │  Port:3478   │
                                         └──────────────┘
```

## 🧠 Özellikler

### 👤 Kimlik Doğrulama
- JWT tabanlı kayıt ve giriş
- Otomatik token yenileme
- bcrypt şifre hashleme
- Rol sistemi: Admin, Moderatör, Kullanıcı

### 👥 Toplantı Yönetimi
- Benzersiz toplantı kodları (abc-defg-hij)
- Şifreli/şifresiz toplantılar
- Bekleme odası desteği
- Planlama (tarih/saat bazlı)
- Maksimum katılımcı sınırı

### 🎥 Gerçek Zamanlı İletişim
- WebRTC ile video + ses
- Mediasoup SFU (10+ kişi desteği)
- Ekran paylaşımı
- STUN/TURN ile NAT geçişi

### 🎛️ İzin Sistemi
- **Sahip:** Tüm yetkiler, atılamaz
- **Moderatör:** İzin yönetimi, katılımcı atma
- **Katılımcı:** İzin verilen medyalar
- **İzleyici:** Sadece izleme
- Toplu sessize alma / kamera kapatma
- Dinamik rol atama

### 💬 Gerçek Zamanlı Sohbet
- WebSocket ile anlık mesajlaşma
- PostgreSQL'e kalıcı kayıt
- Redis Pub/Sub ile çoklu sunucu desteği
- Sistem mesajları

### ⚡ Performans & Ölçeklenebilirlik
- Redis Pub/Sub ile yatay ölçekleme
- Async/await tabanlı backend
- SFU mimarisi ile verimli medya dağıtımı
- Bağlantı havuzu yönetimi

---

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Docker & Docker Compose
- Node.js 18+ (yerel geliştirme için)
- Python 3.12+ (yerel geliştirme için)

### Docker ile Başlatma (Önerilen)

```bash
# 1. Projeyi klonlayın
git clone <repo-url>
cd toplanti-uygulamasi

# 2. Ortam değişkenlerini ayarlayın
cp .env.example .env

# 3. Tüm servisleri başlatın
docker-compose up -d

# 4. Tarayıcıdan açın
# Frontend:  http://localhost:3000
# Backend:   http://localhost:8000
# API Docs:  http://localhost:8000/docs
```

### Yerel Geliştirme

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env

# PostgreSQL ve Redis çalışıyor olmalı
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

#### Mediasoup
```bash
cd mediasoup
npm install
cp .env.example .env
node src/server.js
```

---

## 📁 Proje Yapısı

```
toplanti-uygulamasi/
├── backend/                    # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                # REST API endpoint'leri
│   │   │   ├── auth.py         #   Kayıt, giriş, profil
│   │   │   ├── kullanicilar.py #   Admin kullanıcı yönetimi
│   │   │   ├── toplantilar.py  #   Toplantı CRUD
│   │   │   └── izinler.py      #   İzin yönetimi
│   │   ├── websocket/          # WebSocket modülleri
│   │   │   ├── sinyal.py       #   WebRTC sinyal sunucusu
│   │   │   ├── sohbet.py       #   Sohbet mesajlaşma
│   │   │   └── yonetici.py     #   Bağlantı havuzu
│   │   ├── services/           # İş mantığı katmanı
│   │   │   ├── auth_servisi.py
│   │   │   ├── toplanti_servisi.py
│   │   │   ├── redis_servisi.py
│   │   │   ├── izin_servisi.py
│   │   │   └── medya_servisi.py
│   │   ├── models/             # SQLAlchemy modelleri
│   │   ├── schemas/            # Pydantic şemaları
│   │   ├── core/               # Güvenlik, Redis, hata yönetimi
│   │   ├── utils/              # Yardımcı fonksiyonlar
│   │   ├── config.py           # Merkezi yapılandırma
│   │   ├── database.py         # Veritabanı bağlantısı
│   │   ├── dependencies.py     # FastAPI bağımlılıkları
│   │   └── main.py             # Uygulama giriş noktası
│   ├── alembic/                # Veritabanı migration
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                   # Next.js React Frontend
│   └── src/
│       ├── app/                # Sayfalar (App Router)
│       │   ├── page.tsx        #   Ana sayfa (landing)
│       │   ├── giris/          #   Giriş sayfası
│       │   ├── kayit/          #   Kayıt sayfası
│       │   ├── panel/          #   Dashboard
│       │   ├── toplanti/
│       │   │   ├── olustur/    #   Toplantı oluşturma
│       │   │   └── [id]/       #   Toplantı odası
│       │   └── yonetim/        #   Admin paneli
│       ├── components/
│       │   ├── ui/             # Buton, Input, Kart, Modal
│       │   ├── layout/         # Navbar, Sidebar, Footer
│       │   ├── auth/           # Giriş/Kayıt formları
│       │   ├── toplanti/       # Video, Sohbet, Kontroller
│       │   └── yonetim/        # Admin bileşenleri
│       ├── hooks/              # useWebRTC, useWebSocket, useMedya
│       ├── store/              # Zustand state yönetimi
│       ├── services/           # API & WebSocket servisleri
│       ├── types/              # TypeScript tipleri
│       └── utils/              # Sabitler, yardımcılar
│
├── mediasoup/                  # SFU Medya Sunucusu
│   └── src/
│       ├── server.js           # Express HTTP API
│       ├── config.js           # Codec & transport ayarları
│       └── odaYonetici.js      # Router/Transport/Producer yönetimi
│
├── coturn/
│   └── turnserver.conf         # TURN/STUN yapılandırması
│
├── docker-compose.yml          # Orkestrasyon
├── .env.example                # Ortam değişkenleri şablonu
└── README.md                   # Bu dosya
```

---

## 🔌 API Endpoint'leri

### Kimlik Doğrulama
| Metod | Yol | Açıklama |
|-------|-----|----------|
| POST | `/api/auth/kayit` | Yeni hesap oluştur |
| POST | `/api/auth/giris` | Giriş yap |
| POST | `/api/auth/token-yenile` | Token yenile |
| GET | `/api/auth/profil` | Profil bilgileri |
| PUT | `/api/auth/profil` | Profil güncelle |

### Toplantılar
| Metod | Yol | Açıklama |
|-------|-----|----------|
| POST | `/api/toplantilar` | Toplantı oluştur |
| GET | `/api/toplantilar` | Toplantıları listele |
| GET | `/api/toplantilar/{id}` | Toplantı detayı |
| GET | `/api/toplantilar/kod/{kod}` | Kod ile getir |
| POST | `/api/toplantilar/katil` | Toplantıya katıl |
| POST | `/api/toplantilar/{id}/sonlandir` | Sonlandır |
| POST | `/api/toplantilar/{id}/at/{uid}` | Katılımcı at |

### İzinler
| Metod | Yol | Açıklama |
|-------|-----|----------|
| GET | `/api/izinler/{tid}/{uid}` | İzinleri getir |
| PUT | `/api/izinler/{tid}/{uid}` | İzinleri güncelle |
| POST | `/api/izinler/{tid}/tumu-sessize-al` | Herkesi sustur |
| POST | `/api/izinler/{tid}/kameralari-kapat` | Kameraları kapat |

### WebSocket
| Yol | Açıklama |
|-----|----------|
| `ws://host/ws/toplanti/{id}?token=JWT` | Toplantı odası |

---

## 🔐 Güvenlik

- **JWT Authentication:** Erişim (30dk) + Yenileme (7gün) token çifti
- **bcrypt Hashleme:** Şifreler bcrypt ile hashlenip saklanır
- **RBAC:** Rol tabanlı erişim kontrolü (admin > moderator > kullanıcı)
- **CORS:** Yapılandırılabilir kaynak kısıtlaması
- **Input Validation:** Pydantic ile tüm girişler doğrulanır
- **WebSocket Auth:** Token ile kimlik doğrulama

---

## 🛠️ Teknolojiler

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0, asyncio |
| Veritabanı | PostgreSQL 16 |
| Önbellek | Redis 7 |
| Medya | Mediasoup 3, WebRTC |
| NAT Geçişi | coturn (TURN/STUN) |
| Container | Docker, Docker Compose |

---

## 📝 Lisans

MIT License - Ticari ve kişisel kullanıma açıktır.

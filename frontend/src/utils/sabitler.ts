/**
 * Sabitler
 * ========
 * Uygulama genelinde kullanılan sabit değerler.
 */

// API ve WebSocket URL'leri
// Üretimde mevcut hostname + protokol kullanılır (ws/wss otomatik seçilir).
const isLocalhost = typeof window !== 'undefined' && window.location.hostname.includes('localhost');

// API: production'da relative path kullan (Nginx proxy yapar)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// WS: production'da mevcut sayfanın protokolünden türetilir (https → wss, http → ws)
export const WS_URL = isLocalhost
  ? 'ws://localhost:8000'
  : typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    : (process.env.NEXT_PUBLIC_WS_URL || '');

export const APP_ADI = process.env.NEXT_PUBLIC_APP_ADI || 'yb Toplantı';

// API endpoint'leri
export const API_ENDPOINTLERI = {
  // Auth
  KAYIT: '/api/auth/kayit',
  GIRIS: '/api/auth/giris',
  TOKEN_YENILE: '/api/auth/token-yenile',
  PROFIL: '/api/auth/profil',

  // Kullanıcılar
  KULLANICILAR: '/api/kullanicilar',

  // Toplantılar
  TOPLANTILAR: '/api/toplantilar',
  TOPLANTIYA_KATIL: '/api/toplantilar/katil',
  TOPLANTI_BILGI: (kod: string) => `/api/toplantilar/kod/${kod}/bilgi`,
  MISAFIR_KATIL: (kod: string) => `/api/toplantilar/kod/${kod}/misafir-katil`,

  // İzinler
  IZINLER: '/api/izinler',
} as const;

// WebSocket endpoint
export const WS_TOPLANTI = (toplantiId: string, token: string) =>
  `${WS_URL}/ws/toplanti/${toplantiId}?token=${token}`;

// Yerel depolama anahtarları
export const DEPOLAMA = {
  ERISIM_TOKENI: 'erisim_tokeni',
  YENILEME_TOKENI: 'yenileme_tokeni',
  KULLANICI: 'kullanici',
  TEMA: 'tema',
} as const;

// Medya kısıtlamaları
export const MEDYA_KISITLAMALARI = {
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user',
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
  },
} as const;

export const EKRAN_PAYLASIM_KISITLAMALARI = {
  video: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 15, max: 30 },
  },
  audio: false,
} as const;

// Toplantı sabitleri
export const TOPLANTI = {
  MAKS_KATILIMCI: 50,
  HEARTBEAT_ARALIK_MS: 30000,
  YENIDEN_BAGLANMA_ARALIK_MS: 3000,
  MAKS_YENIDEN_BAGLANMA: 5,
  MESAJ_MAKS_UZUNLUK: 2000,
} as const;

// Rol etiketleri (Türkçe)
export const ROL_ETIKETLERI: Record<string, string> = {
  admin: 'Yönetici',
  moderator: 'Moderatör',
  kullanici: 'Kullanıcı',
  sahip: 'Sahip',
  katilimci: 'Katılımcı',
  izleyici: 'İzleyici',
  misafir: 'Misafir',
};

// Durum etiketleri
export const DURUM_ETIKETLERI: Record<string, string> = {
  planlanmis: 'Planlanmış',
  aktif: 'Aktif',
  bitmis: 'Bitmiş',
  iptal: 'İptal',
};

// Durum renkleri
export const DURUM_RENKLERI: Record<string, string> = {
  planlanmis: 'bg-yellow-100 text-yellow-800',
  aktif: 'bg-green-100 text-green-800',
  bitmis: 'bg-gray-100 text-gray-800',
  iptal: 'bg-red-100 text-red-800',
};

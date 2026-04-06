/**
 * Auth Store (Zustand)
 * ====================
 * Kimlik doğrulama durum yönetimi.
 * Token'lar localStorage'da, kullanıcı bilgisi store'da tutulur.
 */

import { create } from 'zustand';
import type { Kullanici, GirisVerisi, KayitVerisi, TokenYaniti } from '@/types';
import api, { hataMesajiGetir } from '@/services/api';
import { API_ENDPOINTLERI, DEPOLAMA } from '@/utils/sabitler';
import { depolama } from '@/utils/yardimcilar';

interface AuthDurumu {
  // Durum
  kullanici: Kullanici | null;
  yukleniyor: boolean;
  hata: string | null;
  girisYapildi: boolean;

  // İşlemler
  girisYap: (veri: GirisVerisi) => Promise<boolean>;
  kayitOl: (veri: KayitVerisi) => Promise<boolean>;
  cikisYap: () => void;
  profilGetir: () => Promise<void>;
  profilGuncelle: (veri: Partial<Kullanici>) => Promise<boolean>;
  oturumKontrol: () => void;
  hatayiTemizle: () => void;
}

export const useAuthStore = create<AuthDurumu>((set, get) => ({
  // --- Başlangıç Durumu ---
  kullanici: null,
  yukleniyor: false,
  hata: null,
  girisYapildi: false,

  // --- Giriş ---
  girisYap: async (veri: GirisVerisi): Promise<boolean> => {
    set({ yukleniyor: true, hata: null });
    try {
      const yanit = await api.post<TokenYaniti>(API_ENDPOINTLERI.GIRIS, veri);
      const { erisim_tokeni, yenileme_tokeni, kullanici } = yanit.data;

      // Token'ları kaydet
      depolama.kaydet(DEPOLAMA.ERISIM_TOKENI, erisim_tokeni);
      depolama.kaydet(DEPOLAMA.YENILEME_TOKENI, yenileme_tokeni);
      depolama.kaydet(DEPOLAMA.KULLANICI, JSON.stringify(kullanici));

      set({ kullanici, girisYapildi: true, yukleniyor: false });
      return true;
    } catch (error) {
      set({ hata: hataMesajiGetir(error), yukleniyor: false });
      return false;
    }
  },

  // --- Kayıt ---
  kayitOl: async (veri: KayitVerisi): Promise<boolean> => {
    set({ yukleniyor: true, hata: null });
    try {
      const yanit = await api.post<TokenYaniti>(API_ENDPOINTLERI.KAYIT, veri);
      const { erisim_tokeni, yenileme_tokeni, kullanici } = yanit.data;

      depolama.kaydet(DEPOLAMA.ERISIM_TOKENI, erisim_tokeni);
      depolama.kaydet(DEPOLAMA.YENILEME_TOKENI, yenileme_tokeni);
      depolama.kaydet(DEPOLAMA.KULLANICI, JSON.stringify(kullanici));

      set({ kullanici, girisYapildi: true, yukleniyor: false });
      return true;
    } catch (error) {
      set({ hata: hataMesajiGetir(error), yukleniyor: false });
      return false;
    }
  },

  // --- Çıkış ---
  cikisYap: () => {
    depolama.temizle();
    set({ kullanici: null, girisYapildi: false, hata: null });
  },

  // --- Profil Getir ---
  profilGetir: async () => {
    try {
      const yanit = await api.get<Kullanici>(API_ENDPOINTLERI.PROFIL);
      const kullanici = yanit.data;
      depolama.kaydet(DEPOLAMA.KULLANICI, JSON.stringify(kullanici));
      set({ kullanici, girisYapildi: true });
    } catch {
      // Token geçersizse çıkış yap
      get().cikisYap();
    }
  },

  // --- Profil Güncelle ---
  profilGuncelle: async (veri): Promise<boolean> => {
    set({ yukleniyor: true, hata: null });
    try {
      const yanit = await api.put<Kullanici>(API_ENDPOINTLERI.PROFIL, veri);
      const kullanici = yanit.data;
      depolama.kaydet(DEPOLAMA.KULLANICI, JSON.stringify(kullanici));
      set({ kullanici, yukleniyor: false });
      return true;
    } catch (error) {
      set({ hata: hataMesajiGetir(error), yukleniyor: false });
      return false;
    }
  },

  // --- Sayfa yüklendiğinde oturum kontrolü ---
  oturumKontrol: () => {
    const token = depolama.tokenGetir();
    const kullanici = depolama.kullaniciGetir();
    if (token && kullanici) {
      set({ kullanici, girisYapildi: true });
    }
  },

  // --- Hata temizle ---
  hatayiTemizle: () => set({ hata: null }),
}));

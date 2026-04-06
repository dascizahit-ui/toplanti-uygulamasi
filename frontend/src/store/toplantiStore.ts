/**
 * Toplantı Store (Zustand)
 * ========================
 * Toplantı listesi, aktif toplantı ve katılımcı durum yönetimi.
 */

import { create } from 'zustand';
import type {
  Toplanti,
  ToplantiOlusturVerisi,
  ToplantiListeYaniti,
  Katilimci,
  KatilimciIzinGuncelle,
} from '@/types';
import api, { hataMesajiGetir } from '@/services/api';
import { API_ENDPOINTLERI, DEPOLAMA } from '@/utils/sabitler';
import { depolama } from '@/utils/yardimcilar';
import { useAuthStore } from '@/store/authStore';

interface ToplantiDurumu {
  // Durum
  toplantilar: Toplanti[];
  aktifToplanti: Toplanti | null;
  katilimcilar: Katilimci[];
  toplam: number;
  sayfa: number;
  yukleniyor: boolean;
  hata: string | null;

  // Toplantı İşlemleri
  toplantilariGetir: (durum?: string, sayfa?: number) => Promise<void>;
  toplantiDetay: (id: string) => Promise<void>;
  toplantiKodIleGetir: (kod: string) => Promise<Toplanti | null>;
  toplantiOlustur: (veri: ToplantiOlusturVerisi) => Promise<Toplanti | null>;
  toplantiyaKatil: (kod: string, sifre?: string) => Promise<Toplanti | null>;
  misafirKatil: (kod: string, rumuz: string, sifre?: string) => Promise<Toplanti | null>;
  toplantiBilgisiGetir: (kod: string) => Promise<{ id: string, baslik: string, sifreli: boolean, aktif: boolean } | null>;
  toplantidanAyril: (id: string) => Promise<boolean>;
  toplantiSonlandir: (id: string) => Promise<boolean>;

  // Katılımcı İşlemleri
  katilimcilariGetir: (toplantiId: string) => Promise<void>;
  katilimciAt: (toplantiId: string, hedefId: string) => Promise<boolean>;
  izinGuncelle: (toplantiId: string, hedefId: string, izinler: KatilimciIzinGuncelle) => Promise<boolean>;
  tumuSessizeAl: (toplantiId: string) => Promise<boolean>;
  tumKameralariKapat: (toplantiId: string) => Promise<boolean>;

  // Store Yönetimi
  aktifToplantiAyarla: (toplanti: Toplanti | null) => void;
  katilimciGuncelle: (katilimci: Katilimci) => void;
  katilimciEkle: (katilimci: Katilimci) => void;
  katilimciCikar: (kullaniciId: string) => void;
  hatayiTemizle: () => void;
  sifirla: () => void;
}

export const useToplantiStore = create<ToplantiDurumu>((set, get) => ({
  // --- Başlangıç ---
  toplantilar: [],
  aktifToplanti: null,
  katilimcilar: [],
  toplam: 0,
  sayfa: 1,
  yukleniyor: false,
  hata: null,

  // --- Toplantı Listesi ---
  toplantilariGetir: async (durum, sayfa = 1) => {
    set({ yukleniyor: true, hata: null });
    try {
      const params: any = { sayfa, boyut: 20 };
      if (durum) params.durum = durum;
      const yanit = await api.get<ToplantiListeYaniti>(API_ENDPOINTLERI.TOPLANTILAR, { params });
      set({
        toplantilar: yanit.data.toplantilar,
        toplam: yanit.data.toplam,
        sayfa: yanit.data.sayfa,
        yukleniyor: false,
      });
    } catch (error) {
      set({ hata: hataMesajiGetir(error), yukleniyor: false });
    }
  },

  // --- Toplantı Detay ---
  toplantiDetay: async (id) => {
    set({ yukleniyor: true, hata: null });
    try {
      const yanit = await api.get<Toplanti>(`${API_ENDPOINTLERI.TOPLANTILAR}/${id}`);
      set({ aktifToplanti: yanit.data, yukleniyor: false });
    } catch (error) {
      set({ hata: hataMesajiGetir(error), yukleniyor: false });
    }
  },

  // --- Kod ile Getir ---
  toplantiKodIleGetir: async (kod) => {
    try {
      const yanit = await api.get<Toplanti>(`${API_ENDPOINTLERI.TOPLANTILAR}/kod/${kod}`);
      return yanit.data;
    } catch {
      return null;
    }
  },

  // --- Oluştur ---
  toplantiOlustur: async (veri) => {
    set({ yukleniyor: true, hata: null });
    try {
      const yanit = await api.post<Toplanti>(API_ENDPOINTLERI.TOPLANTILAR, veri);
      set((state) => ({
        toplantilar: [yanit.data, ...state.toplantilar],
        yukleniyor: false,
      }));
      return yanit.data;
    } catch (error) {
      set({ hata: hataMesajiGetir(error), yukleniyor: false });
      return null;
    }
  },

  // --- Katıl ---
  toplantiyaKatil: async (kod, sifre?) => {
    set({ yukleniyor: true, hata: null });
    try {
      const yanit = await api.post<Toplanti>(API_ENDPOINTLERI.TOPLANTIYA_KATIL, {
        toplanti_kodu: kod,
        sifre,
      });
      set({ aktifToplanti: yanit.data, yukleniyor: false });
      return yanit.data;
    } catch (error) {
      set({ hata: hataMesajiGetir(error), yukleniyor: false });
      return null;
    }
  },

  // --- Misafir Katıl ---
  misafirKatil: async (kod, rumuz, sifre?) => {
    set({ yukleniyor: true, hata: null });
    try {
      const yanit = await api.post<any>(API_ENDPOINTLERI.MISAFIR_KATIL(kod), {
        rumuz,
        sifre,
      });
      const { erisim_tokeni, yenileme_tokeni, kullanici } = yanit.data.veri;

      // Token'ları kaydet
      depolama.kaydet(DEPOLAMA.ERISIM_TOKENI, erisim_tokeni);
      depolama.kaydet(DEPOLAMA.YENILEME_TOKENI, yenileme_tokeni);
      depolama.kaydet(DEPOLAMA.KULLANICI, JSON.stringify(kullanici));
      useAuthStore.setState({
        kullanici,
        girisYapildi: true,
        yukleniyor: false,
        hata: null,
      });

      // Auth store'u güncelle (Opsiyonel ama iyi olur)
      // Bu kısım biraz karmaşık olabilir çünkü store'lar arası bağımlılık var.
      // Şimdilik sadece token'ları kaydedip sayfayı yenilemek veya authStore.oturumKontrol çağırmak yeterli.

      // Aktif toplantıyı çek (yeni token ile)
      const toplantiYanit = await api.get<Toplanti>(`${API_ENDPOINTLERI.TOPLANTILAR}/kod/${kod}`);
      set({ aktifToplanti: toplantiYanit.data, yukleniyor: false });
      return toplantiYanit.data;
    } catch (error) {
      set({ hata: hataMesajiGetir(error), yukleniyor: false });
      return null;
    }
  },

  // --- Halka Açık Bilgi ---
  toplantiBilgisiGetir: async (kod) => {
    try {
      const yanit = await api.get<any>(API_ENDPOINTLERI.TOPLANTI_BILGI(kod));
      return yanit.data.veri;
    } catch {
      return null;
    }
  },

  // --- Ayrıl ---
  toplantidanAyril: async (id) => {
    try {
      await api.post(`${API_ENDPOINTLERI.TOPLANTILAR}/${id}/ayril`);
      set({ aktifToplanti: null, katilimcilar: [] });
      return true;
    } catch {
      return false;
    }
  },

  // --- Sonlandır ---
  toplantiSonlandir: async (id) => {
    try {
      await api.post(`${API_ENDPOINTLERI.TOPLANTILAR}/${id}/sonlandir`);
      set({ aktifToplanti: null, katilimcilar: [] });
      return true;
    } catch {
      return false;
    }
  },

  // --- Katılımcıları Getir ---
  katilimcilariGetir: async (toplantiId) => {
    try {
      const yanit = await api.get<Katilimci[]>(
        `${API_ENDPOINTLERI.TOPLANTILAR}/${toplantiId}/katilimcilar`
      );
      set({ katilimcilar: yanit.data });
    } catch {
      // Sessiz hata
    }
  },

  // --- Katılımcı At ---
  katilimciAt: async (toplantiId, hedefId) => {
    try {
      await api.post(`${API_ENDPOINTLERI.TOPLANTILAR}/${toplantiId}/at/${hedefId}`);
      set((state) => ({
        katilimcilar: state.katilimcilar.filter((k) => k.kullanici_id !== hedefId),
      }));
      return true;
    } catch {
      return false;
    }
  },

  // --- İzin Güncelle ---
  izinGuncelle: async (toplantiId, hedefId, izinler) => {
    try {
      const yanit = await api.put<Katilimci>(
        `${API_ENDPOINTLERI.IZINLER}/${toplantiId}/${hedefId}`,
        izinler
      );
      set((state) => ({
        katilimcilar: state.katilimcilar.some((k) => k.kullanici_id === hedefId)
          ? state.katilimcilar.map((k) =>
              k.kullanici_id === hedefId ? { ...k, ...yanit.data } : k
            )
          : [...state.katilimcilar, yanit.data],
      }));
      return true;
    } catch {
      return false;
    }
  },

  // --- Toplu İşlemler ---
  tumuSessizeAl: async (toplantiId) => {
    try {
      await api.post(`${API_ENDPOINTLERI.IZINLER}/${toplantiId}/tumu-sessize-al`);
      return true;
    } catch {
      return false;
    }
  },

  tumKameralariKapat: async (toplantiId) => {
    try {
      await api.post(`${API_ENDPOINTLERI.IZINLER}/${toplantiId}/kameralari-kapat`);
      return true;
    } catch {
      return false;
    }
  },

  // --- Store Yönetimi ---
  aktifToplantiAyarla: (toplanti) => set({ aktifToplanti: toplanti }),

  katilimciGuncelle: (katilimci) =>
    set((state) => ({
      katilimcilar: state.katilimcilar.some((k) => k.kullanici_id === katilimci.kullanici_id)
        ? state.katilimcilar.map((k) =>
            k.kullanici_id === katilimci.kullanici_id ? { ...k, ...katilimci } : k
          )
        : [...state.katilimcilar, katilimci],
    })),

  katilimciEkle: (katilimci) =>
    set((state) => ({
      katilimcilar: state.katilimcilar.some((k) => k.kullanici_id === katilimci.kullanici_id)
        ? state.katilimcilar.map((k) =>
            k.kullanici_id === katilimci.kullanici_id ? { ...k, ...katilimci } : k
          )
        : [...state.katilimcilar, katilimci],
    })),

  katilimciCikar: (kullaniciId) =>
    set((state) => ({
      katilimcilar: state.katilimcilar.filter((k) => k.kullanici_id !== kullaniciId),
    })),

  hatayiTemizle: () => set({ hata: null }),
  sifirla: () =>
    set({
      toplantilar: [],
      aktifToplanti: null,
      katilimcilar: [],
      toplam: 0,
      sayfa: 1,
      yukleniyor: false,
      hata: null,
    }),
}));

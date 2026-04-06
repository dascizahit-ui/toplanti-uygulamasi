/**
 * Medya Store (Düzeltilmiş)
 * =========================
 * Track.enabled ile gerçek medya kontrolü.
 */

import { create } from 'zustand';
import type { KatilimciMedya, MedyaDurumu } from '@/types';
import { MEDYA_KISITLAMALARI } from '@/utils/sabitler';

interface MedyaDurumuState {
  yerelAkim: MediaStream | null;
  ekranAkimi: MediaStream | null;
  mikrofon: boolean;
  kamera: boolean;
  ekranPaylasimi: boolean;
  uzakMedyalar: Map<string, KatilimciMedya>;
  sesGirisAygitlari: MediaDeviceInfo[];
  videoGirisAygitlari: MediaDeviceInfo[];
  secilenSesAygiti: string | null;
  secilenVideoAygiti: string | null;

  yerelMedyaBaslat: (video?: boolean, ses?: boolean) => Promise<MediaStream | null>;
  yerelMedyaDurdur: () => void;
  mikrofonAcKapat: () => void;
  kameraAcKapat: () => void;
  ekranPaylasimiBaslat: () => Promise<MediaStream | null>;
  ekranPaylasiminiDurdur: () => void;
  aygitlariListele: () => Promise<void>;
  sesAygitiSec: (aygitId: string) => void;
  videoAygitiSec: (aygitId: string) => void;
  uzakMedyaEkle: (kullaniciId: string, medya: KatilimciMedya) => void;
  uzakMedyaCikar: (kullaniciId: string) => void;
  uzakMedyaGuncelle: (kullaniciId: string, durum: Partial<MedyaDurumu>) => void;
  uzakAkimAyarla: (kullaniciId: string, akim: MediaStream, tur: 'video' | 'ses') => void;
  sifirla: () => void;
}

export const useMedyaStore = create<MedyaDurumuState>((set, get) => ({
  yerelAkim: null,
  ekranAkimi: null,
  mikrofon: false,
  kamera: false,
  ekranPaylasimi: false,
  uzakMedyalar: new Map(),
  sesGirisAygitlari: [],
  videoGirisAygitlari: [],
  secilenSesAygiti: null,
  secilenVideoAygiti: null,

  yerelMedyaBaslat: async (video = true, ses = true) => {
    try {
      const kisitlamalar: MediaStreamConstraints = {};
      if (ses) kisitlamalar.audio = MEDYA_KISITLAMALARI.audio;
      if (video) kisitlamalar.video = MEDYA_KISITLAMALARI.video;

      const akim = await navigator.mediaDevices.getUserMedia(kisitlamalar);
      set({ yerelAkim: akim, mikrofon: ses, kamera: video });
      return akim;
    } catch (error) {
      console.error('Medya erişim hatası:', error);
      // Sadece ses ile dene
      try {
        const akim = await navigator.mediaDevices.getUserMedia({ audio: true });
        set({ yerelAkim: akim, mikrofon: true, kamera: false });
        return akim;
      } catch {
        set({ yerelAkim: null, mikrofon: false, kamera: false });
        return null;
      }
    }
  },

  yerelMedyaDurdur: () => {
    const { yerelAkim, ekranAkimi } = get();
    yerelAkim?.getTracks().forEach(t => t.stop());
    ekranAkimi?.getTracks().forEach(t => t.stop());
    set({ yerelAkim: null, ekranAkimi: null, mikrofon: false, kamera: false, ekranPaylasimi: false });
  },

  mikrofonAcKapat: () => {
    const { yerelAkim, mikrofon } = get();
    if (yerelAkim) {
      yerelAkim.getAudioTracks().forEach(t => { t.enabled = !mikrofon; });
      set({ mikrofon: !mikrofon });
    }
  },

  kameraAcKapat: () => {
    const { yerelAkim, kamera } = get();
    if (yerelAkim) {
      yerelAkim.getVideoTracks().forEach(t => { t.enabled = !kamera; });
      set({ kamera: !kamera });
    }
  },

  ekranPaylasimiBaslat: async () => {
    try {
      const akim = await navigator.mediaDevices.getDisplayMedia({ video: true });
      akim.getVideoTracks()[0].onended = () => {
        set({ ekranAkimi: null, ekranPaylasimi: false });
      };
      set({ ekranAkimi: akim, ekranPaylasimi: true });
      return akim;
    } catch {
      return null;
    }
  },

  ekranPaylasiminiDurdur: () => {
    get().ekranAkimi?.getTracks().forEach(t => t.stop());
    set({ ekranAkimi: null, ekranPaylasimi: false });
  },

  aygitlariListele: async () => {
    try {
      const aygitlar = await navigator.mediaDevices.enumerateDevices();
      set({
        sesGirisAygitlari: aygitlar.filter(d => d.kind === 'audioinput'),
        videoGirisAygitlari: aygitlar.filter(d => d.kind === 'videoinput'),
      });
    } catch {}
  },

  sesAygitiSec: (id) => set({ secilenSesAygiti: id }),
  videoAygitiSec: (id) => set({ secilenVideoAygiti: id }),

  uzakMedyaEkle: (kullaniciId, medya) =>
    set((s) => { const y = new Map(s.uzakMedyalar); y.set(kullaniciId, medya); return { uzakMedyalar: y }; }),

  uzakMedyaCikar: (kullaniciId) =>
    set((s) => { const y = new Map(s.uzakMedyalar); y.delete(kullaniciId); return { uzakMedyalar: y }; }),

  uzakMedyaGuncelle: (kullaniciId, durum) =>
    set((s) => {
      const y = new Map(s.uzakMedyalar);
      const m = y.get(kullaniciId);
      if (m) y.set(kullaniciId, { ...m, medya: { ...m.medya, ...durum } });
      return { uzakMedyalar: y };
    }),

  uzakAkimAyarla: (kullaniciId, akim, tur) =>
    set((s) => {
      const y = new Map(s.uzakMedyalar);
      const m = y.get(kullaniciId);
      if (m) {
        y.set(kullaniciId, {
          ...m,
          [tur === 'video' ? 'videoStream' : 'sesStream']: akim,
          medya: { ...m.medya, [tur === 'video' ? 'kamera' : 'mikrofon']: true },
        });
      }
      return { uzakMedyalar: y };
    }),

  sifirla: () => {
    get().yerelMedyaDurdur();
    set({ uzakMedyalar: new Map(), sesGirisAygitlari: [], videoGirisAygitlari: [], secilenSesAygiti: null, secilenVideoAygiti: null });
  },
}));

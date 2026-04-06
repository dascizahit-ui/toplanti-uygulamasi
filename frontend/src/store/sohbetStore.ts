/**
 * Sohbet Store (Zustand)
 * ======================
 * Toplantı içi sohbet mesaj yönetimi.
 */

import { create } from 'zustand';
import type { Mesaj } from '@/types';

interface SohbetDurumu {
  // Durum
  mesajlar: Mesaj[];
  panelAcik: boolean;
  okunmamisSayisi: number;

  // İşlemler
  mesajEkle: (mesaj: Mesaj) => void;
  mesajlariAyarla: (mesajlar: Mesaj[]) => void;
  panelAcKapat: () => void;
  panelAc: () => void;
  panelKapat: () => void;
  okunmamisSifirla: () => void;
  sifirla: () => void;
}

export const useSohbetStore = create<SohbetDurumu>((set, get) => ({
  // --- Başlangıç ---
  mesajlar: [],
  panelAcik: false,
  okunmamisSayisi: 0,

  // --- Mesaj Ekle ---
  mesajEkle: (mesaj) =>
    set((state) => {
      // Aynı mesaj tekrarını önle
      if (state.mesajlar.some((m) => m.id === mesaj.id)) {
        return state;
      }

      const yeniOkunmamis = state.panelAcik ? 0 : state.okunmamisSayisi + 1;

      return {
        mesajlar: [...state.mesajlar, mesaj],
        okunmamisSayisi: yeniOkunmamis,
      };
    }),

  // --- Mesajları Toplu Ayarla (geçmiş yükleme) ---
  mesajlariAyarla: (mesajlar) => set({ mesajlar }),

  // --- Panel Kontrolü ---
  panelAcKapat: () =>
    set((state) => ({
      panelAcik: !state.panelAcik,
      okunmamisSayisi: !state.panelAcik ? 0 : state.okunmamisSayisi,
    })),

  panelAc: () => set({ panelAcik: true, okunmamisSayisi: 0 }),
  panelKapat: () => set({ panelAcik: false }),
  okunmamisSifirla: () => set({ okunmamisSayisi: 0 }),

  // --- Sıfırla ---
  sifirla: () =>
    set({
      mesajlar: [],
      panelAcik: false,
      okunmamisSayisi: 0,
    }),
}));

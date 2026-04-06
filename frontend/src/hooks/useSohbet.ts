/**
 * Sohbet Hook
 * ===========
 * Toplantı içi sohbet mesajlaşma yönetimi.
 * WebSocket üzerinden mesaj gönderme ve alma.
 */

'use client';

import { useCallback } from 'react';
import { useSohbetStore } from '@/store/sohbetStore';
import type { Mesaj } from '@/types';
import { TOPLANTI } from '@/utils/sabitler';

interface SohbetSecenekleri {
  wsMesajGonder: (olay: string, veri?: any) => void;
}

export function useSohbet({ wsMesajGonder }: SohbetSecenekleri) {
  const {
    mesajlar,
    panelAcik,
    okunmamisSayisi,
    mesajEkle,
    mesajlariAyarla,
    panelAcKapat,
    panelAc,
    panelKapat,
    okunmamisSifirla,
    sifirla,
  } = useSohbetStore();

  /**
   * Mesaj gönderir.
   */
  const mesajGonder = useCallback((icerik: string, tip: string = 'metin') => {
    const temiz = icerik.trim();
    if (!temiz || temiz.length > TOPLANTI.MESAJ_MAKS_UZUNLUK) return;

    wsMesajGonder('sohbet_mesaji', { icerik: temiz, tip });
  }, [wsMesajGonder]);

  /**
   * Gelen WebSocket mesajını işler.
   */
  const mesajIsle = useCallback((mesaj: Mesaj) => {
    mesajEkle(mesaj);
  }, [mesajEkle]);

  return {
    // Durum
    mesajlar,
    panelAcik,
    okunmamisSayisi,

    // İşlemler
    mesajGonder,
    mesajIsle,
    mesajlariAyarla,
    panelAcKapat,
    panelAc,
    panelKapat,
    okunmamisSifirla,
    sifirla,
  };
}

/**
 * Medya Hook
 * ==========
 * Kamera, mikrofon ve ekran paylaşımı yönetimi.
 * Aygıt seçimi ve medya akışı kontrolü sağlar.
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useMedyaStore } from '@/store/medyaStore';

interface MedyaSecenekleri {
  otomatikBaslat?: boolean;
  video?: boolean;
  ses?: boolean;
}

export function useMedya(secenekler: MedyaSecenekleri = {}) {
  const {
    yerelAkim,
    ekranAkimi,
    mikrofon,
    kamera,
    ekranPaylasimi,
    sesGirisAygitlari,
    videoGirisAygitlari,
    yerelMedyaBaslat,
    yerelMedyaDurdur,
    mikrofonAcKapat,
    kameraAcKapat,
    ekranPaylasimiBaslat,
    ekranPaylasiminiDurdur,
    aygitlariListele,
    sesAygitiSec,
    videoAygitiSec,
    sifirla,
  } = useMedyaStore();

  const { otomatikBaslat = false, video = true, ses = true } = secenekler;

  // Aygıtları listele
  useEffect(() => {
    aygitlariListele();

    // Aygıt değişikliğini dinle
    const isleyici = () => aygitlariListele();
    navigator.mediaDevices?.addEventListener('devicechange', isleyici);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', isleyici);
    };
  }, [aygitlariListele]);

  // Otomatik başlatma
  useEffect(() => {
    if (otomatikBaslat) {
      yerelMedyaBaslat(video, ses);
    }
    return () => {
      // Bileşen unmount olduğunda temizleme yapma
      // (toplantı sayfası yönetir)
    };
  }, [otomatikBaslat, video, ses, yerelMedyaBaslat]);

  /**
   * Medya izinlerini kontrol eder.
   */
  const izinKontrol = useCallback(async (): Promise<{
    mikrofon: boolean;
    kamera: boolean;
  }> => {
    try {
      const sonuclar = await Promise.all([
        navigator.permissions.query({ name: 'microphone' as PermissionName }),
        navigator.permissions.query({ name: 'camera' as PermissionName }),
      ]);
      return {
        mikrofon: sonuclar[0].state === 'granted',
        kamera: sonuclar[1].state === 'granted',
      };
    } catch {
      return { mikrofon: false, kamera: false };
    }
  }, []);

  /**
   * Medya akışını yeniden başlatır (aygıt değişikliğinde).
   */
  const yenidenBaslat = useCallback(async () => {
    yerelMedyaDurdur();
    await yerelMedyaBaslat(video, ses);
  }, [yerelMedyaDurdur, yerelMedyaBaslat, video, ses]);

  return {
    // Durum
    yerelAkim,
    ekranAkimi,
    mikrofon,
    kamera,
    ekranPaylasimi,

    // Aygıtlar
    sesGirisAygitlari,
    videoGirisAygitlari,

    // İşlemler
    baslat: () => yerelMedyaBaslat(video, ses),
    durdur: yerelMedyaDurdur,
    mikrofonAcKapat,
    kameraAcKapat,
    ekranPaylasimiBaslat,
    ekranPaylasiminiDurdur,
    sesAygitiSec,
    videoAygitiSec,
    yenidenBaslat,
    izinKontrol,
    sifirla,
  };
}

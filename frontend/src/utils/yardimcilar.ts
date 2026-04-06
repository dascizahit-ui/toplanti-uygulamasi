/**
 * Yardımcı Fonksiyonlar (Düzeltilmiş)
 */

import { DEPOLAMA } from './sabitler';

export function tarihFormatla(tarihStr: string | null | undefined): string {
  if (!tarihStr) return '-';
  try {
    return new Date(tarihStr).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '-'; }
}

export function goreliZaman(tarihStr: string): string {
  const fark = Date.now() - new Date(tarihStr).getTime();
  const dakika = Math.floor(fark / 60000);
  const saat = Math.floor(fark / 3600000);
  const gun = Math.floor(fark / 86400000);
  if (dakika < 1) return 'Az önce';
  if (dakika < 60) return `${dakika} dakika önce`;
  if (saat < 24) return `${saat} saat önce`;
  if (gun < 30) return `${gun} gün önce`;
  return tarihFormatla(tarihStr);
}

export function saatFormatla(tarihStr: string): string {
  try {
    return new Date(tarihStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export function basHarfler(adSoyad: string): string {
  if (!adSoyad) return '?';
  return adSoyad.split(' ').map(k => k.charAt(0).toUpperCase()).slice(0, 2).join('');
}

export function avatarRengi(id: string): string {
  const renkler = ['bg-blue-500','bg-green-500','bg-purple-500','bg-pink-500','bg-indigo-500',
    'bg-teal-500','bg-orange-500','bg-cyan-500','bg-rose-500','bg-emerald-500'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return renkler[Math.abs(hash) % renkler.length];
}

export const depolama = {
  getir: (anahtar: string): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(anahtar);
  },
  kaydet: (anahtar: string, deger: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(anahtar, deger);
  },
  sil: (anahtar: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(anahtar);
  },
  temizle: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(DEPOLAMA.ERISIM_TOKENI);
    localStorage.removeItem(DEPOLAMA.YENILEME_TOKENI);
    localStorage.removeItem(DEPOLAMA.KULLANICI);
  },
  tokenGetir: (): string | null => depolama.getir(DEPOLAMA.ERISIM_TOKENI),
  kullaniciGetir: (): any | null => {
    const veri = depolama.getir(DEPOLAMA.KULLANICI);
    if (!veri) return null;
    try { return JSON.parse(veri); } catch { return null; }
  },
};

export function metinKisalt(metin: string, maks: number = 100): string {
  if (metin.length <= maks) return metin;
  return metin.slice(0, maks - 3) + '...';
}

export function sinifBirlestir(...siniflar: (string | number | boolean | undefined | null)[]): string {
  return siniflar.filter(s => typeof s === 'string' && s.length > 0).join(' ');
}

export async function panoyaKopyala(metin: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(metin); return true; } catch { return false; }
}

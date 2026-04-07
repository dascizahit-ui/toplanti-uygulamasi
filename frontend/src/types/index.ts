/**
 * Tip Tanımlamaları
 * =================
 * Uygulama genelinde kullanılan tüm TypeScript tipleri.
 * Backend şemalarıyla uyumlu olacak şekilde tasarlanmıştır.
 */

// =====================
// KULLANICI
// =====================

export type KullaniciRolu = 'admin' | 'moderator' | 'kullanici' | 'misafir';

export interface Kullanici {
  id: string;
  email: string;
  kullanici_adi: string;
  ad_soyad: string;
  rol: KullaniciRolu;
  aktif: boolean;
  profil_resmi?: string | null;
  olusturulma_tarihi: string;
  son_giris?: string | null;
}

export interface KayitVerisi {
  email: string;
  kullanici_adi: string;
  ad_soyad: string;
  sifre: string;
  sifre_tekrar: string;
}

export interface GirisVerisi {
  email: string;
  sifre: string;
}

export interface TokenYaniti {
  erisim_tokeni: string;
  yenileme_tokeni: string;
  token_tipi: string;
  sure_dakika: number;
  kullanici: Kullanici;
}

// =====================
// TOPLANTI
// =====================

export type ToplantiDurumu = 'planlanmis' | 'aktif' | 'bitmis' | 'iptal';
export type KatilimciRolu = 'sahip' | 'moderator' | 'katilimci' | 'izleyici';

export interface Toplanti {
  id: string;
  baslik: string;
  aciklama?: string | null;
  toplanti_kodu: string;
  olusturan_id: string;
  olusturan_adi: string;
  durum: ToplantiDurumu;
  baslangic_zamani?: string | null;
  bitis_zamani?: string | null;
  maks_katilimci: number;
  bekleme_odasi_aktif: boolean;
  kayit_aktif: boolean;
  katilimci_sayisi: number;
  katilimcilar: Katilimci[];
  olusturulma_tarihi: string;
}

export interface ToplantiOlusturVerisi {
  baslik: string;
  aciklama?: string;
  baslangic_zamani?: string;
  bitis_zamani?: string;
  maks_katilimci?: number;
  sifre?: string;
  bekleme_odasi_aktif?: boolean;
}

export interface ToplantiListeYaniti {
  toplantilar: Toplanti[];
  toplam: number;
  sayfa: number;
  sayfa_boyutu: number;
}

// =====================
// KATILIMCI
// =====================

export interface Katilimci {
  id: string;
  kullanici_id: string;
  kullanici_adi: string;
  ad_soyad: string;
  profil_resmi?: string | null;
  rol: KatilimciRolu;
  mikrofon_izni: boolean;
  kamera_izni: boolean;
  ekran_paylasim_izni: boolean;
  sohbet_izni: boolean;
  kalici_susturuldu: boolean;
  el_kaldirdi: boolean;
  onayi_bekliyor: boolean;
  aktif: boolean;
  katilma_zamani: string;
}

export interface KatilimciIzinGuncelle {
  mikrofon_izni?: boolean;
  kamera_izni?: boolean;
  ekran_paylasim_izni?: boolean;
  sohbet_izni?: boolean;
  kalici_susturuldu?: boolean;
  el_kaldirdi?: boolean;
  onayi_bekliyor?: boolean;
  rol?: KatilimciRolu;
}

// =====================
// MESAJ / SOHBET
// =====================

export type MesajTipi = 'metin' | 'sistem' | 'dosya' | 'emoji';

export interface Mesaj {
  id: string;
  toplanti_id: string;
  gonderen_id: string | null;
  gonderen_adi: string;
  gonderen_resmi?: string | null;
  icerik: string;
  tip: MesajTipi;
  gonderilme_zamani: string;
}

// =====================
// WEBSOCKET
// =====================
export type WebSocketOlayTipi =
  | 'oda_durumu' | 'katildi' | 'ayrildi'
  | 'sinyal_teklif' | 'sinyal_yanit' | 'sinyal_aday'
  | 'mikrofon_degisti' | 'kamera_degisti'
  | 'ekran_paylasimi_basladi' | 'ekran_paylasimi_bitti'
  | 'sohbet_mesaji' | 'izin_guncellendi'
  | 'tumu_sessize_alindi' | 'tum_kameralar_kapatildi'
  | 'atildiniz' | 'toplanti_bitti' | 'hata'
  | 'transportOlusturuldu' | 'transportBaglandi'
  | 'produced' | 'consumed'
  | 'yeniProducer' | 'producerKapandi'
  | 'heartbeat_yanit';
export interface WebSocketMesaji {
  olay: WebSocketOlayTipi;
  veri?: any;
  istek_id?: string | null;
  gonderen_id?: string | null;
  hedef_id?: string | null;
  toplanti_id?: string | null;
  zaman?: string;
}

// =====================
// MEDYA
// =====================

export interface MedyaDurumu {
  mikrofon: boolean;
  kamera: boolean;
  ekranPaylasimi: boolean;
  dusukBantGenisligi?: boolean;
}

export interface KatilimciMedya {
  kullanici_id: string;
  ad_soyad: string;
  kullanici_adi: string;
  profil_resmi?: string | null;
  rol: KatilimciRolu;
  medya: MedyaDurumu;
  videoStream?: MediaStream | null;
  sesStream?: MediaStream | null;
  ekranStream?: MediaStream | null;
  ekranSesStream?: MediaStream | null;
}

export interface ICESunucusu {
  urls: string;
  username?: string;
  credential?: string;
}

// =====================
// API YANIT
// =====================

export interface APIYaniti<T = any> {
  basarili: boolean;
  mesaj?: string;
  veri?: T;
  hata?: {
    mesaj: string;
    kod: number;
    detay?: any;
  };
}

// =====================
// UI DURUMLARI
// =====================

export type BildirimTipi = 'basari' | 'hata' | 'uyari' | 'bilgi';

export interface Bildirim {
  id: string;
  tip: BildirimTipi;
  mesaj: string;
  sure?: number;
}

export type SayfaDurumu = 'yukleniyor' | 'hazir' | 'hata';

/**
 * Auth Servis Katmanı
 * ===================
 * Kimlik doğrulama API çağrılarını soyutlar.
 * Store dışından doğrudan API çağrısı gerektiğinde kullanılır.
 */

import api, { hataMesajiGetir } from './api';
import { API_ENDPOINTLERI } from '@/utils/sabitler';
import type { Kullanici, TokenYaniti, KayitVerisi, GirisVerisi } from '@/types';

export const authServisi = {
  /** Kullanıcı kaydı */
  kayit: async (veri: KayitVerisi): Promise<TokenYaniti> => {
    const yanit = await api.post<TokenYaniti>(API_ENDPOINTLERI.KAYIT, veri);
    return yanit.data;
  },

  /** Kullanıcı girişi */
  giris: async (veri: GirisVerisi): Promise<TokenYaniti> => {
    const yanit = await api.post<TokenYaniti>(API_ENDPOINTLERI.GIRIS, veri);
    return yanit.data;
  },

  /** Token yenileme */
  tokenYenile: async (yenilemeTokeni: string): Promise<TokenYaniti> => {
    const yanit = await api.post<TokenYaniti>(
      API_ENDPOINTLERI.TOKEN_YENILE,
      null,
      { params: { yenileme_tokeni: yenilemeTokeni } }
    );
    return yanit.data;
  },

  /** Profil getir */
  profilGetir: async (): Promise<Kullanici> => {
    const yanit = await api.get<Kullanici>(API_ENDPOINTLERI.PROFIL);
    return yanit.data;
  },

  /** Profil güncelle */
  profilGuncelle: async (veri: Partial<Kullanici>): Promise<Kullanici> => {
    const yanit = await api.put<Kullanici>(API_ENDPOINTLERI.PROFIL, veri);
    return yanit.data;
  },

  /** Tüm kullanıcılar (admin) */
  kullanicilariGetir: async (sayfa = 1, boyut = 20) => {
    const yanit = await api.get(API_ENDPOINTLERI.KULLANICILAR, {
      params: { sayfa, boyut },
    });
    return yanit.data;
  },

  /** Rol güncelle (admin) */
  rolGuncelle: async (kullaniciId: string, rol: string): Promise<Kullanici> => {
    const yanit = await api.put<Kullanici>(
      `${API_ENDPOINTLERI.KULLANICILAR}/${kullaniciId}/rol`,
      { rol }
    );
    return yanit.data;
  },

  /** Durum değiştir (admin) */
  durumDegistir: async (kullaniciId: string, aktif: boolean): Promise<Kullanici> => {
    const yanit = await api.put<Kullanici>(
      `${API_ENDPOINTLERI.KULLANICILAR}/${kullaniciId}/durum`,
      null,
      { params: { aktif } }
    );
    return yanit.data;
  },
};

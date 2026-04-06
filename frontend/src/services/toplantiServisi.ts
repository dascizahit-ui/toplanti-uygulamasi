/**
 * Toplantı Servis Katmanı
 * =======================
 * Toplantı API çağrılarını soyutlar.
 */

import api from './api';
import { API_ENDPOINTLERI } from '@/utils/sabitler';
import type {
  Toplanti,
  ToplantiOlusturVerisi,
  ToplantiListeYaniti,
  Katilimci,
  KatilimciIzinGuncelle,
} from '@/types';

export const toplantiServisi = {
  /** Toplantı oluştur */
  olustur: async (veri: ToplantiOlusturVerisi): Promise<Toplanti> => {
    const yanit = await api.post<Toplanti>(API_ENDPOINTLERI.TOPLANTILAR, veri);
    return yanit.data;
  },

  /** Toplantıları listele */
  listele: async (durum?: string, sayfa = 1, boyut = 20): Promise<ToplantiListeYaniti> => {
    const params: any = { sayfa, boyut };
    if (durum) params.durum = durum;
    const yanit = await api.get<ToplantiListeYaniti>(API_ENDPOINTLERI.TOPLANTILAR, { params });
    return yanit.data;
  },

  /** Toplantı detayı */
  detay: async (id: string): Promise<Toplanti> => {
    const yanit = await api.get<Toplanti>(`${API_ENDPOINTLERI.TOPLANTILAR}/${id}`);
    return yanit.data;
  },

  /** Kod ile toplantı getir */
  kodIleGetir: async (kod: string): Promise<Toplanti> => {
    const yanit = await api.get<Toplanti>(`${API_ENDPOINTLERI.TOPLANTILAR}/kod/${kod}`);
    return yanit.data;
  },

  /** Toplantıya katıl */
  katil: async (kod: string, sifre?: string): Promise<Toplanti> => {
    const yanit = await api.post<Toplanti>(API_ENDPOINTLERI.TOPLANTIYA_KATIL, {
      toplanti_kodu: kod,
      sifre,
    });
    return yanit.data;
  },

  /** Toplantıdan ayrıl */
  ayril: async (id: string): Promise<void> => {
    await api.post(`${API_ENDPOINTLERI.TOPLANTILAR}/${id}/ayril`);
  },

  /** Toplantıyı sonlandır */
  sonlandir: async (id: string): Promise<void> => {
    await api.post(`${API_ENDPOINTLERI.TOPLANTILAR}/${id}/sonlandir`);
  },

  /** Katılımcıları getir */
  katilimcilariGetir: async (toplantiId: string): Promise<Katilimci[]> => {
    const yanit = await api.get<Katilimci[]>(
      `${API_ENDPOINTLERI.TOPLANTILAR}/${toplantiId}/katilimcilar`
    );
    return yanit.data;
  },

  /** Katılımcı at */
  katilimciAt: async (toplantiId: string, hedefId: string): Promise<void> => {
    await api.post(`${API_ENDPOINTLERI.TOPLANTILAR}/${toplantiId}/at/${hedefId}`);
  },

  /** İzin güncelle */
  izinGuncelle: async (
    toplantiId: string,
    hedefId: string,
    izinler: KatilimciIzinGuncelle
  ): Promise<Katilimci> => {
    const yanit = await api.put<Katilimci>(
      `${API_ENDPOINTLERI.IZINLER}/${toplantiId}/${hedefId}`,
      izinler
    );
    return yanit.data;
  },

  /** Herkesi sessize al */
  tumuSessizeAl: async (toplantiId: string): Promise<void> => {
    await api.post(`${API_ENDPOINTLERI.IZINLER}/${toplantiId}/tumu-sessize-al`);
  },

  /** Tüm kameraları kapat */
  tumKameralariKapat: async (toplantiId: string): Promise<void> => {
    await api.post(`${API_ENDPOINTLERI.IZINLER}/${toplantiId}/kameralari-kapat`);
  },
};

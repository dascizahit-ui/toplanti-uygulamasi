/**
 * Toplantı Yönetimi Bileşeni
 * ==========================
 * Admin paneli: tüm toplantıları listele, durum değiştir, sonlandır.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToplantiStore } from '@/store/toplantiStore';
import Buton from '@/components/ui/Buton';
import bildirim from '@/components/ui/Bildirim';
import { tarihFormatla, panoyaKopyala } from '@/utils/yardimcilar';
import { DURUM_ETIKETLERI, DURUM_RENKLERI } from '@/utils/sabitler';

export default function ToplantiYonetimi() {
  const router = useRouter();
  const { toplantilar, toplam, yukleniyor, toplantilariGetir, toplantiSonlandir } = useToplantiStore();

  useEffect(() => {
    toplantilariGetir();
  }, [toplantilariGetir]);

  const sonlandirIsle = async (id: string, baslik: string) => {
    if (!confirm(`"${baslik}" toplantısını sonlandırmak istediğinize emin misiniz?`)) return;
    const sonuc = await toplantiSonlandir(id);
    if (sonuc) {
      bildirim.basari('Toplantı sonlandırıldı');
      toplantilariGetir();
    }
  };

  if (yukleniyor) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-birincil-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900">
          Toplantılar ({toplam})
        </h2>
        <Buton boyut="kucuk" onClick={() => router.push('/toplanti/olustur')}>
          Yeni Oluştur
        </Buton>
      </div>

      {toplantilar.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Henüz toplantı oluşturulmamış.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Başlık</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kod</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Katılımcı</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tarih</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {toplantilar.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{t.baslik}</p>
                    <p className="text-xs text-slate-500">{t.olusturan_adi}</p>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { panoyaKopyala(t.toplanti_kodu); bildirim.basari('Kopyalandı'); }}
                      className="font-mono text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                    >
                      {t.toplanti_kodu}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${DURUM_RENKLERI[t.durum] || ''}`}>
                      {DURUM_ETIKETLERI[t.durum] || t.durum}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {t.katilimci_sayisi} / {t.maks_katilimci}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {tarihFormatla(t.baslangic_zamani || t.olusturulma_tarihi)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => router.push(`/toplanti/${t.toplanti_kodu}`)}
                        className="text-xs px-3 py-1.5 text-birincil-600 hover:bg-birincil-50 rounded-lg font-medium transition-colors"
                      >
                        Katıl
                      </button>
                      {t.durum === 'aktif' && (
                        <button
                          onClick={() => sonlandirIsle(t.id, t.baslik)}
                          className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                        >
                          Sonlandır
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Panel Sayfası (Dashboard)
 * =========================
 * Giriş yapmış kullanıcının ana sayfası.
 * Aktif toplantılar, geçmiş toplantılar ve hızlı işlemler.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useToplantiStore } from '@/store/toplantiStore';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import Kart from '@/components/ui/Kart';
import Buton from '@/components/ui/Buton';
import bildirim from '@/components/ui/Bildirim';
import { tarihFormatla, panoyaKopyala } from '@/utils/yardimcilar';
import { DURUM_ETIKETLERI, DURUM_RENKLERI, ROL_ETIKETLERI } from '@/utils/sabitler';

export default function PanelSayfasi() {
  const router = useRouter();
  const { kullanici, girisYapildi, oturumKontrol } = useAuthStore();
  const { toplantilar, toplam, yukleniyor, toplantilariGetir } = useToplantiStore();
  const [toplantiKodu, setToplantiKodu] = useState('');
  const [aktifFiltre, setAktifFiltre] = useState<string | undefined>(undefined);

  useEffect(() => {
    oturumKontrol();
  }, [oturumKontrol]);

  useEffect(() => {
    if (!girisYapildi) {
      router.push('/giris');
      return;
    }
    toplantilariGetir(aktifFiltre);
  }, [girisYapildi, router, toplantilariGetir, aktifFiltre]);

  const hizliKatil = () => {
    const kod = toplantiKodu.trim();
    if (kod) router.push(`/toplanti/${kod}`);
  };

  const kodKopyala = async (kod: string) => {
    const basarili = await panoyaKopyala(kod);
    if (basarili) bildirim.basari('Toplantı kodu kopyalandı!');
  };

  if (!girisYapildi) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar />

        <main className="flex-1 p-6 lg:p-8 max-w-6xl">
          {/* Hoşgeldin */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">
              Merhaba, {kullanici?.ad_soyad?.split(' ')[0]}! 👋
            </h1>
            <p className="text-slate-500 mt-1">
              Toplantılarınızı yönetin veya yeni bir toplantı oluşturun.
            </p>
          </div>

          {/* Hızlı İşlemler */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Yeni toplantı */}
            <Link href="/toplanti/olustur">
              <Kart tiklama className="h-full">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-birincil-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-birincil-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Yeni Toplantı</h3>
                    <p className="text-sm text-slate-500">Toplantı oluştur</p>
                  </div>
                </div>
              </Kart>
            </Link>

            {/* Hızlı katılma */}
            <Kart>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={toplantiKodu}
                  onChange={(e) => setToplantiKodu(e.target.value)}
                  placeholder="Kodu yapıştır..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-birincil-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && hizliKatil()}
                />
                <Buton boyut="kucuk" onClick={hizliKatil}>Katıl</Buton>
              </div>
            </Kart>

            {/* İstatistik */}
            <Kart>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{toplam}</h3>
                  <p className="text-sm text-slate-500">Toplam Toplantı</p>
                </div>
              </div>
            </Kart>
          </div>

          {/* Filtreler */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { etiket: 'Tümü', deger: undefined },
              { etiket: 'Aktif', deger: 'aktif' },
              { etiket: 'Planlanmış', deger: 'planlanmis' },
              { etiket: 'Bitmiş', deger: 'bitmis' },
            ].map((filtre) => (
              <button
                key={filtre.etiket}
                onClick={() => setAktifFiltre(filtre.deger)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  aktifFiltre === filtre.deger
                    ? 'bg-birincil-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {filtre.etiket}
              </button>
            ))}
          </div>

          {/* Toplantı Listesi */}
          {yukleniyor ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-birincil-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : toplantilar.length === 0 ? (
            <Kart className="text-center py-16">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Henüz toplantı yok
              </h3>
              <p className="text-slate-500 mb-6">
                İlk toplantınızı oluşturarak başlayın.
              </p>
              <Link href="/toplanti/olustur">
                <Buton>Toplantı Oluştur</Buton>
              </Link>
            </Kart>
          ) : (
            <div className="space-y-3">
              {toplantilar.map((t) => (
                <Kart key={t.id} tiklama onClick={() => router.push(`/toplanti/${t.toplanti_kodu}`)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-slate-900 truncate">{t.baslik}</h3>
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${DURUM_RENKLERI[t.durum] || ''}`}>
                          {DURUM_ETIKETLERI[t.durum] || t.durum}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {t.katilimci_sayisi} / {t.maks_katilimci}
                        </span>
                        <span>{tarihFormatla(t.baslangic_zamani || t.olusturulma_tarihi)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); kodKopyala(t.toplanti_kodu); }}
                        className="px-3 py-1.5 text-xs font-mono bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        title="Kodu kopyala"
                      >
                        {t.toplanti_kodu}
                      </button>
                    </div>
                  </div>
                </Kart>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

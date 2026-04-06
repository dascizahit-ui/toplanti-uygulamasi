/**
 * Ana Sayfa (Landing Page)
 * ========================
 * Uygulamanın giriş sayfası. Giriş yapmamış kullanıcılara karşılama,
 * giriş yapmışlara panel yönlendirmesi sunar.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { APP_ADI } from '@/utils/sabitler';

export default function AnaSayfa() {
  const router = useRouter();
  const { girisYapildi, oturumKontrol } = useAuthStore();
  const [toplantiKodu, setToplantiKodu] = useState('');
  const [hazirlaniyor, setHazirlaniyor] = useState(true);

  useEffect(() => {
    oturumKontrol();
    setHazirlaniyor(false);
  }, [oturumKontrol]);

  // Giriş yapmışsa panele yönlendir
  useEffect(() => {
    if (!hazirlaniyor && girisYapildi) {
      router.push('/panel');
    }
  }, [hazirlaniyor, girisYapildi, router]);

  const hizliKatil = () => {
    const kod = toplantiKodu.trim();
    if (kod) {
      router.push(`/toplanti/${kod}`);
    }
  };

  if (hazirlaniyor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-birincil-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_38%),linear-gradient(180deg,_#f8fbff_0%,_#ffffff_48%,_#f8fafc_100%)]">
      {/* Navigasyon */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-birincil-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-slate-900">{APP_ADI}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/giris"
            className="px-5 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
          >
            Giriş Yap
          </Link>
          <Link
            href="/kayit"
            className="btn-birincil !py-2.5 !text-sm"
          >
            Kayıt Ol
          </Link>
        </div>
      </nav>

      {/* Hero Bölümü */}
      <main className="max-w-6xl mx-auto px-6 lg:px-12 pt-12 lg:pt-24 pb-20">
        <div className="text-center max-w-3xl mx-auto">
          {/* Rozet */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 shadow-sm ring-1 ring-birincil-100 text-birincil-700 text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Hazır olduğunuz anda toplantıya girin
          </div>

          {/* Başlık */}
          <h1 className="text-4xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.05] mb-6">
            Dağılmayan,
            <span className="text-birincil-600"> sade </span>
            toplantı deneyimi
          </h1>

          {/* Açıklama */}
          <p className="text-lg lg:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Linkle katılın, toplantıyı başlatın ve herkesin aynı ekranda rahatça kalmasını sağlayın.
          </p>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] items-stretch text-left">
            <div className="rounded-[28px] border border-white/80 bg-white/90 shadow-[0_30px_80px_rgba(15,23,42,0.08)] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-birincil-600/80">Hızlı Katıl</p>
                  <h2 className="text-2xl font-bold text-slate-900 mt-2">Toplantı kodunu girin</h2>
                </div>
                <div className="rounded-2xl bg-birincil-50 text-birincil-700 px-3 py-2 text-sm font-medium">
                  Misafir giriş destekli
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <input
                  type="text"
                  value={toplantiKodu}
                  onChange={(e) => setToplantiKodu(e.target.value)}
                  placeholder="Örn: abc-defg-hij"
                  className="form-girdi flex-1 text-center sm:text-left h-14"
                  onKeyDown={(e) => e.key === 'Enter' && hizliKatil()}
                />
                <button onClick={hizliKatil} className="btn-birincil w-full sm:w-auto h-14 min-w-[180px]">
                  Toplantıya Katıl
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-900 text-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Hemen Başlayın</p>
              <h2 className="text-2xl font-bold mt-2 mb-3">Toplantıyı birkaç adımda kurun</h2>
              <p className="text-sm leading-7 text-slate-300 mb-6">
                Hesap açın, toplantınızı oluşturun ve bağlantıyı paylaşın.
              </p>
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
                <Link href="/kayit" className="btn-birincil !justify-center">
                  Ücretsiz Hesap Oluştur
                </Link>
                <Link href="/giris" className="btn !justify-center bg-white/10 text-white hover:bg-white/15 ring-1 ring-white/10">
                  Giriş Yap
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-slate-400">
        © 2026 {APP_ADI}. Tüm hakları saklıdır.
      </footer>
    </div>
  );
}

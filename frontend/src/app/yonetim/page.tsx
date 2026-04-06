/**
 * Yönetim Paneli Sayfası
 * ======================
 * Admin kullanıcılar için kullanıcı, toplantı ve izin yönetimi.
 * Sekmeli arayüz ile üç yönetim bölümünü barındırır.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import KullaniciYonetimi from '@/components/yonetim/KullaniciYonetimi';
import ToplantiYonetimi from '@/components/yonetim/ToplantiYonetimi';
import IzinYonetimi from '@/components/yonetim/IzinYonetimi';
import { sinifBirlestir } from '@/utils/yardimcilar';

type SekmeId = 'kullanicilar' | 'toplantilar' | 'izinler';

const sekmeler: { id: SekmeId; etiket: string; ikon: React.ReactNode }[] = [
  {
    id: 'kullanicilar',
    etiket: 'Kullanıcılar',
    ikon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'toplantilar',
    etiket: 'Toplantılar',
    ikon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'izinler',
    etiket: 'İzin Politikaları',
    ikon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

export default function YonetimSayfasi() {
  const router = useRouter();
  const { kullanici, girisYapildi, oturumKontrol } = useAuthStore();
  const [aktifSekme, setAktifSekme] = useState<SekmeId>('kullanicilar');

  useEffect(() => {
    oturumKontrol();
  }, [oturumKontrol]);

  useEffect(() => {
    if (!girisYapildi) {
      router.push('/giris');
      return;
    }
    if (kullanici && kullanici.rol !== 'admin') {
      router.push('/panel');
    }
  }, [girisYapildi, kullanici, router]);

  if (!girisYapildi || kullanici?.rol !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar />

        <main className="flex-1 p-6 lg:p-8 max-w-6xl">
          {/* Başlık */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Yönetim Paneli</h1>
            <p className="text-slate-500 mt-1">
              Kullanıcıları, toplantıları ve izin politikalarını yönetin.
            </p>
          </div>

          {/* Sekme navigasyonu */}
          <div className="flex items-center gap-1 mb-8 bg-white rounded-xl border border-slate-200 p-1 w-fit">
            {sekmeler.map((sekme) => (
              <button
                key={sekme.id}
                onClick={() => setAktifSekme(sekme.id)}
                className={sinifBirlestir(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                  aktifSekme === sekme.id
                    ? 'bg-birincil-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                {sekme.ikon}
                {sekme.etiket}
              </button>
            ))}
          </div>

          {/* Sekme içeriği */}
          <div className="animasyon-belirme">
            {aktifSekme === 'kullanicilar' && <KullaniciYonetimi />}
            {aktifSekme === 'toplantilar' && <ToplantiYonetimi />}
            {aktifSekme === 'izinler' && <IzinYonetimi />}
          </div>
        </main>
      </div>
    </div>
  );
}

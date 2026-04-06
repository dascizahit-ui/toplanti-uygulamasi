/**
 * Kayıt Sayfası
 * =============
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import KayitFormu from '@/components/auth/KayitFormu';
import { APP_ADI } from '@/utils/sabitler';

export default function KayitSayfasi() {
  const router = useRouter();
  const { girisYapildi, oturumKontrol } = useAuthStore();

  useEffect(() => {
    oturumKontrol();
  }, [oturumKontrol]);

  useEffect(() => {
    if (girisYapildi) router.push('/panel');
  }, [girisYapildi, router]);

  return (
    <div className="min-h-screen flex">
      {/* Sol: Görsel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-green-600 to-teal-700 items-center justify-center p-12">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-6">🚀</div>
          <h2 className="text-3xl font-bold mb-4">Hemen Başlayın</h2>
          <p className="text-green-100 text-lg leading-relaxed">
            Ücretsiz hesap oluşturun, toplantılarınızı planlayın 
            ve ekibinizi anında bir araya getirin.
          </p>
          <div className="mt-8 space-y-3 text-left">
            {['HD video ve ses kalitesi', 'Güçlü izin yönetimi', 'Anlık sohbet özelliği', 'Ekran paylaşımı'].map((ozellik, i) => (
              <div key={i} className="flex items-center gap-3 text-green-50">
                <svg className="w-5 h-5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {ozellik}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sağ: Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-10">
            <div className="w-10 h-10 bg-birincil-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900">{APP_ADI}</span>
          </Link>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Hesap Oluşturun
          </h1>
          <p className="text-slate-500 mb-8">
            Birkaç adımda kayıt olun ve hemen toplantı oluşturmaya başlayın.
          </p>

          <KayitFormu />
        </div>
      </div>
    </div>
  );
}

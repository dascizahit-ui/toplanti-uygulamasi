/**
 * Giriş Sayfası
 * =============
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import GirisFormu from '@/components/auth/GirisFormu';
import { APP_ADI } from '@/utils/sabitler';

export default function GirisSayfasi() {
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
      {/* Sol: Form */}
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

          {/* Başlık */}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Tekrar Hoş Geldiniz
          </h1>
          <p className="text-slate-500 mb-8">
            Hesabınıza giriş yaparak toplantılarınıza devam edin.
          </p>

          {/* Form */}
          <GirisFormu />
        </div>
      </div>

      {/* Sağ: Görsel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-birincil-600 to-birincil-800 items-center justify-center p-12">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-6">🎥</div>
        </div>
      </div>
    </div>
  );
}

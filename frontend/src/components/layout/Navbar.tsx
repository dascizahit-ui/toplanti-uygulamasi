/**
 * Üst Navigasyon Çubuğu
 * ======================
 * Giriş yapmış kullanıcılar için üst menü.
 * Logo, arama, bildirimler ve profil menüsü.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { APP_ADI, ROL_ETIKETLERI } from '@/utils/sabitler';
import { basHarfler, avatarRengi } from '@/utils/yardimcilar';

export default function Navbar() {
  const router = useRouter();
  const { kullanici, cikisYap } = useAuthStore();
  const [menuAcik, setMenuAcik] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dış tıklamada menüyü kapat
  useEffect(() => {
    const isleyici = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAcik(false);
      }
    };
    document.addEventListener('mousedown', isleyici);
    return () => document.removeEventListener('mousedown', isleyici);
  }, []);

  const cikisIslemi = () => {
    cikisYap();
    router.push('/giris');
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Sol: Logo */}
          <Link href="/panel" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-birincil-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-900 hidden sm:block">{APP_ADI}</span>
          </Link>

          {/* Orta: Hızlı katılma */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Toplantı kodunu yapıştırın..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-birincil-500 focus:border-transparent transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const kod = (e.target as HTMLInputElement).value.trim();
                    if (kod) router.push(`/toplanti/${kod}`);
                  }
                }}
              />
            </div>
          </div>

          {/* Sağ: Profil */}
          <div className="flex items-center gap-3">
            {/* Yeni toplantı */}
            <Link
              href="/toplanti/olustur"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-birincil-600 rounded-xl hover:bg-birincil-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Yeni Toplantı
            </Link>

            {/* Profil menüsü */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuAcik(!menuAcik)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${avatarRengi(kullanici?.id || '')}`}>
                  {basHarfler(kullanici?.ad_soyad || '?')}
                </div>
                <span className="hidden lg:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
                  {kullanici?.ad_soyad}
                </span>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menü */}
              {menuAcik && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lg border border-slate-200 py-2 animasyon-belirme">
                  {/* Kullanıcı bilgisi */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900">{kullanici?.ad_soyad}</p>
                    <p className="text-xs text-slate-500">{kullanici?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-birincil-100 text-birincil-700 rounded-full">
                      {ROL_ETIKETLERI[kullanici?.rol || 'kullanici']}
                    </span>
                  </div>

                  {/* Menü öğeleri */}
                  <div className="py-1">
                    <Link href="/panel" onClick={() => setMenuAcik(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /></svg>
                      Panel
                    </Link>

                    {kullanici?.rol === 'admin' && (
                      <Link href="/yonetim" onClick={() => setMenuAcik(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                        Yönetim Paneli
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-slate-100 py-1">
                    <button onClick={cikisIslemi}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Çıkış Yap
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

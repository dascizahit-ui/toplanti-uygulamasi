/**
 * Yan Menü Bileşeni
 * =================
 * Panel sayfasındaki sol navigasyon menüsü.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { sinifBirlestir } from '@/utils/yardimcilar';

interface MenuOgesi {
  etiket: string;
  yol: string;
  ikon: React.ReactNode;
  sadecAdmin?: boolean;
}

const menuOgeleri: MenuOgesi[] = [
  {
    etiket: 'Panel',
    yol: '/panel',
    ikon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  },
  {
    etiket: 'Yeni Toplantı',
    yol: '/toplanti/olustur',
    ikon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  },
  {
    etiket: 'Yönetim',
    yol: '/yonetim',
    ikon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>,
    sadecAdmin: true,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { kullanici } = useAuthStore();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 bg-white min-h-[calc(100vh-64px)]">
      <nav className="flex-1 p-4 space-y-1">
        {menuOgeleri
          .filter((oge) => !oge.sadecAdmin || kullanici?.rol === 'admin')
          .map((oge) => {
            const aktif = pathname === oge.yol;
            return (
              <Link
                key={oge.yol}
                href={oge.yol}
                className={sinifBirlestir(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  aktif
                    ? 'bg-birincil-50 text-birincil-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <span className={aktif ? 'text-birincil-600' : 'text-slate-400'}>
                  {oge.ikon}
                </span>
                {oge.etiket}
              </Link>
            );
          })}
      </nav>

      {/* Alt bilgi */}
      <div className="p-4 border-t border-slate-100">
        <div className="hidden lg:block text-[10px] text-slate-500 font-medium px-2 py-3 mt-auto border-t border-white/5">
          yb Toplantı v1.0.0
        </div>
      </div>
    </aside>
  );
}

/**
 * Alt Bilgi Bileşeni
 * ==================
 */

'use client';

import { APP_ADI } from '@/utils/sabitler';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} {APP_ADI}. Tüm hakları saklıdır.
          </p>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <span>Gizlilik Politikası</span>
            <span>Kullanım Koşulları</span>
            <span>İletişim</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

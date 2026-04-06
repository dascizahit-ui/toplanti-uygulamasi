/**
 * Giriş Alanı Bileşeni
 * =====================
 * Form input bileşeni. Etiket, hata mesajı ve ikon desteği.
 */

'use client';

import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { sinifBirlestir } from '@/utils/yardimcilar';

interface GirisAlaniProps extends InputHTMLAttributes<HTMLInputElement> {
  etiket?: string;
  hata?: string;
  yardimMetni?: string;
  ikon?: React.ReactNode;
  sifreAlani?: boolean;
}

const GirisAlani = forwardRef<HTMLInputElement, GirisAlaniProps>(
  (
    { etiket, hata, yardimMetni, ikon, sifreAlani, className, type, ...props },
    ref
  ) => {
    const [sifreGoster, setSifreGoster] = useState(false);

    const gercekTip = sifreAlani
      ? sifreGoster ? 'text' : 'password'
      : type;

    return (
      <div className="w-full">
        {/* Etiket */}
        {etiket && (
          <label className="form-etiket">
            {etiket}
          </label>
        )}

        {/* Input Sarmalayıcı */}
        <div className="relative">
          {/* Sol ikon */}
          {ikon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              {ikon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            type={gercekTip}
            className={sinifBirlestir(
              'w-full px-4 py-3 rounded-xl border bg-white text-slate-900',
              'placeholder-slate-400 transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              hata
                ? 'border-red-400 focus:ring-red-400'
                : 'border-slate-300 focus:ring-birincil-500',
              !!ikon && 'pl-11',
              !!sifreAlani && 'pr-12',
              className
            )}
            {...props}
          />

          {/* Şifre göster/gizle */}
          {sifreAlani && (
            <button
              type="button"
              onClick={() => setSifreGoster(!sifreGoster)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
            >
              {sifreGoster ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Hata mesajı */}
        {hata && (
          <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {hata}
          </p>
        )}

        {/* Yardım metni */}
        {yardimMetni && !hata && (
          <p className="mt-1.5 text-sm text-slate-400">{yardimMetni}</p>
        )}
      </div>
    );
  }
);

GirisAlani.displayName = 'GirisAlani';
export default GirisAlani;

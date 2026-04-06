/**
 * Buton Bileşeni
 * ==============
 * Uygulama genelinde kullanılan çok amaçlı buton.
 * Varyantlar: birincil, ikincil, tehlike, hayalet
 * Boyutlar: kucuk, normal, buyuk
 */

'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { sinifBirlestir } from '@/utils/yardimcilar';

// Varyant stilleri
const varyantlar = {
  birincil:
    'bg-birincil-600 text-white hover:bg-birincil-700 focus:ring-birincil-500 active:scale-[0.98]',
  ikincil:
    'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400',
  tehlike:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  hayalet:
    'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-400',
  basari:
    'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
} as const;

// Boyut stilleri
const boyutlar = {
  kucuk: 'px-3 py-1.5 text-xs rounded-lg',
  normal: 'px-5 py-2.5 text-sm rounded-xl',
  buyuk: 'px-8 py-3.5 text-base rounded-xl',
} as const;

interface ButonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  varyant?: keyof typeof varyantlar;
  boyut?: keyof typeof boyutlar;
  yukleniyor?: boolean;
  tamGenislik?: boolean;
  ikon?: ReactNode;
}

export default function Buton({
  children,
  varyant = 'birincil',
  boyut = 'normal',
  yukleniyor = false,
  tamGenislik = false,
  ikon,
  className,
  disabled,
  ...props
}: ButonProps) {
  return (
    <button
      className={sinifBirlestir(
        'inline-flex items-center justify-center gap-2 font-semibold',
        'transition-all duration-200 ease-in-out',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        varyantlar[varyant],
        boyutlar[boyut],
        tamGenislik && 'w-full',
        className
      )}
      disabled={disabled || yukleniyor}
      {...props}
    >
      {yukleniyor ? (
        <>
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Yükleniyor...
        </>
      ) : (
        <>
          {ikon && <span className="flex-shrink-0">{ikon}</span>}
          {children}
        </>
      )}
    </button>
  );
}

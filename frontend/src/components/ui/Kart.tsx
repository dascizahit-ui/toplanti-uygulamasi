/**
 * Kart Bileşeni
 * =============
 * İçerik kartı. Başlık, alt bilgi ve hover efekti destekler.
 */

'use client';

import { HTMLAttributes, ReactNode } from 'react';
import { sinifBirlestir } from '@/utils/yardimcilar';

interface KartProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  baslik?: string;
  altBilgi?: ReactNode;
  tiklama?: boolean;
  dolgu?: boolean;
}

export default function Kart({
  children,
  baslik,
  altBilgi,
  tiklama = false,
  dolgu = true,
  className,
  ...props
}: KartProps) {
  return (
    <div
      className={sinifBirlestir(
        'bg-white rounded-2xl border border-slate-200 shadow-sm',
        'transition-all duration-200',
        tiklama && 'cursor-pointer hover:shadow-md hover:border-birincil-200 active:scale-[0.99]',
        className
      )}
      {...props}
    >
      {baslik && (
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">{baslik}</h3>
        </div>
      )}
      <div className={dolgu ? 'p-6' : ''}>{children}</div>
      {altBilgi && (
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          {altBilgi}
        </div>
      )}
    </div>
  );
}

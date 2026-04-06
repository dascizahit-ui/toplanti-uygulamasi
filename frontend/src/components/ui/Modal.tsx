/**
 * Modal Bileşeni
 * ==============
 * Genel amaçlı modal dialog. Arka plan örtüsü ve ESC kapatma destekli.
 */

'use client';

import { ReactNode, useEffect, useCallback } from 'react';
import { sinifBirlestir } from '@/utils/yardimcilar';

interface ModalProps {
  acik: boolean;
  kapatFn: () => void;
  baslik?: string;
  children: ReactNode;
  altBilgi?: ReactNode;
  boyut?: 'kucuk' | 'normal' | 'buyuk';
}

const boyutSiniflari = {
  kucuk: 'max-w-md',
  normal: 'max-w-lg',
  buyuk: 'max-w-2xl',
};

export default function Modal({
  acik,
  kapatFn,
  baslik,
  children,
  altBilgi,
  boyut = 'normal',
}: ModalProps) {
  // ESC tuşu ile kapatma
  const escIsleyici = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') kapatFn();
    },
    [kapatFn]
  );

  useEffect(() => {
    if (acik) {
      document.addEventListener('keydown', escIsleyici);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', escIsleyici);
      document.body.style.overflow = '';
    };
  }, [acik, escIsleyici]);

  if (!acik) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Arka plan örtüsü */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={kapatFn}
      />

      {/* Modal içerik */}
      <div
        className={sinifBirlestir(
          'relative w-full bg-white rounded-2xl shadow-2xl',
          'animasyon-belirme',
          boyutSiniflari[boyut]
        )}
      >
        {/* Başlık */}
        {baslik && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">{baslik}</h2>
            <button
              onClick={kapatFn}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* İçerik */}
        <div className="p-6">{children}</div>

        {/* Alt bilgi */}
        {altBilgi && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
            {altBilgi}
          </div>
        )}
      </div>
    </div>
  );
}

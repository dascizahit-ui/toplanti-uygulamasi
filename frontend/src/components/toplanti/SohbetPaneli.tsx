'use client';

import { useState, useRef, useEffect } from 'react';
import { useSohbetStore } from '@/store/sohbetStore';
import { useAuthStore } from '@/store/authStore';
import type { Mesaj } from '@/types';
import { basHarfler, avatarRengi, saatFormatla, sinifBirlestir } from '@/utils/yardimcilar';
import { TOPLANTI } from '@/utils/sabitler';

interface SohbetPaneliProps {
  wsMesajGonder?: (olay: string, veri?: any) => void;
}

export default function SohbetPaneli({ wsMesajGonder }: SohbetPaneliProps) {
  const { mesajlar, panelAcik, panelKapat } = useSohbetStore();
  const { kullanici } = useAuthStore();
  const [yeniMesaj, setYeniMesaj] = useState('');
  const mesajListeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mesajListeRef.current) {
      mesajListeRef.current.scrollTop = mesajListeRef.current.scrollHeight;
    }
  }, [mesajlar]);

  useEffect(() => {
    if (panelAcik) inputRef.current?.focus();
  }, [panelAcik]);

  const mesajGonder = () => {
    const icerik = yeniMesaj.trim();
    if (!icerik || icerik.length > TOPLANTI.MESAJ_MAKS_UZUNLUK) return;

    wsMesajGonder?.('sohbet_mesaji', { icerik, tip: 'metin' });
    setYeniMesaj('');
  };

  if (!panelAcik) return null;

  return (
    <div className="flex h-full w-full flex-col cam border-y-0 border-r-0">
      <div className="border-b border-white/5 px-6 py-6 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Sohbet</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Toplanti ici mesajlar</h3>
            <p className="mt-1 text-xs text-slate-400">{mesajlar.length} mesaj gorunuyor</p>
          </div>
          <button
            onClick={panelKapat}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div ref={mesajListeRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 ozel-kaydirma">
        {mesajlar.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 text-center text-slate-500">
            <svg className="mb-3 w-10 h-10 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-medium text-slate-300">Henuz mesaj yok</p>
            <p className="mt-1 text-xs text-slate-500">Kisa bir mesaj gondererek baslayabilirsiniz.</p>
          </div>
        ) : (
          mesajlar.map((mesaj) => (
            <MesajBalonu key={mesaj.id} mesaj={mesaj} benimMi={mesaj.gonderen_id === kullanici?.id} />
          ))
        )}
      </div>

      <div className="border-t border-white/5 p-3 flex-shrink-0">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-2">
          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              type="text"
              value={yeniMesaj}
              onChange={(e) => setYeniMesaj(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && mesajGonder()}
              placeholder="Mesaj yazin"
              maxLength={TOPLANTI.MESAJ_MAKS_UZUNLUK}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              onClick={mesajGonder}
              disabled={!yeniMesaj.trim()}
              className="rounded-2xl bg-birincil-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-birincil-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Gonder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MesajBalonu({ mesaj, benimMi }: { mesaj: Mesaj; benimMi: boolean }) {
  if (mesaj.tip === 'sistem') {
    return (
      <div className="text-center">
        <span className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
          {mesaj.icerik}
        </span>
      </div>
    );
  }

  return (
    <div className={sinifBirlestir('flex gap-2 animasyon-belirme', benimMi && 'flex-row-reverse')}>
      {!benimMi && (
        <div className={sinifBirlestir(
          'mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
          avatarRengi(mesaj.gonderen_id || '')
        )}>
          {basHarfler(mesaj.gonderen_adi)}
        </div>
      )}

      <div className={sinifBirlestir('max-w-[84%]', benimMi ? 'items-end' : 'items-start')}>
        {!benimMi && (
          <p className="mb-1 ml-1 text-[11px] text-slate-400">{mesaj.gonderen_adi}</p>
        )}
        <div
          className={sinifBirlestir(
            'rounded-3xl px-4 py-3 text-sm leading-6 break-words shadow-sm transition-all duration-300',
            benimMi
              ? 'rounded-tr-none bg-birincil-600 text-white'
              : 'rounded-tl-none border border-white/10 bg-white/5 text-slate-200'
          )}
        >
          {mesaj.icerik}
        </div>
        <p className={sinifBirlestir('mt-1.5 text-[10px] font-medium tracking-wide text-slate-500', benimMi ? 'mr-1.5 text-right' : 'ml-1.5')}>
          {saatFormatla(mesaj.gonderilme_zamani)}
        </p>
      </div>
    </div>
  );
}

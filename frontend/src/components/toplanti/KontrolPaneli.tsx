'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMedyaStore } from '@/store/medyaStore';
import { useSohbetStore } from '@/store/sohbetStore';
import { useToplantiStore } from '@/store/toplantiStore';
import { useAuthStore } from '@/store/authStore';
import Modal from '@/components/ui/Modal';
import Buton from '@/components/ui/Buton';
import bildirim from '@/components/ui/Bildirim';
import { sinifBirlestir } from '@/utils/yardimcilar';

interface KontrolPaneliProps {
  toplantiId: string;
  katilimciPaneliAcik: boolean;
  katilimciPaneliAcKapat: () => void;
  wsMesajGonder?: (olay: string, veri?: any) => void;
  kameraToggle: () => void;
  mikrofonToggle: () => void;
  ekranPaylasimiToggle: () => void;
}

function IslemButonu({
  aktif,
  vurgu,
  title,
  onClick,
  disabled,
  children,
  badge,
}: {
  aktif?: boolean;
  vurgu?: 'kirmizi' | 'mavi' | 'sari' | 'normal';
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  badge?: string | number;
}) {
  const renk =
    vurgu === 'kirmizi'
      ? aktif
        ? 'bg-red-500/80 text-white shadow-lg shadow-red-500/20'
        : 'bg-red-500/20 text-red-400 border border-red-500/30'
      : vurgu === 'mavi'
        ? aktif
          ? 'bg-birincil-500/80 text-white shadow-lg shadow-birincil-500/20'
          : 'bg-white/5 text-slate-300 border border-white/10'
        : vurgu === 'sari'
          ? aktif
            ? 'bg-yellow-500/80 text-black shadow-lg shadow-yellow-500/20'
            : 'bg-white/5 text-slate-300 border border-white/10'
          : aktif
            ? 'bg-white/90 text-black shadow-lg'
            : 'bg-white/5 text-slate-300 border border-white/10';

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={sinifBirlestir(
        'relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95',
        renk,
        disabled && 'opacity-30 cursor-not-allowed scale-100'
      )}
    >
      {children}
      {badge !== undefined && badge !== 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function KontrolPaneli({
  toplantiId,
  katilimciPaneliAcik,
  katilimciPaneliAcKapat,
  wsMesajGonder,
  kameraToggle,
  mikrofonToggle,
  ekranPaylasimiToggle,
}: KontrolPaneliProps) {
  const router = useRouter();
  const { kullanici } = useAuthStore();
  const { mikrofon, kamera, ekranPaylasimi } = useMedyaStore();
  const { panelAcik, panelAcKapat, okunmamisSayisi } = useSohbetStore();
  const { toplantidanAyril, toplantiSonlandir, aktifToplanti, katilimcilar, izinGuncelle } = useToplantiStore();
  const [ayrilModalAcik, setAyrilModalAcik] = useState(false);
  const [islemYapiliyor, setIslemYapiliyor] = useState(false);
  const [gorunur, setGorunur] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    setGorunur(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setGorunur(false);
    }, 5000);
  }, []);

  useEffect(() => {
    resetTimer();
    const windowEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart'];
    const handler = () => resetTimer();
    
    windowEvents.forEach(event => window.addEventListener(event, handler));
    return () => {
      windowEvents.forEach(event => window.removeEventListener(event, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  const ben = katilimcilar.find((k) => k.kullanici_id === kullanici?.id);
  const elKaldirdi = ben?.el_kaldirdi || false;
  const sahipMi = aktifToplanti?.olusturan_id === kullanici?.id || kullanici?.rol === 'admin';
  const aktifSayi = katilimcilar.filter((k) => k.aktif).length;

  const elKaldirdiToggle = async () => {
    if (!kullanici || !aktifToplanti || islemYapiliyor) return;
    setIslemYapiliyor(true);
    try {
      const basarili = await izinGuncelle(aktifToplanti.id, kullanici.id, {
        el_kaldirdi: !elKaldirdi,
      });
      if (!basarili) throw new Error('islem_basarisiz');
      bildirim.basari(!elKaldirdi ? 'Soz istediniz' : 'Soz isteginizi geri cektiniz');
    } catch { bildirim.hata('Islem basarisiz'); }
    finally { setIslemYapiliyor(false); }
  };

  const ayrilIsle = async () => {
    await toplantidanAyril(toplantiId);
    useMedyaStore.getState().yerelAkim?.getTracks().forEach((t) => t.stop());
    router.push('/panel');
  };

  const sonlandirIsle = async () => {
    await toplantiSonlandir(toplantiId);
    useMedyaStore.getState().yerelAkim?.getTracks().forEach((t) => t.stop());
    router.push('/panel');
  };

  return (
    <>
      <div 
        className={sinifBirlestir(
          "fixed inset-x-0 bottom-4 sm:bottom-8 z-40 flex justify-center px-2 transition-all duration-700 ease-in-out",
          gorunur ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
        )}
      >
        <div className="cam flex items-center gap-2 sm:gap-3 rounded-3xl p-2 sm:p-3 shadow-2xl border border-white/10 max-w-full overflow-x-auto ozel-kaydirma hide-scrollbar">
          {/* Media Group */}
          <div className="flex items-center gap-1 sm:gap-2 pr-2 sm:pr-3 border-r border-white/10">
            <IslemButonu
              aktif={mikrofon}
              vurgu={mikrofon ? 'mavi' : 'kirmizi'}
              title={mikrofon ? 'Sustur' : 'Sesi Ac'}
              onClick={mikrofonToggle}
            >
              {mikrofon ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              )}
            </IslemButonu>

            <IslemButonu
              aktif={kamera}
              vurgu={kamera ? 'mavi' : 'kirmizi'}
              title={kamera ? 'Kamerayi Kapat' : 'Kamerayi Ac'}
              onClick={kameraToggle}
            >
              {kamera ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3l18 18M10.584 10.587A2 2 0 0012 14a2 2 0 001.416-.586M9.879 5H6a2 2 0 00-2 2v10a2 2 0 002 2h10c.55 0 1.05-.221 1.411-.579M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1.05-.152.54" />
                </svg>
              )}
            </IslemButonu>

            <IslemButonu
              aktif={ekranPaylasimi}
              vurgu="normal"
              title="Ekran Paylas"
              onClick={ekranPaylasimiToggle}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </IslemButonu>
          </div>

          {/* Social/Interaction Group */}
          <div className="flex items-center gap-1 sm:gap-2">
            <IslemButonu
              aktif={panelAcik}
              vurgu="mavi"
              title="Sohbet"
              onClick={panelAcKapat}
              badge={okunmamisSayisi}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </IslemButonu>

            <IslemButonu
              aktif={katilimciPaneliAcik}
              vurgu="mavi"
              title="Katilimcilar"
              onClick={katilimciPaneliAcKapat}
              badge={aktifSayi}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </IslemButonu>

            <IslemButonu
              aktif={elKaldirdi}
              vurgu="sari"
              title="Soz Iste"
              onClick={elKaldirdiToggle}
              disabled={islemYapiliyor}
            >
              <svg className={sinifBirlestir('w-5 h-5', elKaldirdi && 'animate-bounce')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
            </IslemButonu>
          </div>

          {/* Quick Info & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-white/10">
             <button
               onClick={() => {
                 navigator.clipboard.writeText(window.location.href);
                 bildirim.basari('Link kopyalandi');
               }}
               className="h-10 px-4 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-medium text-slate-300 hover:bg-white/10 transition-colors"
             >
               Baglanti
             </button>

             <button
              onClick={() => setAyrilModalAcik(true)}
              className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-2xl bg-red-500/80 text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20 flex-shrink-0"
              title="Ayril"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <Modal
        acik={ayrilModalAcik}
        kapatFn={() => setAyrilModalAcik(false)}
        baslik="Toplantidan ayril"
        boyut="kucuk"
        altBilgi={
          <div className="flex gap-2">
            <Buton varyant="ikincil" boyut="kucuk" onClick={() => setAyrilModalAcik(false)}>Iptal</Buton>
            <Buton varyant="tehlike" boyut="kucuk" onClick={ayrilIsle}>Ayril</Buton>
            {sahipMi && <Buton varyant="tehlike" boyut="kucuk" onClick={sonlandirIsle}>Sonlandir</Buton>}
          </div>
        }
      >
        <p className="text-slate-300">Toplantidan ayrilmak istediginize emin misiniz?</p>
      </Modal>
    </>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useMedyaStore } from '@/store/medyaStore';
import { useAuthStore } from '@/store/authStore';

interface EkranPaylasimiProps {
  paylasanId?: string | null;
  paylasanAdi?: string;
  onPaylasimiDurdur?: () => void;
}

export default function EkranPaylasimi({
  paylasanId,
  paylasanAdi,
  onPaylasimiDurdur,
}: EkranPaylasimiProps) {
  const sahneRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { kullanici } = useAuthStore();
  const { ekranAkimi, ekranPaylasimi, ekranPaylasiminiDurdur, uzakMedyalar } = useMedyaStore();

  const benPaylasiyorum = paylasanId === kullanici?.id;
  const uzakEkranAkimi = paylasanId ? uzakMedyalar.get(paylasanId)?.ekranStream ?? null : null;
  const gosterilenAkim = benPaylasiyorum ? ekranAkimi : uzakEkranAkimi;
  const fullscreenDestegiVar =
    typeof document !== 'undefined' && typeof document.exitFullscreen === 'function';

  useEffect(() => {
    if (!videoRef.current) return;

    if (!gosterilenAkim) {
      videoRef.current.srcObject = null;
      return;
    }

    if (videoRef.current.srcObject !== gosterilenAkim) {
      videoRef.current.srcObject = gosterilenAkim;
      videoRef.current.play().catch(() => {});
    }
  }, [gosterilenAkim]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const senkronla = () => {
      setIsFullscreen(document.fullscreenElement === sahneRef.current);
    };

    document.addEventListener('fullscreenchange', senkronla);
    senkronla();

    return () => {
      document.removeEventListener('fullscreenchange', senkronla);
    };
  }, []);

  useEffect(() => {
    if ((!paylasanId && !ekranPaylasimi) && document.fullscreenElement === sahneRef.current) {
      document.exitFullscreen().catch(() => {});
    }
  }, [ekranPaylasimi, paylasanId]);

  if (!paylasanId && !ekranPaylasimi) return null;

  const fullscreenDegistir = async () => {
    if (!fullscreenDestegiVar || !sahneRef.current) return;

    if (document.fullscreenElement === sahneRef.current) {
      await document.exitFullscreen().catch(() => {});
      return;
    }

    await sahneRef.current.requestFullscreen().catch(() => {});
  };

  const paylasimiDurdur = () => {
    if (onPaylasimiDurdur) {
      onPaylasimiDurdur();
      return;
    }
    ekranPaylasiminiDurdur();
  };

  return (
    <div
      ref={sahneRef}
      className="relative flex h-full min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-black"
    >
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain" />

      {!gosterilenAkim && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl border border-white/10 bg-slate-900/75 px-4 py-3 text-sm text-slate-200 backdrop-blur-sm">
            Paylasilan ekran yukleniyor
          </div>
        </div>
      )}

      <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-3">
        <div className="min-w-0 rounded-2xl bg-black/60 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.65)]" />
            <span className="truncate text-sm font-medium text-white">
              {benPaylasiyorum
                ? 'Ekraninizi paylasiyorsunuz'
                : `${paylasanAdi || 'Birisi'} ekran paylasiyor`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {fullscreenDestegiVar && (
            <button
              onClick={fullscreenDegistir}
              className="rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/75"
            >
              {isFullscreen ? 'Tam ekrandan cik' : 'Tam ekran'}
            </button>
          )}
          {benPaylasiyorum && (
            <button
              onClick={paylasimiDurdur}
              className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
            >
              Paylasimi durdur
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

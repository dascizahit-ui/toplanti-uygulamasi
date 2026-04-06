'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMedyaStore } from '@/store/medyaStore';
import { useAuthStore } from '@/store/authStore';
import { basHarfler, avatarRengi, sinifBirlestir } from '@/utils/yardimcilar';
import { ROL_ETIKETLERI } from '@/utils/sabitler';

interface Props {
  tamEkranId: string | null;
  setTamEkranId: (id: string | null) => void;
  gorunum?: 'grid' | 'serit';
  tiklanabilir?: boolean;
}

function KartCerceve({
  children,
  tamEkran,
  tiklanabilir,
  tiklama,
  sinifAdi,
  gorunum,
}: {
  children: ReactNode;
  tamEkran: boolean;
  tiklanabilir: boolean;
  tiklama: () => void;
  sinifAdi?: string;
  gorunum: 'grid' | 'serit';
}) {
  const tiklanabilirMi = tamEkran || tiklanabilir;

  return (
    <div
      className={sinifBirlestir(
        'group relative overflow-hidden rounded-[32px] border border-white/5 bg-slate-950/40 shadow-2xl transition-all duration-500 hover:border-white/20',
        gorunum === 'serit' ? 'h-full aspect-video w-[280px] flex-none md:w-[320px]' : 'h-full w-full aspect-video',
        tiklanabilirMi ? 'cursor-pointer' : 'cursor-default',
        sinifAdi,
        tamEkran && 'fixed inset-4 z-50 !w-auto !h-auto aspect-auto bg-black/95 rounded-[40px]'
      )}
      onClick={tiklanabilirMi ? tiklama : undefined}
    >
      {children}
    </div>
  );
}

function StatusOverlays({
  mikrofon,
  kamera,
  dusukBant,
  adSoyad,
  sen,
  rol,
}: {
  mikrofon: boolean;
  kamera: boolean;
  dusukBant?: boolean;
  adSoyad: string;
  sen?: boolean;
  rol?: string;
}) {
  return (
    <>
      {/* Top Left Status */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        {dusukBant && (
          <div className="flex h-8 items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-[10px] font-bold text-amber-500 backdrop-blur-md border border-amber-500/20">
            <svg className="h-3.5 w-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            DUSUK BAGLANTI
          </div>
        )}
        {!kamera && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3l18 18M10.584 10.587A2 2 0 0012 14a2 2 0 001.416-.586M9.879 5H6a2 2 0 00-2 2v10a2 2 0 002 2h10c.55 0 1.05-.221 1.411-.579M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-.152.54" />
            </svg>
          </div>
        )}
      </div>

      {/* Bottom Name Tag */}
      <div className="name-tag">
        <div className={sinifBirlestir(
          "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold",
          mikrofon ? "bg-birincil-500 text-white" : "bg-red-500 text-white"
        )}>
          {mikrofon ? (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </div>
        <span className="max-w-[120px] truncate">
          {adSoyad} {sen ? '(Sen)' : ''}
        </span>
        {rol && rol !== 'katilimci' && (
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wider opacity-70">
            {ROL_ETIKETLERI[rol] || rol}
          </span>
        )}
      </div>
    </>
  );
}

function AvatarAlan({
  id,
  adSoyad,
  tamEkran,
}: {
  id: string;
  adSoyad: string;
  tamEkran: boolean;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-black">
      <div className="relative">
        <div className="absolute -inset-4 rounded-full bg-birincil-500/10 blur-xl animate-pulse" />
        <div
          className={sinifBirlestir(
            'relative flex items-center justify-center rounded-full text-white font-bold shadow-2xl border border-white/5',
            tamEkran ? 'h-36 w-36 text-6xl' : 'h-24 w-24 text-3xl',
            avatarRengi(id)
          )}
        >
          {basHarfler(adSoyad)}
        </div>
      </div>
      <p className="mt-6 text-sm font-medium tracking-wide text-slate-400 uppercase">{adSoyad}</p>
    </div>
  );
}

function UzakVideoKarti({
  peerId,
  tamEkran,
  tiklama,
  sinifAdi,
  gorunum,
  tiklanabilir,
}: {
  peerId: string;
  tamEkran: boolean;
  tiklama: () => void;
  sinifAdi?: string;
  gorunum: 'grid' | 'serit';
  tiklanabilir: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const katilimci = useMedyaStore((s) => s.uzakMedyalar.get(peerId));

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (katilimci?.videoStream && katilimci.medya.kamera) {
      if (videoElement.srcObject !== katilimci.videoStream) {
        videoElement.srcObject = katilimci.videoStream;
        videoElement.play().catch(() => {});
      }
    } else {
      // CLEAR srcObject to prevent frozen frames
      videoElement.srcObject = null;
    }
  }, [katilimci?.videoStream, katilimci?.medya.kamera]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!katilimci?.sesStream) {
      audioRef.current.srcObject = null;
      return;
    }
    if (audioRef.current.srcObject !== katilimci.sesStream) {
      audioRef.current.srcObject = katilimci.sesStream;
      audioRef.current.play().catch(() => {});
    }
  }, [katilimci?.sesStream]);

  if (!katilimci) return null;

  return (
    <KartCerceve
      tamEkran={tamEkran}
      tiklanabilir={tiklanabilir}
      tiklama={tiklama}
      sinifAdi={sinifAdi}
      gorunum={gorunum}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={sinifBirlestir(
          'h-full w-full object-cover transition-opacity duration-700',
          !katilimci.medya.kamera ? 'opacity-0 absolute scale-105' : 'opacity-100 scale-100'
        )}
      />
      <audio ref={audioRef} autoPlay playsInline />

      {!katilimci.medya.kamera && (
        <AvatarAlan id={peerId} adSoyad={katilimci.ad_soyad} tamEkran={tamEkran} />
      )}

      <StatusOverlays
        mikrofon={katilimci.medya.mikrofon}
        kamera={katilimci.medya.kamera}
        dusukBant={katilimci.medya.dusukBantGenisligi}
        adSoyad={katilimci.ad_soyad}
        rol={katilimci.rol}
      />
    </KartCerceve>
  );
}

function YerelVideoKarti({
  tiklama,
  tamEkran,
  sinifAdi,
  gorunum,
  tiklanabilir,
}: {
  tiklama: () => void;
  tamEkran: boolean;
  sinifAdi?: string;
  gorunum: 'grid' | 'serit';
  tiklanabilir: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const yerelAkim = useMedyaStore((s) => s.yerelAkim);
  const kamera = useMedyaStore((s) => s.kamera);
  const mikrofon = useMedyaStore((s) => s.mikrofon);
  const ekranPaylasimi = useMedyaStore((s) => s.ekranPaylasimi);
  const { kullanici } = useAuthStore();

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (yerelAkim && kamera) {
      if (videoElement.srcObject !== yerelAkim) {
        videoElement.srcObject = yerelAkim;
      }
    } else {
      // CLEAR srcObject to prevent frozen frames
      videoElement.srcObject = null;
    }
  }, [yerelAkim, kamera]);

  return (
    <KartCerceve
      tamEkran={tamEkran}
      tiklanabilir={tiklanabilir}
      tiklama={tiklama}
      sinifAdi={sinifAdi}
      gorunum={gorunum}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={sinifBirlestir(
          'h-full w-full object-cover scale-x-[-1] transition-opacity duration-700',
          !kamera ? 'opacity-0 absolute' : 'opacity-100'
        )}
      />

      {!kamera && (
        <AvatarAlan
          id={kullanici?.id || 'ben'}
          adSoyad={kullanici?.ad_soyad || 'Siz'}
          tamEkran={tamEkran}
        />
      )}

      <StatusOverlays
        mikrofon={mikrofon}
        kamera={kamera}
        adSoyad={kullanici?.ad_soyad || 'Siz'}
        sen
      />
    </KartCerceve>
  );
}

export default function VideoIzgarasi({
  tamEkranId,
  setTamEkranId,
  gorunum = 'grid',
  tiklanabilir = true,
}: Props) {
  const { kullanici } = useAuthStore();
  const peerIds = useMedyaStore((s) => Array.from(s.uzakMedyalar.keys()));
  const toplam = 1 + peerIds.length;

  const izgaraSinifi =
    toplam <= 1
      ? 'grid-cols-1'
      : toplam <= 2
        ? 'grid-cols-1 xl:grid-cols-2'
        : toplam <= 4
          ? 'grid-cols-1 md:grid-cols-2'
          : toplam <= 6
            ? 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3'
            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

  if (gorunum === 'grid' && tamEkranId) {
    if (tamEkranId === kullanici?.id) {
      return (
        <div className="flex-1 min-h-0 p-4 md:p-6 flex items-center justify-center">
          <YerelVideoKarti
            tiklama={() => setTamEkranId(null)}
            tamEkran
            gorunum="grid"
            tiklanabilir
          />
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 p-4 md:p-6 flex items-center justify-center">
        <UzakVideoKarti
          peerId={tamEkranId}
          tamEkran
          tiklama={() => setTamEkranId(null)}
          gorunum="grid"
          tiklanabilir
        />
      </div>
    );
  }

  if (gorunum === 'serit') {
    return (
      <div className="flex h-full min-h-0 items-stretch gap-4 overflow-x-auto overflow-y-hidden px-4 py-3 md:px-6 ozel-kaydirma">
        <YerelVideoKarti
          tiklama={() => setTamEkranId(kullanici?.id || null)}
          tamEkran={false}
          gorunum="serit"
          tiklanabilir={tiklanabilir}
        />
        {peerIds.map((id) => (
          <UzakVideoKarti
            key={id}
            peerId={id}
            tamEkran={false}
            tiklama={() => setTamEkranId(id)}
            gorunum="serit"
            tiklanabilir={tiklanabilir}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pb-32 pt-6 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-birincil-500 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">
            Toplanti Odasi <span className="text-white/20 px-2">/</span> <span className="text-white/80">{toplam} KATILIMCI</span>
          </h2>
        </div>
      </div>

      <div
        className={sinifBirlestir(
          'grid min-h-0 flex-1 items-start content-start gap-4 overflow-y-auto pb-10 pr-2 md:gap-6 ozel-kaydirma',
          izgaraSinifi
        )}
      >
        <YerelVideoKarti
          tiklama={() => setTamEkranId(kullanici?.id || null)}
          tamEkran={false}
          gorunum="grid"
          tiklanabilir={tiklanabilir}
        />
        {peerIds.map((id) => (
          <UzakVideoKarti
            key={id}
            peerId={id}
            tamEkran={false}
            tiklama={() => setTamEkranId(id)}
            gorunum="grid"
            tiklanabilir={tiklanabilir}
          />
        ))}
      </div>
    </div>
  );
}

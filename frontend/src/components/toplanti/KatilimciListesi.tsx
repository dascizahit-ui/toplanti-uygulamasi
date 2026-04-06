'use client';

import { useToplantiStore } from '@/store/toplantiStore';
import { useAuthStore } from '@/store/authStore';
import { basHarfler, avatarRengi, sinifBirlestir } from '@/utils/yardimcilar';
import { ROL_ETIKETLERI } from '@/utils/sabitler';
import bildirim from '@/components/ui/Bildirim';

interface KatilimciListesiProps {
  acik: boolean;
  kapatFn: () => void;
  wsMesajGonder?: (olay: string, veri?: any) => void;
}

export default function KatilimciListesi({ acik, kapatFn }: KatilimciListesiProps) {
  const { kullanici } = useAuthStore();
  const { katilimcilar, aktifToplanti, katilimciAt, izinGuncelle, tumuSessizeAl, tumKameralariKapat } = useToplantiStore();

  if (!acik) return null;

  const yoneticiMi =
    kullanici?.rol === 'admin' ||
    katilimcilar.some((k) => k.kullanici_id === kullanici?.id && (k.rol === 'sahip' || k.rol === 'moderator'));

  const toplantiId = aktifToplanti?.id || '';
  const bekleyenler = katilimcilar.filter((k) => k.aktif && k.onayi_bekliyor);
  const iceridekiler = katilimcilar.filter((k) => k.aktif && !k.onayi_bekliyor);

  const izinDegistir = async (hedefId: string, alan: string, deger: boolean) => {
    const sonuc = await izinGuncelle(toplantiId, hedefId, { [alan]: deger });
    if (sonuc) {
      bildirim.basari(deger ? 'Izin verildi' : 'Izin kapatildi');
    }
  };

  const atIsle = async (hedefId: string, ad: string) => {
    if (await katilimciAt(toplantiId, hedefId)) bildirim.basari(`${ad} toplantidan cikarildi`);
  };

  const hepsiniSustur = async () => {
    await tumuSessizeAl(toplantiId);
    bildirim.basari('Herkes susturuldu');
  };

  const sesleriAc = async () => {
    for (const k of katilimcilar.filter((k) => k.aktif && k.kullanici_id !== kullanici?.id)) {
      await izinGuncelle(toplantiId, k.kullanici_id, { mikrofon_izni: true });
    }
    bildirim.basari('Tum mikrofonlar acildi');
  };

  const kameralariKapat = async () => {
    await tumKameralariKapat(toplantiId);
    bildirim.basari('Tum kameralar kapatildi');
  };

  return (
    <div className="flex h-full w-full flex-col cam border-y-0 border-r-0">
      <div className="border-b border-white/5 px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Katilimcilar</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{iceridekiler.length} kisi toplantida</h3>
            {bekleyenler.length > 0 && (
              <p className="mt-1 text-xs text-yellow-400">{bekleyenler.length} kisi onay bekliyor</p>
            )}
          </div>
          <button onClick={kapatFn} className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {yoneticiMi && (
        <div className="grid grid-cols-2 gap-2 border-b border-white/5 px-3 py-3">
          <button onClick={hepsiniSustur} className="rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20">
            Hepsini sustur
          </button>
          <button onClick={sesleriAc} className="rounded-2xl bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-500/20">
            Sesleri ac
          </button>
          <button onClick={kameralariKapat} className="col-span-2 rounded-2xl bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
            Kameralari kapat
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto ozel-kaydirma px-3 py-3">
        {yoneticiMi && bekleyenler.length > 0 && (
          <div className="mb-5">
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400">
              Bekleyenler
            </div>
            <div className="space-y-2">
              {bekleyenler.map((k) => (
                <div key={k.kullanici_id} className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-3">
                  <SatirGovde katilimci={k} kullaniciId={kullanici?.id} />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => atIsle(k.kullanici_id, k.ad_soyad)}
                      className="rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                    >
                      Reddet
                    </button>
                    <button
                      onClick={() => izinDegistir(k.kullanici_id, 'onayi_bekliyor', false)}
                      className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500"
                    >
                      Kabul et
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Iceridekiler
        </div>
        <div className="space-y-2">
          {iceridekiler.map((k) => {
            const benMi = k.kullanici_id === kullanici?.id;
            return (
              <div key={k.kullanici_id} className="group rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3 transition-colors hover:bg-white/[0.05]">
                <SatirGovde katilimci={k} kullaniciId={kullanici?.id} />

                {yoneticiMi && !benMi && k.rol !== 'sahip' && (
                  <div className="mt-3 flex flex-wrap gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <KucukAksiyon
                      aktif={k.mikrofon_izni}
                      etiket={k.mikrofon_izni ? 'Mikrofoni kapat' : 'Mikrofoni ac'}
                      onClick={() => izinDegistir(k.kullanici_id, 'mikrofon_izni', !k.mikrofon_izni)}
                    />
                    <KucukAksiyon
                      aktif={k.kamera_izni}
                      etiket={k.kamera_izni ? 'Kamerayi kapat' : 'Kamerayi ac'}
                      onClick={() => izinDegistir(k.kullanici_id, 'kamera_izni', !k.kamera_izni)}
                    />
                    <KucukAksiyon
                      aktif={k.ekran_paylasim_izni}
                      etiket={k.ekran_paylasim_izni ? 'Ekrani kapat' : 'Ekran izni ver'}
                      onClick={() => izinDegistir(k.kullanici_id, 'ekran_paylasim_izni', !k.ekran_paylasim_izni)}
                    />
                    <KucukAksiyon
                      aktif={!k.kalici_susturuldu}
                      etiket={k.kalici_susturuldu ? 'Susturmayi kaldir' : 'Kalici sustur'}
                      onClick={() => izinDegistir(k.kullanici_id, 'kalici_susturuldu', !k.kalici_susturuldu)}
                    />
                    <button
                      onClick={() => atIsle(k.kullanici_id, k.ad_soyad)}
                      className="rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                    >
                      Toplantidan cikar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SatirGovde({
  katilimci,
  kullaniciId,
}: {
  katilimci: {
    kullanici_id: string;
    ad_soyad: string;
    rol: string;
    mikrofon_izni: boolean;
    kamera_izni: boolean;
    kalici_susturuldu: boolean;
    el_kaldirdi: boolean;
  };
  kullaniciId?: string;
}) {
  const benMi = katilimci.kullanici_id === kullaniciId;

  return (
    <div className="flex items-center gap-3">
      <div className={sinifBirlestir(
        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
        avatarRengi(katilimci.kullanici_id)
      )}>
        {basHarfler(katilimci.ad_soyad)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{katilimci.ad_soyad}{benMi ? ' (Sen)' : ''}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>{ROL_ETIKETLERI[katilimci.rol] || katilimci.rol}</span>
          {katilimci.el_kaldirdi && <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-yellow-300">Soz istiyor</span>}
          {katilimci.kalici_susturuldu && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-300">Kalici susturuldu</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!katilimci.kamera_izni && <DurumNokta renk="bg-orange-400" title="Kamera izni kapali" />}
        {!katilimci.mikrofon_izni && <DurumNokta renk="bg-red-400" title="Mikrofon izni kapali" />}
      </div>
    </div>
  );
}

function KucukAksiyon({
  etiket,
  onClick,
  aktif,
}: {
  etiket: string;
  onClick: () => void;
  aktif?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={sinifBirlestir(
        'rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
        aktif ? 'bg-white/5 text-slate-200 hover:bg-white/10' : 'bg-birincil-500/10 text-birincil-200 hover:bg-birincil-500/20'
      )}
    >
      {etiket}
    </button>
  );
}

function DurumNokta({ renk, title }: { renk: string; title: string }) {
  return <span className={sinifBirlestir('h-2.5 w-2.5 rounded-full', renk)} title={title} />;
}

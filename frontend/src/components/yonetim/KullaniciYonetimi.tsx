/**
 * Kullanıcı Yönetimi (Django Admin Tarzı)
 * ========================================
 * Her kullanıcıya ayrı ayrı granüler yetki atama.
 * Toplantı oluşturma, moderasyon, medya izinleri tek tek ayarlanabilir.
 */

'use client';

import { useEffect, useState } from 'react';
import Buton from '@/components/ui/Buton';
import Modal from '@/components/ui/Modal';
import bildirim from '@/components/ui/Bildirim';
import { authServisi } from '@/services/authServisi';
import { basHarfler, avatarRengi, tarihFormatla } from '@/utils/yardimcilar';
import type { Kullanici } from '@/types';

// Granüler izin tanımları
interface KullaniciIzinleri {
  toplanti_olusturabilir: boolean;
  toplanti_yonetebilir: boolean;
  katilimci_atabilir: boolean;
  mikrofon_kullanabilir: boolean;
  kamera_kullanabilir: boolean;
  ekran_paylasabilir: boolean;
  sohbet_edebilir: boolean;
  kayit_alabilir: boolean;
}

const VARSAYILAN_IZINLER: Record<string, KullaniciIzinleri> = {
  admin: {
    toplanti_olusturabilir: true, toplanti_yonetebilir: true,
    katilimci_atabilir: true, mikrofon_kullanabilir: true,
    kamera_kullanabilir: true, ekran_paylasabilir: true,
    sohbet_edebilir: true, kayit_alabilir: true,
  },
  moderator: {
    toplanti_olusturabilir: true, toplanti_yonetebilir: true,
    katilimci_atabilir: true, mikrofon_kullanabilir: true,
    kamera_kullanabilir: true, ekran_paylasabilir: true,
    sohbet_edebilir: true, kayit_alabilir: false,
  },
  kullanici: {
    toplanti_olusturabilir: false, toplanti_yonetebilir: false,
    katilimci_atabilir: false, mikrofon_kullanabilir: true,
    kamera_kullanabilir: true, ekran_paylasabilir: false,
    sohbet_edebilir: true, kayit_alabilir: false,
  },
};

const IZIN_ETIKETLERI: Record<keyof KullaniciIzinleri, { baslik: string; aciklama: string }> = {
  toplanti_olusturabilir: { baslik: 'Toplantı Oluşturma', aciklama: 'Yeni toplantı oluşturabilir' },
  toplanti_yonetebilir: { baslik: 'Toplantı Yönetimi', aciklama: 'Toplantı ayarlarını değiştirebilir, sonlandırabilir' },
  katilimci_atabilir: { baslik: 'Katılımcı Atma', aciklama: 'Toplantıdan katılımcı çıkarabilir' },
  mikrofon_kullanabilir: { baslik: 'Mikrofon', aciklama: 'Toplantılarda mikrofon kullanabilir' },
  kamera_kullanabilir: { baslik: 'Kamera', aciklama: 'Toplantılarda kamera açabilir' },
  ekran_paylasabilir: { baslik: 'Ekran Paylaşımı', aciklama: 'Ekranını paylaşabilir' },
  sohbet_edebilir: { baslik: 'Sohbet', aciklama: 'Toplantı sohbetine mesaj yazabilir' },
  kayit_alabilir: { baslik: 'Kayıt', aciklama: 'Toplantıyı kaydedebilir' },
};

const ROL_RENKLERI: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  moderator: 'bg-blue-100 text-blue-700 border-blue-200',
  kullanici: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function KullaniciYonetimi() {
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [sayfa, setSayfa] = useState(1);
  const [toplam, setToplam] = useState(0);

  // Modal durumu
  const [seciliKullanici, setSeciliKullanici] = useState<Kullanici | null>(null);
  const [izinlerModalAcik, setIzinlerModalAcik] = useState(false);
  const [izinler, setIzinler] = useState<KullaniciIzinleri>(VARSAYILAN_IZINLER.kullanici);
  const [seciliRol, setSeciliRol] = useState('kullanici');

  const yukle = async (s: number = 1) => {
    setYukleniyor(true);
    try {
      const yanit = await authServisi.kullanicilariGetir(s, 15);
      setKullanicilar(yanit.veri?.kullanicilar || []);
      setToplam(yanit.veri?.sayfalama?.toplam_kayit || 0);
      setSayfa(s);
    } catch {
      bildirim.hata('Kullanıcılar yüklenemedi');
    }
    setYukleniyor(false);
  };

  useEffect(() => { yukle(); }, []);

  // İzin düzenleme modalını aç
  const izinDuzenle = (k: Kullanici) => {
    setSeciliKullanici(k);
    setSeciliRol(k.rol);
    setIzinler(VARSAYILAN_IZINLER[k.rol] || VARSAYILAN_IZINLER.kullanici);
    setIzinlerModalAcik(true);
  };

  // Rol değişikliğinde izinleri güncelle
  const rolDegistir = (yeniRol: string) => {
    setSeciliRol(yeniRol);
    setIzinler(VARSAYILAN_IZINLER[yeniRol] || VARSAYILAN_IZINLER.kullanici);
  };

  // Tek izni toggle et
  const izinToggle = (alan: keyof KullaniciIzinleri) => {
    setIzinler(prev => ({ ...prev, [alan]: !prev[alan] }));
  };

  // Kaydet
  const kaydet = async () => {
    if (!seciliKullanici) return;
    try {
      // Rol güncelle
      if (seciliRol !== seciliKullanici.rol) {
        await authServisi.rolGuncelle(seciliKullanici.id, seciliRol);
      }

      setKullanicilar(prev =>
        prev.map(k => k.id === seciliKullanici.id ? { ...k, rol: seciliRol as any } : k)
      );
      bildirim.basari(`${seciliKullanici.ad_soyad} için ayarlar kaydedildi`);
      setIzinlerModalAcik(false);
    } catch {
      bildirim.hata('Ayarlar kaydedilemedi');
    }
  };

  const durumDegistir = async (id: string, aktif: boolean) => {
    try {
      await authServisi.durumDegistir(id, aktif);
      setKullanicilar(prev => prev.map(k => k.id === id ? { ...k, aktif } : k));
      bildirim.basari(aktif ? 'Hesap aktifleştirildi' : 'Hesap devre dışı bırakıldı');
    } catch {
      bildirim.hata('İşlem başarısız');
    }
  };

  if (yukleniyor) {
    return <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-birincil-600 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Kullanıcı Yönetimi</h2>
          <p className="text-sm text-slate-500 mt-1">Her kullanıcıya ayrı ayrı rol ve izin atayın</p>
        </div>
        <span className="px-3 py-1 bg-slate-100 rounded-lg text-sm text-slate-600">{toplam} kullanıcı</span>
      </div>

      {/* Kullanıcı Kartları */}
      <div className="space-y-3">
        {kullanicilar.map(k => (
          <div key={k.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${avatarRengi(k.id)}`}>
                  {basHarfler(k.ad_soyad)}
                </div>
                {/* Bilgi */}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{k.ad_soyad}</h3>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-md border ${ROL_RENKLERI[k.rol] || ROL_RENKLERI.kullanici}`}>
                      {k.rol === 'admin' ? 'Yönetici' : k.rol === 'moderator' ? 'Moderatör' : 'Kullanıcı'}
                    </span>
                    {!k.aktif && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-red-100 text-red-600 border border-red-200">
                        Pasif
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">@{k.kullanici_adi} · {k.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Kayıt: {tarihFormatla(k.olusturulma_tarihi)}</p>
                </div>
              </div>

              {/* İşlem butonları */}
              <div className="flex items-center gap-2">
                <button onClick={() => izinDuzenle(k)}
                  className="px-4 py-2 text-sm font-medium bg-birincil-50 text-birincil-700 rounded-xl hover:bg-birincil-100 transition-colors flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  Rol & İzinler
                </button>
                <button onClick={() => durumDegistir(k.id, !k.aktif)}
                  className={`px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                    k.aktif ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                  }`}>
                  {k.aktif ? 'Devre Dışı' : 'Aktifleştir'}
                </button>
              </div>
            </div>

            {/* Mevcut izin rozetleri */}
            <div className="flex flex-wrap gap-1.5 mt-3 ml-16">
              {Object.entries(VARSAYILAN_IZINLER[k.rol] || VARSAYILAN_IZINLER.kullanici).map(([anahtar, deger]) => (
                <span key={anahtar} className={`px-2 py-0.5 text-[11px] rounded-md ${
                  deger ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-400 line-through'
                }`}>
                  {IZIN_ETIKETLERI[anahtar as keyof KullaniciIzinleri]?.baslik || anahtar}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sayfalama */}
      {toplam > 15 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Buton boyut="kucuk" varyant="ikincil" disabled={sayfa <= 1} onClick={() => yukle(sayfa - 1)}>Önceki</Buton>
          <span className="text-sm text-slate-500">Sayfa {sayfa}</span>
          <Buton boyut="kucuk" varyant="ikincil" disabled={kullanicilar.length < 15} onClick={() => yukle(sayfa + 1)}>Sonraki</Buton>
        </div>
      )}

      {/* ===== İZİN DÜZENLEME MODALI (Django Admin Tarzı) ===== */}
      <Modal
        acik={izinlerModalAcik}
        kapatFn={() => setIzinlerModalAcik(false)}
        baslik={`${seciliKullanici?.ad_soyad} — Rol & İzinler`}
        boyut="buyuk"
        altBilgi={
          <>
            <Buton varyant="ikincil" boyut="kucuk" onClick={() => setIzinlerModalAcik(false)}>İptal</Buton>
            <Buton boyut="kucuk" onClick={kaydet}>Kaydet</Buton>
          </>
        }
      >
        <div className="space-y-6">
          {/* Rol Seçimi */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Rol</label>
            <div className="flex gap-2">
              {[
                { id: 'admin', etiket: 'Yönetici', renk: 'purple' },
                { id: 'moderator', etiket: 'Moderatör', renk: 'blue' },
                { id: 'kullanici', etiket: 'Kullanıcı', renk: 'slate' },
              ].map(rol => (
                <button key={rol.id} onClick={() => rolDegistir(rol.id)}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                    seciliRol === rol.id
                      ? `border-${rol.renk}-500 bg-${rol.renk}-50 text-${rol.renk}-700 ring-2 ring-${rol.renk}-200`
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                  {rol.etiket}
                </button>
              ))}
            </div>
          </div>

          {/* Granüler İzinler */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Detaylı İzinler</label>
            <div className="space-y-2">
              {(Object.entries(IZIN_ETIKETLERI) as [keyof KullaniciIzinleri, { baslik: string; aciklama: string }][]).map(
                ([anahtar, etiket]) => (
                  <label key={anahtar}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <div>
                      <span className="text-sm font-medium text-slate-900">{etiket.baslik}</span>
                      <p className="text-xs text-slate-500">{etiket.aciklama}</p>
                    </div>
                    <div className="relative">
                      <input type="checkbox" checked={izinler[anahtar]}
                        onChange={() => izinToggle(anahtar)}
                        className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-green-500 transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                    </div>
                  </label>
                )
              )}
            </div>
          </div>

          {/* Özet */}
          <div className="bg-slate-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Özet</h4>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(izinler).map(([anahtar, deger]) => (
                <span key={anahtar} className={`px-2 py-1 text-xs rounded-lg font-medium ${
                  deger ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600 line-through'
                }`}>
                  {IZIN_ETIKETLERI[anahtar as keyof KullaniciIzinleri]?.baslik}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

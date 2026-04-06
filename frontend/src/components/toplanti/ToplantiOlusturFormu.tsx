'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToplantiStore } from '@/store/toplantiStore';
import GirisAlani from '@/components/ui/GirisAlani';
import Buton from '@/components/ui/Buton';
import bildirim from '@/components/ui/Bildirim';
import { panoyaKopyala } from '@/utils/yardimcilar';

export default function ToplantiOlusturFormu() {
  const router = useRouter();
  const { toplantiOlustur, yukleniyor, hata } = useToplantiStore();

  const [form, setForm] = useState({
    baslik: '',
    aciklama: '',
    maks_katilimci: 20,
    sifre: '',
    bekleme_odasi_aktif: false,
    baslangic_zamani: '',
  });

  const guncelle = (alan: string, deger: any) => {
    setForm((mevcut) => ({ ...mevcut, [alan]: deger }));
  };

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();

    const baslik = form.baslik.trim();
    const aciklama = form.aciklama.trim();
    const sifre = form.sifre.trim();

    if (!baslik) {
      bildirim.hata('Toplanti basligi gereklidir');
      return;
    }

    if (baslik.length < 3) {
      bildirim.hata('Toplanti basligi en az 3 karakter olmali');
      return;
    }

    const veri: {
      baslik: string;
      maks_katilimci: number;
      bekleme_odasi_aktif: boolean;
      aciklama?: string;
      sifre?: string;
      baslangic_zamani?: string;
    } = {
      baslik,
      maks_katilimci: form.maks_katilimci,
      bekleme_odasi_aktif: form.bekleme_odasi_aktif,
    };

    if (aciklama) veri.aciklama = aciklama;
    if (sifre) veri.sifre = sifre;
    if (form.baslangic_zamani) {
      veri.baslangic_zamani = new Date(form.baslangic_zamani).toISOString();
    }

    const toplanti = await toplantiOlustur(veri);
    if (!toplanti) {
      bildirim.hata(hata || 'Toplanti olusturulamadi');
      return;
    }

    bildirim.basari('Toplanti olusturuldu');
    await panoyaKopyala(toplanti.toplanti_kodu);
    bildirim.bilgi(`Kod kopyalandi: ${toplanti.toplanti_kodu}`);
    router.push(`/toplanti/${toplanti.toplanti_kodu}`);
  };

  return (
    <form onSubmit={gonder} className="space-y-5">
      <GirisAlani
        etiket="Toplanti Basligi *"
        placeholder="Haftalik ekip toplantisi"
        value={form.baslik}
        minLength={3}
        onChange={(e) => guncelle('baslik', e.target.value)}
        yardimMetni="En az 3 karakter girin"
      />

      <div className="w-full">
        <label className="form-etiket">Aciklama</label>
        <textarea
          placeholder="Toplanti hakkinda kisa aciklama"
          value={form.aciklama}
          onChange={(e) => guncelle('aciklama', e.target.value)}
          rows={3}
          className="form-girdi resize-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GirisAlani
          etiket="Baslangic Zamani"
          type="datetime-local"
          value={form.baslangic_zamani}
          onChange={(e) => guncelle('baslangic_zamani', e.target.value)}
        />
        <GirisAlani
          etiket="Maks. Katilimci"
          type="number"
          min={2}
          max={100}
          value={form.maks_katilimci}
          onChange={(e) => guncelle('maks_katilimci', parseInt(e.target.value, 10) || 20)}
        />
      </div>

      <GirisAlani
        etiket="Toplanti Sifresi"
        placeholder="Bos birakabilirsiniz"
        value={form.sifre}
        onChange={(e) => guncelle('sifre', e.target.value)}
        yardimMetni="Bos birakirsaniz toplanti sifresiz olur"
      />

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={form.bekleme_odasi_aktif}
          onChange={(e) => guncelle('bekleme_odasi_aktif', e.target.checked)}
          className="h-5 w-5 rounded-lg border-slate-300 text-birincil-600 focus:ring-birincil-500"
        />
        <div>
          <span className="text-sm font-medium text-slate-900">Bekleme odasi</span>
          <p className="text-xs text-slate-500">Katilimcilar sizin onayinizla girsin</p>
        </div>
      </label>

      <div className="flex items-center gap-3 pt-4">
        <Buton type="submit" tamGenislik yukleniyor={yukleniyor}>
          Toplanti Olustur
        </Buton>
        <Buton type="button" varyant="ikincil" onClick={() => router.back()}>
          Iptal
        </Buton>
      </div>
    </form>
  );
}

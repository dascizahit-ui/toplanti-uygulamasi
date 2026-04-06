/**
 * Kayıt Formu Bileşeni
 * ====================
 * Yeni kullanıcı kayıt formu.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import GirisAlani from '@/components/ui/GirisAlani';
import Buton from '@/components/ui/Buton';
import bildirim from '@/components/ui/Bildirim';

export default function KayitFormu() {
  const router = useRouter();
  const { kayitOl, yukleniyor, hata, hatayiTemizle } = useAuthStore();

  const [form, setForm] = useState({
    ad_soyad: '',
    kullanici_adi: '',
    email: '',
    sifre: '',
    sifre_tekrar: '',
  });

  const [hatalar, setHatalar] = useState<Record<string, string>>({});

  const guncelle = (alan: string, deger: string) => {
    setForm({ ...form, [alan]: deger });
    if (hatalar[alan]) {
      setHatalar({ ...hatalar, [alan]: '' });
    }
  };

  const dogrula = (): boolean => {
    const h: Record<string, string> = {};

    if (!form.ad_soyad.trim() || form.ad_soyad.trim().length < 2) {
      h.ad_soyad = 'Ad soyad en az 2 karakter olmalıdır';
    }

    if (!form.kullanici_adi.trim() || form.kullanici_adi.trim().length < 3) {
      h.kullanici_adi = 'Kullanıcı adı en az 3 karakter olmalıdır';
    } else if (!/^[a-zA-Z0-9_]+$/.test(form.kullanici_adi)) {
      h.kullanici_adi = 'Sadece harf, rakam ve alt çizgi kullanılabilir';
    }

    if (!form.email.trim()) {
      h.email = 'E-posta adresi gereklidir';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      h.email = 'Geçerli bir e-posta adresi girin';
    }

    if (!form.sifre) {
      h.sifre = 'Şifre gereklidir';
    } else if (form.sifre.length < 8) {
      h.sifre = 'Şifre en az 8 karakter olmalıdır';
    } else if (!/[A-Z]/.test(form.sifre)) {
      h.sifre = 'En az bir büyük harf içermelidir';
    } else if (!/[a-z]/.test(form.sifre)) {
      h.sifre = 'En az bir küçük harf içermelidir';
    } else if (!/[0-9]/.test(form.sifre)) {
      h.sifre = 'En az bir rakam içermelidir';
    }

    if (form.sifre !== form.sifre_tekrar) {
      h.sifre_tekrar = 'Şifreler eşleşmiyor';
    }

    setHatalar(h);
    return Object.keys(h).length === 0;
  };

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    hatayiTemizle();

    if (!dogrula()) return;

    const basarili = await kayitOl(form);
    if (basarili) {
      bildirim.basari('Kayıt başarılı! Hoş geldiniz.');
      router.push('/panel');
    }
  };

  return (
    <form onSubmit={gonder} className="space-y-4">
      <GirisAlani
        etiket="Ad Soyad"
        placeholder="Ahmet Yılmaz"
        value={form.ad_soyad}
        onChange={(e) => guncelle('ad_soyad', e.target.value)}
        hata={hatalar.ad_soyad}
        ikon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        }
      />

      <GirisAlani
        etiket="Kullanıcı Adı"
        placeholder="ahmet_yilmaz"
        value={form.kullanici_adi}
        onChange={(e) => guncelle('kullanici_adi', e.target.value.toLowerCase())}
        hata={hatalar.kullanici_adi}
        yardimMetni="Harf, rakam ve alt çizgi kullanabilirsiniz"
        ikon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
          </svg>
        }
      />

      <GirisAlani
        etiket="E-posta Adresi"
        type="email"
        placeholder="ornek@email.com"
        value={form.email}
        onChange={(e) => guncelle('email', e.target.value)}
        hata={hatalar.email}
        ikon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        }
      />

      <GirisAlani
        etiket="Şifre"
        sifreAlani
        placeholder="En az 8 karakter"
        value={form.sifre}
        onChange={(e) => guncelle('sifre', e.target.value)}
        hata={hatalar.sifre}
        ikon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        }
      />

      <GirisAlani
        etiket="Şifre Tekrar"
        sifreAlani
        placeholder="Şifrenizi tekrar girin"
        value={form.sifre_tekrar}
        onChange={(e) => guncelle('sifre_tekrar', e.target.value)}
        hata={hatalar.sifre_tekrar}
        ikon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        }
      />

      {/* API hatası */}
      {hata && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {hata}
        </div>
      )}

      <Buton type="submit" tamGenislik yukleniyor={yukleniyor}>
        Hesap Oluştur
      </Buton>

      <p className="text-center text-sm text-slate-500">
        Zaten hesabınız var mı?{' '}
        <Link href="/giris" className="text-birincil-600 font-semibold hover:text-birincil-700">
          Giriş Yapın
        </Link>
      </p>
    </form>
  );
}

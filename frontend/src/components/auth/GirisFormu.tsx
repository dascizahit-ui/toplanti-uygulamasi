/**
 * Giriş Formu Bileşeni
 * ====================
 * E-posta ve şifre ile giriş formu.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import GirisAlani from '@/components/ui/GirisAlani';
import Buton from '@/components/ui/Buton';
import bildirim from '@/components/ui/Bildirim';

export default function GirisFormu() {
  const router = useRouter();
  const { girisYap, yukleniyor, hata, hatayiTemizle } = useAuthStore();

  const [form, setForm] = useState({
    email: '',
    sifre: '',
  });

  const [hatalar, setHatalar] = useState<Record<string, string>>({});

  const dogrula = (): boolean => {
    const yeniHatalar: Record<string, string> = {};

    if (!form.email.trim()) {
      yeniHatalar.email = 'E-posta adresi gereklidir';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      yeniHatalar.email = 'Geçerli bir e-posta adresi girin';
    }

    if (!form.sifre) {
      yeniHatalar.sifre = 'Şifre gereklidir';
    }

    setHatalar(yeniHatalar);
    return Object.keys(yeniHatalar).length === 0;
  };

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    hatayiTemizle();

    if (!dogrula()) return;

    const basarili = await girisYap(form);
    if (basarili) {
      bildirim.basari('Giriş başarılı! Hoş geldiniz.');
      router.push('/panel');
    }
  };

  return (
    <form onSubmit={gonder} className="space-y-5">
      <GirisAlani
        etiket="E-posta Adresi"
        type="email"
        placeholder="ornek@email.com"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
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
        placeholder="Şifrenizi girin"
        value={form.sifre}
        onChange={(e) => setForm({ ...form, sifre: e.target.value })}
        hata={hatalar.sifre}
        ikon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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
        Giriş Yap
      </Buton>

      <p className="text-center text-sm text-slate-500">
        Hesabınız yok mu?{' '}
        <Link href="/kayit" className="text-birincil-600 font-semibold hover:text-birincil-700">
          Kayıt Olun
        </Link>
      </p>
    </form>
  );
}

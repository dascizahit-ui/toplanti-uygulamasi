/**
 * Toplantı Oluştur Sayfası
 * ========================
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Navbar from '@/components/layout/Navbar';
import Kart from '@/components/ui/Kart';
import ToplantiOlusturFormu from '@/components/toplanti/ToplantiOlusturFormu';

export default function ToplantiOlusturSayfasi() {
  const router = useRouter();
  const { girisYapildi, kullanici, oturumKontrol } = useAuthStore();

  useEffect(() => {
    oturumKontrol();
  }, [oturumKontrol]);

  useEffect(() => {
    if (!girisYapildi) {
      router.push('/giris');
    }
  }, [girisYapildi, router]);

  if (!girisYapildi) return null;

  // Yetki kontrolü
  const yetkiliMi = kullanici?.rol === 'admin' || kullanici?.rol === 'moderator';

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Yeni Toplantı Oluştur
        </h1>
        <p className="text-slate-500 mb-8">
          Toplantı bilgilerini girin, benzersiz kod otomatik oluşturulacaktır.
        </p>

        {yetkiliMi ? (
          <Kart>
            <ToplantiOlusturFormu />
          </Kart>
        ) : (
          <Kart className="text-center py-12">
            <div className="text-5xl mb-4">🔒</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Yetkiniz Yok</h3>
            <p className="text-slate-500">
              Toplantı oluşturmak için admin veya moderatör yetkisi gereklidir.
            </p>
          </Kart>
        )}
      </main>
    </div>
  );
}

/**
 * Auth Hook
 * =========
 * Kimlik doğrulama durumunu ve yönlendirmelerini yönetir.
 * Koruma gerektiren sayfalar bu hook'u kullanır.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import type { KullaniciRolu } from '@/types';

interface AuthSecenekleri {
  gerekliRol?: KullaniciRolu | KullaniciRolu[];
  yonlendirme?: string;
}

export function useAuth(secenekler: AuthSecenekleri = {}) {
  const router = useRouter();
  const {
    kullanici,
    girisYapildi,
    yukleniyor,
    oturumKontrol,
    cikisYap,
  } = useAuthStore();

  const { gerekliRol, yonlendirme = '/giris' } = secenekler;

  // Sayfa yüklendiğinde oturum kontrolü
  useEffect(() => {
    oturumKontrol();
  }, [oturumKontrol]);

  // Giriş yapılmamışsa yönlendir
  useEffect(() => {
    if (!yukleniyor && !girisYapildi) {
      router.push(yonlendirme);
    }
  }, [yukleniyor, girisYapildi, router, yonlendirme]);

  // Rol kontrolü
  useEffect(() => {
    if (!girisYapildi || !kullanici || !gerekliRol) return;

    const roller = Array.isArray(gerekliRol) ? gerekliRol : [gerekliRol];
    if (!roller.includes(kullanici.rol as KullaniciRolu)) {
      router.push('/panel');
    }
  }, [girisYapildi, kullanici, gerekliRol, router]);

  return {
    kullanici,
    girisYapildi,
    yukleniyor,
    cikisYap,
    adminMi: kullanici?.rol === 'admin',
    moderatorMu: kullanici?.rol === 'admin' || kullanici?.rol === 'moderator',
  };
}

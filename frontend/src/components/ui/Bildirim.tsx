/**
 * Bildirim Yardımcısı
 * ===================
 * react-hot-toast üzerinden kolay bildirim gösterme fonksiyonları.
 */

import toast from 'react-hot-toast';

export const bildirim = {
  basari: (mesaj: string) =>
    toast.success(mesaj, { duration: 3000 }),

  hata: (mesaj: string) =>
    toast.error(mesaj, { duration: 5000 }),

  uyari: (mesaj: string) =>
    toast(mesaj, {
      icon: '⚠️',
      duration: 4000,
    }),

  bilgi: (mesaj: string) =>
    toast(mesaj, {
      icon: 'ℹ️',
      duration: 3000,
    }),

  yukleniyor: (mesaj: string) =>
    toast.loading(mesaj),

  kapat: (toastId: string) =>
    toast.dismiss(toastId),
};

export default bildirim;

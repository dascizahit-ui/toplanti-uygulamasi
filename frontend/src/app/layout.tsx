/**
 * Kök Layout
 * ==========
 * Tüm sayfaları saran ana layout bileşeni.
 * Font yükleme, metadata ve global provider'lar burada tanımlanır.
 */

import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'mahmutun mekanı - Güvenli Görüntülü Görüşme',
    template: '%s | mahmutun mekanı',
  },
  description:
    'mahmutun mekanı gerçek zamanlı video konferans ve toplantı uygulaması. ' +
    'Güvenli, hızlı ve kullanımı kolay.',
  keywords: ['toplantı', 'video konferans', 'webrtc', 'çevrimiçi toplantı', 'mahmutun mekanı'],
};

export default function KokLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-white antialiased">
        {/* Bildirim sistemi */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              background: '#1e293b',
              color: '#f1f5f9',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#22c55e', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#fff' },
            },
          }}
        />

        {/* Ana İçerik */}
        {children}
      </body>
    </html>
  );
}

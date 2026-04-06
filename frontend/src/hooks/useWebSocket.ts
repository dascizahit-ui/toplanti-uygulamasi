/**
 * WebSocket Hook
 * ==============
 * WebSocket bağlantısını yöneten React hook.
 * Bileşen yaşam döngüsüyle entegre çalışır.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { WebSocketServisi, wsServisiOlustur } from '@/services/webSocketServisi';
import type { WebSocketMesaji, WebSocketOlayTipi } from '@/types';

interface WebSocketSecenekleri {
  toplantiId: string;
  otomatikBaglan?: boolean;
  olayIsleyiciler?: Partial<Record<WebSocketOlayTipi, (mesaj: WebSocketMesaji) => void>>;
}

export function useWebSocket(secenekler: WebSocketSecenekleri) {
  const { toplantiId, otomatikBaglan = true, olayIsleyiciler } = secenekler;
  const wsRef = useRef<WebSocketServisi | null>(null);
  const [bagli, setBagli] = useState(false);
  const [baglaniliyor, setBaglaniliyor] = useState(false);

  // WS servisini oluştur
  useEffect(() => {
    wsRef.current = wsServisiOlustur();
    return () => {
      wsRef.current?.kopar();
      wsRef.current = null;
    };
  }, []);

  // Olay dinleyicilerini kaydet
  useEffect(() => {
    if (!wsRef.current || !olayIsleyiciler) return;

    const abonelikler: (() => void)[] = [];

    Object.entries(olayIsleyiciler).forEach(([olay, isleyici]) => {
      if (isleyici && wsRef.current) {
        const iptal = wsRef.current.dinle(olay, isleyici);
        abonelikler.push(iptal);
      }
    });

    return () => {
      abonelikler.forEach((iptal) => iptal());
    };
  }, [olayIsleyiciler]);

  // Bağlan
  const baglan = useCallback(async () => {
    if (!wsRef.current || !toplantiId) return false;
    setBaglaniliyor(true);
    const sonuc = await wsRef.current.baglan(toplantiId);
    setBagli(sonuc);
    setBaglaniliyor(false);
    return sonuc;
  }, [toplantiId]);

  // Kopar
  const kopar = useCallback(() => {
    wsRef.current?.kopar();
    setBagli(false);
  }, []);

  // Mesaj gönder
  const gonder = useCallback((olay: string, veri?: any, hedefId?: string) => {
    wsRef.current?.gonder(olay, veri, hedefId);
  }, []);

  // Olay dinle (dinamik)
  const dinle = useCallback((olay: string, dinleyici: (mesaj: WebSocketMesaji) => void) => {
    return wsRef.current?.dinle(olay, dinleyici) || (() => {});
  }, []);

  // Otomatik bağlanma
  useEffect(() => {
    if (otomatikBaglan && toplantiId) {
      baglan();
    }
    return () => {
      kopar();
    };
  }, [otomatikBaglan, toplantiId, baglan, kopar]);

  return {
    bagli,
    baglaniliyor,
    baglan,
    kopar,
    gonder,
    dinle,
    servis: wsRef.current,
  };
}

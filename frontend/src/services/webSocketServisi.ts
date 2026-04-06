/**
 * WebSocket Servis Katmanı
 * ========================
 * WebSocket bağlantı yönetimi, otomatik yeniden bağlanma,
 * mesaj kuyruğu ve olay dinleyici altyapısı.
 */

import { WS_URL, TOPLANTI } from '@/utils/sabitler';
import { depolama } from '@/utils/yardimcilar';
import type { WebSocketMesaji, WebSocketOlayTipi } from '@/types';

type OlayDinleyici = (mesaj: WebSocketMesaji) => void;

export class WebSocketServisi {
  private ws: WebSocket | null = null;
  private toplantiId: string = '';
  private dinleyiciler: Map<string, Set<OlayDinleyici>> = new Map();
  private genelDinleyiciler: Set<OlayDinleyici> = new Set();
  private yenidenBaglanmaSayaci: number = 0;
  private yenidenBaglanmaZamanlayici: NodeJS.Timeout | null = null;
  private heartbeatZamanlayici: NodeJS.Timeout | null = null;
  private mesajKuyrugu: string[] = [];
  private _bagli: boolean = false;

  get bagli(): boolean {
    return this._bagli && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * WebSocket bağlantısı kurar.
   */
  baglan(toplantiId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const token = depolama.tokenGetir();
      if (!token) {
        console.error('WS: Token bulunamadı');
        resolve(false);
        return;
      }

      this.toplantiId = toplantiId;
      const url = `${WS_URL}/ws/toplanti/${toplantiId}?token=${token}`;

      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        console.error('WS: Bağlantı oluşturulamadı', e);
        resolve(false);
        return;
      }

      this.ws.onopen = () => {
        console.log('WS: Bağlantı kuruldu');
        this._bagli = true;
        this.yenidenBaglanmaSayaci = 0;
        this.heartbeatBaslat();
        this.kuyrukBosalt();
        resolve(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const mesaj: WebSocketMesaji = JSON.parse(event.data);
          this.olayDagit(mesaj);
        } catch (e) {
          console.error('WS: Mesaj parse hatası', e);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`WS: Bağlantı kapandı (${event.code})`);
        this._bagli = false;
        this.heartbeatDurdur();

        // Anormal kapanma → yeniden bağlan
        if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003) {
          this.yenidenBaglanmaYap();
        }
      };

      this.ws.onerror = () => {
        console.error('WS: Bağlantı hatası');
        this._bagli = false;
        resolve(false);
      };
    });
  }

  /**
   * Bağlantıyı kapatır.
   */
  kopar() {
    this.heartbeatDurdur();
    if (this.yenidenBaglanmaZamanlayici) {
      clearTimeout(this.yenidenBaglanmaZamanlayici);
      this.yenidenBaglanmaZamanlayici = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Yeniden bağlanmayı engelle
      this.ws.close(1000, 'Kullanıcı ayrıldı');
      this.ws = null;
    }
    this._bagli = false;
    this.dinleyiciler.clear();
    this.genelDinleyiciler.clear();
    this.mesajKuyrugu = [];
  }

  /**
   * Mesaj gönderir. Bağlantı yoksa kuyruğa ekler.
   */
  gonder(olay: string, veri?: any, hedefId?: string) {
    const mesaj = JSON.stringify({
      olay,
      veri: veri || {},
      hedef_id: hedefId,
    });

    if (this.bagli) {
      this.ws!.send(mesaj);
    } else {
      this.mesajKuyrugu.push(mesaj);
    }
  }

  /**
   * Belirli bir olay tipini dinler.
   */
  dinle(olay: WebSocketOlayTipi | string, dinleyici: OlayDinleyici): () => void {
    if (!this.dinleyiciler.has(olay)) {
      this.dinleyiciler.set(olay, new Set());
    }
    this.dinleyiciler.get(olay)!.add(dinleyici);

    // Abonelikten çıkma fonksiyonu döndür
    return () => {
      this.dinleyiciler.get(olay)?.delete(dinleyici);
    };
  }

  /**
   * Tüm olayları dinler.
   */
  tumunuDinle(dinleyici: OlayDinleyici): () => void {
    this.genelDinleyiciler.add(dinleyici);
    return () => {
      this.genelDinleyiciler.delete(dinleyici);
    };
  }

  // --- İç Metodlar ---

  private olayDagit(mesaj: WebSocketMesaji) {
    // Genel dinleyicilere
    this.genelDinleyiciler.forEach((d) => d(mesaj));

    // Olay bazlı dinleyicilere
    const dinleyiciler = this.dinleyiciler.get(mesaj.olay);
    if (dinleyiciler) {
      dinleyiciler.forEach((d) => d(mesaj));
    }
  }

  private heartbeatBaslat() {
    this.heartbeatDurdur();
    this.heartbeatZamanlayici = setInterval(() => {
      this.gonder('heartbeat');
    }, TOPLANTI.HEARTBEAT_ARALIK_MS);
  }

  private heartbeatDurdur() {
    if (this.heartbeatZamanlayici) {
      clearInterval(this.heartbeatZamanlayici);
      this.heartbeatZamanlayici = null;
    }
  }

  private kuyrukBosalt() {
    while (this.mesajKuyrugu.length > 0 && this.bagli) {
      const mesaj = this.mesajKuyrugu.shift()!;
      this.ws!.send(mesaj);
    }
  }

  private yenidenBaglanmaYap() {
    if (this.yenidenBaglanmaSayaci >= TOPLANTI.MAKS_YENIDEN_BAGLANMA) {
      console.error('WS: Maksimum yeniden bağlanma denemesi aşıldı');
      return;
    }

    this.yenidenBaglanmaSayaci++;
    const bekleme = TOPLANTI.YENIDEN_BAGLANMA_ARALIK_MS * this.yenidenBaglanmaSayaci;

    console.log(`WS: ${bekleme}ms sonra yeniden bağlanılacak (deneme ${this.yenidenBaglanmaSayaci})`);

    this.yenidenBaglanmaZamanlayici = setTimeout(() => {
      if (this.toplantiId) {
        this.baglan(this.toplantiId);
      }
    }, bekleme);
  }
}

// Tekil örnek oluşturma fonksiyonu
export function wsServisiOlustur(): WebSocketServisi {
  return new WebSocketServisi();
}

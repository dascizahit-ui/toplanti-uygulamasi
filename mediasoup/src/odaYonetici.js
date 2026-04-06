/**
 * Oda Yöneticisi
 * ==============
 * Mediasoup Router, Transport, Producer ve Consumer yönetimi.
 * Her toplantı odası bir Router'a sahiptir.
 */

const config = require('./config');

class OdaYonetici {
  constructor() {
    // { toplantiId: { router, katilimcilar: { kullaniciId: { transportlar, ureticiler, tuketiciler } } } }
    this.odalar = new Map();
  }

  /**
   * Yeni oda (Router) oluşturur.
   */
  async odaOlustur(toplantiId, worker) {
    if (this.odalar.has(toplantiId)) {
      return this.odalar.get(toplantiId).router;
    }

    const router = await worker.createRouter(config.routerSecenekleri);

    this.odalar.set(toplantiId, {
      router,
      katilimcilar: new Map(),
    });

    console.log(`[Oda] Oluşturuldu: ${toplantiId}`);
    return router;
  }

  /**
   * Odayı siler.
   */
  odaSil(toplantiId) {
    const oda = this.odalar.get(toplantiId);
    if (!oda) return;

    // Tüm transport'ları kapat
    for (const [, katilimci] of oda.katilimcilar) {
      for (const transport of katilimci.transportlar.values()) {
        transport.close();
      }
    }

    oda.router.close();
    this.odalar.delete(toplantiId);
    console.log(`[Oda] Silindi: ${toplantiId}`);
  }

  /**
   * Oda Router'ının RTP yeteneklerini döndürür.
   */
  rtpYetenekleriGetir(toplantiId) {
    const oda = this.odalar.get(toplantiId);
    if (!oda) return null;
    return oda.router.rtpCapabilities;
  }

  /**
   * WebRTC Transport oluşturur.
   */
  async transportOlustur(toplantiId, kullaniciId, yon) {
    const oda = this.odalar.get(toplantiId);
    if (!oda) throw new Error('Oda bulunamadı');

    const transport = await oda.router.createWebRtcTransport(
      config.webRtcTransportSecenekleri
    );

    // DTLS state değişikliği
    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
      }
    });

    transport.on('close', () => {
      console.log(`[Transport] Kapandı: ${transport.id}`);
    });

    // Katılımcıya kaydet
    if (!oda.katilimcilar.has(kullaniciId)) {
      oda.katilimcilar.set(kullaniciId, {
        transportlar: new Map(),
        ureticiler: new Map(),
        tuketiciler: new Map(),
      });
    }

    const katilimci = oda.katilimcilar.get(kullaniciId);
    const transportAnahtar = `${yon}_${transport.id}`;
    katilimci.transportlar.set(transportAnahtar, transport);

    console.log(`[Transport] Oluşturuldu: ${yon} | Kullanıcı: ${kullaniciId}`);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  /**
   * Transport'u DTLS ile bağlar.
   */
  async transportBagla(toplantiId, kullaniciId, transportId, dtlsParametreleri) {
    const transport = this._transportBul(toplantiId, kullaniciId, transportId);
    if (!transport) throw new Error('Transport bulunamadı');

    await transport.connect({ dtlsParameters: dtlsParametreleri });
    console.log(`[Transport] Bağlandı: ${transportId}`);
  }

  /**
   * Producer (medya üretici) oluşturur.
   */
  async ureticiOlustur(toplantiId, kullaniciId, transportId, tur, rtpParametreleri) {
    const transport = this._transportBul(toplantiId, kullaniciId, transportId);
    if (!transport) throw new Error('Transport bulunamadı');

    const producer = await transport.produce({
      kind: tur === 'ses' ? 'audio' : 'video',
      rtpParameters: rtpParametreleri,
    });

    producer.on('transportclose', () => {
      producer.close();
    });

    // Kaydet
    const oda = this.odalar.get(toplantiId);
    const katilimci = oda.katilimcilar.get(kullaniciId);
    katilimci.ureticiler.set(producer.id, producer);

    console.log(`[Üretici] Oluşturuldu: ${producer.id} (${tur}) | Kullanıcı: ${kullaniciId}`);

    return { id: producer.id, kind: producer.kind };
  }

  /**
   * Producer'ı duraklatır.
   */
  async ureticiDuraklat(toplantiId, ureticiId) {
    const producer = this._ureticiBul(toplantiId, ureticiId);
    if (producer) await producer.pause();
  }

  /**
   * Producer'ı devam ettirir.
   */
  async ureticiDevam(toplantiId, ureticiId) {
    const producer = this._ureticiBul(toplantiId, ureticiId);
    if (producer) await producer.resume();
  }

  /**
   * Consumer (medya tüketici) oluşturur.
   */
  async tuketiciOlustur(toplantiId, tuketiciKullaniciId, ureticiId, rtpYetenekler) {
    const oda = this.odalar.get(toplantiId);
    if (!oda) throw new Error('Oda bulunamadı');

    // Router bu codec'i destekliyor mu?
    if (!oda.router.canConsume({ producerId: ureticiId, rtpCapabilities: rtpYetenekler })) {
      throw new Error('Tüketim desteklenmiyor');
    }

    // Tüketici için alım transport'unu bul
    const katilimci = oda.katilimcilar.get(tuketiciKullaniciId);
    if (!katilimci) throw new Error('Katılımcı bulunamadı');

    // İlk alım transport'unu kullan
    let alimTransport = null;
    for (const [anahtar, transport] of katilimci.transportlar) {
      if (anahtar.startsWith('alim')) {
        alimTransport = transport;
        break;
      }
    }
    if (!alimTransport) throw new Error('Alım transport\'u bulunamadı');

    const consumer = await alimTransport.consume({
      producerId: ureticiId,
      rtpCapabilities: rtpYetenekler,
      paused: true, // İstemci tarafında resume edilecek
    });

    consumer.on('transportclose', () => {
      consumer.close();
    });

    consumer.on('producerclose', () => {
      consumer.close();
    });

    katilimci.tuketiciler.set(consumer.id, consumer);

    console.log(`[Tüketici] Oluşturuldu: ${consumer.id} | Kullanıcı: ${tuketiciKullaniciId}`);

    return {
      id: consumer.id,
      producerId: ureticiId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  /**
   * Oda durumunu döndürür.
   */
  odaDurumu(toplantiId) {
    const oda = this.odalar.get(toplantiId);
    if (!oda) return null;

    const katilimciSayisi = oda.katilimcilar.size;
    let toplamUretici = 0;
    let toplamTuketici = 0;

    for (const [, k] of oda.katilimcilar) {
      toplamUretici += k.ureticiler.size;
      toplamTuketici += k.tuketiciler.size;
    }

    return {
      toplantiId,
      katilimciSayisi,
      toplamUretici,
      toplamTuketici,
    };
  }

  /**
   * Tüm odaların istatistiklerini döndürür.
   */
  tumIstatistikler() {
    const sonuc = {};
    for (const [id] of this.odalar) {
      sonuc[id] = this.odaDurumu(id);
    }
    return sonuc;
  }

  // --- Yardımcılar ---

  _transportBul(toplantiId, kullaniciId, transportId) {
    const oda = this.odalar.get(toplantiId);
    if (!oda) return null;
    const katilimci = oda.katilimcilar.get(kullaniciId);
    if (!katilimci) return null;

    for (const [, transport] of katilimci.transportlar) {
      if (transport.id === transportId) return transport;
    }
    return null;
  }

  _ureticiBul(toplantiId, ureticiId) {
    const oda = this.odalar.get(toplantiId);
    if (!oda) return null;
    for (const [, katilimci] of oda.katilimcilar) {
      const uretici = katilimci.ureticiler.get(ureticiId);
      if (uretici) return uretici;
    }
    return null;
  }
}

module.exports = OdaYonetici;

'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Device } from 'mediasoup-client';
type Transport = any;
type Producer = any;
type Consumer = any;
import { useAuthStore } from '@/store/authStore';
import { useToplantiStore } from '@/store/toplantiStore';
import { useMedyaStore } from '@/store/medyaStore';
import { useSohbetStore } from '@/store/sohbetStore';
import VideoIzgarasi from '@/components/toplanti/VideoIzgarasi';
import EkranPaylasimi from '@/components/toplanti/EkranPaylasimi';
import KontrolPaneli from '@/components/toplanti/KontrolPaneli';
import SohbetPaneli from '@/components/toplanti/SohbetPaneli';
import KatilimciListesi from '@/components/toplanti/KatilimciListesi';
import Buton from '@/components/ui/Buton';
import GirisAlani from '@/components/ui/GirisAlani';
import bildirim from '@/components/ui/Bildirim';
import { WS_URL, TOPLANTI } from '@/utils/sabitler';
import { depolama, sinifBirlestir } from '@/utils/yardimcilar';
import type { Katilimci, WebSocketMesaji } from '@/types';

import Link from 'next/link';

export default function Sayfa() {
  const params = useParams();
  const router = useRouter();
  const kod = params.id as string;
  const { kullanici, girisYapildi, oturumKontrol } = useAuthStore();
  const aktifKullanici = kullanici ?? depolama.kullaniciGetir();
  const { aktifToplanti, toplantiyaKatil, katilimcilariGetir, katilimcilar, izinGuncelle, katilimciAt } = useToplantiStore();
  const { mesajEkle, sifirla: sohbetSifirla } = useSohbetStore();
  const medyaStore = useMedyaStore();

  const [sayfa, setSayfa] = useState<'lobi' | 'oda'>('lobi');
  const [hata, setHata] = useState('');
  const [sifre, setSifre] = useState('');
  const [yukle, setYukle] = useState(false);
  const [katPanel, setKatPanel] = useState(false);
  const { panelAcik: sohbetAcik, panelKapat: kapatSohbet, panelAc: acSohbet } = useSohbetStore();
  const [tamEkranId, setTamEkranId] = useState<string | null>(null);
  const [beklemedeYerel, setBeklemedeYerel] = useState(false);
  const [rumuz, setRumuz] = useState('');
  const [toplantiBilgisi, setToplantiBilgisi] = useState<{ id: string, baslik: string, sifreli: boolean, aktif: boolean } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const hbRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map()); // kind → Producer
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const yerelAkimRef = useRef<MediaStream | null>(null);
  const bekleyenProducerlarRef = useRef<Array<{ producerId: string; peerId: string; peerData: any; appData?: any }>>([]);
  const producerMetaRef = useRef<Map<string, { peerId: string; appData?: any }>>(new Map());

  useEffect(() => { oturumKontrol(); }, [oturumKontrol]);
  
  // Halka açık toplantı bilgisini çek
  useEffect(() => {
    const bilgiAl = async () => {
      const b = await useToplantiStore.getState().toplantiBilgisiGetir(kod);
      if (b) setToplantiBilgisi(b);
      else setHata('Toplantı bulunamadı veya erişilemez.');
    };
    if (kod) bilgiAl();
  }, [kod]);

  useEffect(() => () => { temizle(); }, []);

  function temizle() {
    wsRef.current?.close(); wsRef.current = null;
    if (hbRef.current) clearInterval(hbRef.current);
    producersRef.current.forEach(p => p.close()); producersRef.current.clear();
    consumersRef.current.forEach(c => c.close()); consumersRef.current.clear();
    producerMetaRef.current.clear();
    bekleyenProducerlarRef.current = [];
    sendTransportRef.current?.close(); recvTransportRef.current?.close();
    yerelAkimRef.current?.getTracks().forEach(t => t.stop());
  }

  // ─── WS BAĞLAN ───
  const wsBaglan = async (toplantiId: string, token: string) => {
    // Medya al
    let akim: MediaStream;
    try {
      akim = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch {
      try { akim = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch { akim = new MediaStream(); }
    }
    yerelAkimRef.current = akim;
    // Kamera ışığının yanmaması için başlangıçta video track'lerini stop et
    akim.getVideoTracks().forEach(t => { 
      t.stop(); 
      akim.removeTrack(t);
    });
    // Mikrofonu sustur
    akim.getAudioTracks().forEach(t => { t.enabled = false; });
    
    useMedyaStore.setState({ yerelAkim: akim, mikrofon: false, kamera: false });

    await katilimcilariGetir(toplantiId);

    const socket = new WebSocket(`${WS_URL}/ws/toplanti/${toplantiId}?token=${token}`);
    wsRef.current = socket;
    socket.onopen = () => {
      console.log('[WS] Açıldı');
      hbRef.current = setInterval(() => gonder('heartbeat'), TOPLANTI.HEARTBEAT_ARALIK_MS);
    };
    socket.onmessage = e => { try { olayIsle(JSON.parse(e.data)); } catch (err) { console.error('[WS] Parse:', err); } };
    socket.onclose = ev => {
      console.log('[WS] Kapandı:', ev.code);
      if (hbRef.current) clearInterval(hbRef.current);
      if (ev.code === 4001) {
        console.log('[WS] Başka bağlantı açıldı, bu bağlantı kapatıldı');
      }
    };
  };

  // ─── WS GÖNDER + BEKLE (request-response) ───
  const pendingRef = useRef<Map<string, (veri: any) => void>>(new Map());
  
  const gonder = useCallback((olay: string, veri?: any, istekId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ olay, veri, istek_id: istekId }));
  }, []);

  // İstek gönder, yanıt bekle — requestId tabanlı
  const requestIdCounter = useRef(0);
  const iste = useCallback((olay: string, veri?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reqId = `${olay}_${++requestIdCounter.current}`;
      
      const timeout = setTimeout(() => {
        pendingRef.current.delete(reqId);
        reject(new Error(`Timeout: ${olay}`));
      }, 10000);

      pendingRef.current.set(reqId, (yanit: any) => {
        clearTimeout(timeout);
        pendingRef.current.delete(reqId);
        if (yanit.hata) reject(new Error(yanit.hata));
        else resolve(yanit);
      });

      gonder(olay, veri, reqId);
    });
  }, [gonder]);

  // ─── SFU: TRANSPORT OLUŞTUR ───
  async function sendTransportOlustur(device: Device) {
    const data = await iste('transportOlustur', { direction: 'send' });
    console.log('[SFU] Send transport:', data.id);

    const transport = device.createSendTransport({
      id: data.id,
      iceParameters: data.iceParameters,
      iceCandidates: data.iceCandidates,
      dtlsParameters: data.dtlsParameters,
      sctpParameters: data.sctpParameters,
      iceServers: iceServersRef.current,
    });

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await iste('transportBagla', { transportId: transport.id, dtlsParameters });
        callback();
      } catch (e: any) { errback(e); }
    });

    transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const r = await iste('produce', { transportId: transport.id, kind, rtpParameters, appData });
        callback({ id: r.id });
      } catch (e: any) { errback(e); }
    });
    transport.on('connectionstatechange', (state: string) => {
      console.log(`[SFU] Send transport durumu: ${state}`);
    });
    sendTransportRef.current = transport;
    return transport;
  }

  async function recvTransportOlustur(device: Device) {
    const data = await iste('transportOlustur', { direction: 'recv' });
    console.log('[SFU] Recv transport:', data.id);

    const transport = device.createRecvTransport({
      id: data.id,
      iceParameters: data.iceParameters,
      iceCandidates: data.iceCandidates,
      dtlsParameters: data.dtlsParameters,
      sctpParameters: data.sctpParameters,
      iceServers: iceServersRef.current,
    });

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await iste('transportBagla', { transportId: transport.id, dtlsParameters });
        callback();
      } catch (e: any) { errback(e); }
    });
    transport.on('connectionstatechange', (state: string) => {
      console.log(`[SFU] Recv transport durumu: ${state}`);
    });

    recvTransportRef.current = transport;
    return transport;
  }

  // ─── SFU: PRODUCE (medya gönder) ───
  async function produceTrack(track: MediaStreamTrack, appData?: any) {
    const transport = sendTransportRef.current;
    if (!transport) { console.error('Send transport yok'); return null; }

    try {
      let encodings;
      if (track.kind === 'video') {
        if (appData?.type === 'screen') {
          encodings = [{ maxBitrate: 1500000 }]; // Ekran paylaşımı için sınır (1.5 Mbps)
        } else {
          encodings = [
            { scaleResolutionDownBy: 4, maxBitrate: 100000 },
            { scaleResolutionDownBy: 2, maxBitrate: 300000 },
            { scaleResolutionDownBy: 1, maxBitrate: 900000 },
          ]; // Kamera için simulcast (3 farklı kalite, ağa göre otomatik geçiş)
        }
      }

      const producer = await transport.produce({ 
        track, 
        encodings,
        codecOptions: { videoGoogleStartBitrate: 1000 },
        appData: appData || {} 
      });
      producersRef.current.set(producer.appData?.type || producer.kind, producer);
      console.log(`[SFU] Produced: ${producer.kind} (${producer.id})`);
      return producer;
    } catch (e) {
      console.error('[SFU] Produce hatası:', e);
      return null;
    }
  }

  // ─── SFU: CONSUME (medya al) — kuyruk ile serialize ───
  const consumeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const iceServersRef = useRef<any[]>([]);

  const uzakKatilimciEkle = useCallback((peerId: string, peerData: any = {}) => {
    if (!peerId || peerId === aktifKullanici?.id) return;

    useMedyaStore.setState(state => {
      const yeniMap = new Map(state.uzakMedyalar);
      const mevcut = yeniMap.get(peerId);
      yeniMap.set(peerId, {
        kullanici_id: peerId,
        ad_soyad: peerData?.ad_soyad || mevcut?.ad_soyad || '',
        kullanici_adi: peerData?.kullanici_adi || mevcut?.kullanici_adi || '',
        profil_resmi: peerData?.profil_resmi ?? mevcut?.profil_resmi,
        rol: peerData?.rol || mevcut?.rol || 'katilimci',
        medya: {
          mikrofon: peerData?.medya?.mikrofon ?? mevcut?.medya?.mikrofon ?? false,
          kamera: peerData?.medya?.kamera ?? mevcut?.medya?.kamera ?? false,
          ekranPaylasimi: peerData?.medya?.ekranPaylasimi ?? mevcut?.medya?.ekranPaylasimi ?? false,
        },
        videoStream: mevcut?.videoStream ?? null,
        sesStream: mevcut?.sesStream ?? null,
        ekranStream: mevcut?.ekranStream ?? null,
      });
      return { uzakMedyalar: yeniMap };
    });
  }, [aktifKullanici?.id]);

  const katilimciYerlestir = useCallback((
    katilimciVerisi: Partial<Katilimci> & { id?: string; kullanici_id?: string },
    izinler?: Partial<Katilimci>,
  ) => {
    const kullaniciId = String(katilimciVerisi.kullanici_id ?? katilimciVerisi.id ?? '');
    if (!kullaniciId) return;

    const mevcut = useToplantiStore.getState().katilimcilar.find((k) => k.kullanici_id === kullaniciId);
    const kendiVarsayilanlari = aktifKullanici?.id === kullaniciId
      ? {
          ad_soyad: aktifKullanici.ad_soyad,
          kullanici_adi: aktifKullanici.kullanici_adi,
          profil_resmi: aktifKullanici.profil_resmi,
        }
      : {};

    useToplantiStore.getState().katilimciGuncelle({
      id: String(katilimciVerisi.id ?? mevcut?.id ?? kullaniciId),
      kullanici_id: kullaniciId,
      ad_soyad: katilimciVerisi.ad_soyad ?? mevcut?.ad_soyad ?? kendiVarsayilanlari.ad_soyad ?? '',
      kullanici_adi: katilimciVerisi.kullanici_adi ?? mevcut?.kullanici_adi ?? kendiVarsayilanlari.kullanici_adi ?? '',
      profil_resmi: katilimciVerisi.profil_resmi ?? mevcut?.profil_resmi ?? kendiVarsayilanlari.profil_resmi ?? null,
      rol: (izinler?.rol ?? katilimciVerisi.rol ?? mevcut?.rol ?? 'katilimci') as Katilimci['rol'],
      mikrofon_izni: izinler?.mikrofon_izni ?? katilimciVerisi.mikrofon_izni ?? mevcut?.mikrofon_izni ?? true,
      kamera_izni: izinler?.kamera_izni ?? katilimciVerisi.kamera_izni ?? mevcut?.kamera_izni ?? true,
      ekran_paylasim_izni: izinler?.ekran_paylasim_izni ?? katilimciVerisi.ekran_paylasim_izni ?? mevcut?.ekran_paylasim_izni ?? true,
      sohbet_izni: izinler?.sohbet_izni ?? katilimciVerisi.sohbet_izni ?? mevcut?.sohbet_izni ?? true,
      kalici_susturuldu: izinler?.kalici_susturuldu ?? katilimciVerisi.kalici_susturuldu ?? mevcut?.kalici_susturuldu ?? false,
      el_kaldirdi: izinler?.el_kaldirdi ?? katilimciVerisi.el_kaldirdi ?? mevcut?.el_kaldirdi ?? false,
      onayi_bekliyor: izinler?.onayi_bekliyor ?? katilimciVerisi.onayi_bekliyor ?? mevcut?.onayi_bekliyor ?? false,
      aktif: katilimciVerisi.aktif ?? mevcut?.aktif ?? true,
      katilma_zamani: katilimciVerisi.katilma_zamani ?? mevcut?.katilma_zamani ?? new Date().toISOString(),
    });
  }, [aktifKullanici]);
  
  async function consumeProducer(producerId: string, peerId: string, peerData: any, producerAppData?: any) {
    producerMetaRef.current.set(producerId, { peerId, appData: producerAppData });
    uzakKatilimciEkle(peerId, peerData);

    // Kuyruk ile serialize et — race condition önle
    consumeQueueRef.current = consumeQueueRef.current.then(async () => {
      let zatenVar = false;
      consumersRef.current.forEach(c => {
        if (c.producerId === producerId) zatenVar = true;
      });
      if (zatenVar) return;

      const transport = recvTransportRef.current;
      const device = deviceRef.current;
      if (!transport || !device) {
        if (!bekleyenProducerlarRef.current.some(p => p.producerId === producerId)) {
          bekleyenProducerlarRef.current.push({ producerId, peerId, peerData, appData: producerAppData });
        }
        return;
      }

      try {
        const data = await iste('consume', {
          producerId,
          rtpCapabilities: device.rtpCapabilities,
        });

        const consumer = await transport.consume({
          id: data.id,
          producerId: data.producerId,
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });

        consumersRef.current.set(consumer.id, consumer);
        gonder('consumerResume', { consumerId: consumer.id });

        const stream = new MediaStream([consumer.track]);
        
        // appData ile screen vs camera ayrımı yap
        const appData = producerAppData || data.appData || {};
        const isScreen = appData.type === 'screen';
        
        console.log(`[SFU] Consumed: ${data.kind} (${isScreen ? 'screen' : 'cam/mic'}) from ${peerId}`);

        // Store'u güncelle
        useMedyaStore.setState(state => {
          const yeniMap = new Map(state.uzakMedyalar);
          const mevcut = yeniMap.get(peerId) || {
            kullanici_id: peerId, ad_soyad: peerData?.ad_soyad || '', kullanici_adi: peerData?.kullanici_adi || '',
            profil_resmi: peerData?.profil_resmi, rol: peerData?.rol || 'katilimci',
            medya: { mikrofon: false, kamera: false, ekranPaylasimi: false },
            videoStream: null, sesStream: null, ekranStream: null,
          };

          const guncellenmis = {
            ...mevcut,
            ...(isScreen
              ? { ekranStream: stream, medya: { ...mevcut.medya, ekranPaylasimi: true } }
              : data.kind === 'video'
                ? { videoStream: stream, medya: { ...mevcut.medya, kamera: true } }
                : { sesStream: stream, medya: { ...mevcut.medya, mikrofon: true } }
            ),
          };

          yeniMap.set(peerId, guncellenmis);
          return { uzakMedyalar: yeniMap };
        });
      } catch (e) {
        console.error('[SFU] Consume hatası:', e);
      }
    }).catch(e => console.error('[SFU] Consume queue hatası:', e));
  }

  // ─── MİK / KAM / EKRAN ───
  // ─── MİKROFON ───
 const mikToggle = useCallback(async () => {
    const s = useMedyaStore.getState();
    const kat = useToplantiStore.getState().katilimcilar;
    const ben = kat.find(k => k.kullanici_id === aktifKullanici?.id);
    
    // Kalıcı susturuldu kontrolü
    if (ben && ben.kalici_susturuldu && aktifKullanici?.rol !== 'admin') {
      bildirim.hata('Kalıcı olarak susturuldunuz'); return;
    }

    if (!s.yerelAkim) { console.log('[MIC] yerelAkim yok!'); return; }
    const yeni = !s.mikrofon;
    console.log(`[MIC] Toggle: ${s.mikrofon} → ${yeni}`);

    // 1. Track aç/kapat
    s.yerelAkim.getAudioTracks().forEach(t => { t.enabled = yeni; });

    // 2. Producer resume/pause
    const producer = producersRef.current.get('audio');
    if (producer) {
      if (yeni) { producer.resume(); gonder('producerResume', { producerId: producer.id }); }
      else { producer.pause(); gonder('producerPause', { producerId: producer.id }); }
      console.log(`[MIC] Producer ${yeni ? 'resumed' : 'paused'}: ${producer.id}`);
    }

    useMedyaStore.setState({ mikrofon: yeni });
    gonder('mikrofon_degisti', { aktif: yeni });
  }, [aktifKullanici?.id, aktifKullanici?.rol, gonder]);

  const kamToggle = useCallback(async () => {
    const s = useMedyaStore.getState();
    if (!s.yerelAkim) { console.log('[KAM] yerelAkim yok!'); return; }
    const yeni = !s.kamera;
    console.log(`[KAM] Toggle: ${s.kamera} → ${yeni}`);

    if (!yeni) {
      // Kamerayı tamamen kapat
      s.yerelAkim.getVideoTracks().forEach(t => { 
        t.stop(); 
        s.yerelAkim?.removeTrack(t); 
      });
      
      const producer = producersRef.current.get('video');
      if (producer) {
        producer.pause(); gonder('producerPause', { producerId: producer.id });
        console.log(`[KAM] Producer paused: ${producer.id}`);
      }
      useMedyaStore.setState({ kamera: false });
      gonder('kamera_degisti', { aktif: false });
    } else {
      // Kamerayı yeniden aç
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = stream.getVideoTracks()[0];
        s.yerelAkim.addTrack(newTrack);

        const producer = producersRef.current.get('video');
        if (producer) {
          await producer.replaceTrack({ track: newTrack });
          producer.resume(); 
          gonder('producerResume', { producerId: producer.id });
          console.log(`[KAM] Producer resumed with new track: ${producer.id}`);
        } else {
          await produceTrack(newTrack, { type: 'video' });
        }
        useMedyaStore.setState({ kamera: true });
        gonder('kamera_degisti', { aktif: true });
      } catch (e) {
        console.error('Kamera açılamadı:', e);
        bildirim.hata('Kamera erişim hatası');
      }
    }
  }, [gonder]);

  const ekranToggle = useCallback(async () => {
    const s = useMedyaStore.getState();
    // İzin kontrolü
    const kat = useToplantiStore.getState().katilimcilar;
    const ben = kat.find(k => k.kullanici_id === aktifKullanici?.id);
    if (ben && !ben.ekran_paylasim_izni && aktifKullanici?.rol !== 'admin') {
      bildirim.hata('Ekran paylaşım izniniz yok'); return;
    }

    if (s.ekranPaylasimi) {
      // Ekran producer'ı kapat
      const ekranProducer = producersRef.current.get('screen');
      if (ekranProducer) {
        ekranProducer.close();
        gonder('producerKapat', { producerId: ekranProducer.id });
        producersRef.current.delete('screen');
      }
      s.ekranAkimi?.getTracks().forEach(t => t.stop());
      useMedyaStore.setState({ ekranAkimi: null, ekranPaylasimi: false });
      gonder('ekran_paylasimi_bitti', {});
    } else {
      try {
        const ekran = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const vt = ekran.getVideoTracks()[0];

        // Ekran track'ini produce et
        const producer = await produceTrack(vt, { type: 'screen' });

        vt.onended = () => {
          if (producer) {
            producer.close();
            gonder('producerKapat', { producerId: producer.id });
            producersRef.current.delete('screen');
          }
          ekran.getTracks().forEach(t => t.stop());
          useMedyaStore.setState({ ekranAkimi: null, ekranPaylasimi: false });
          gonder('ekran_paylasimi_bitti', {});
        };

        useMedyaStore.setState({ ekranAkimi: ekran, ekranPaylasimi: true });
        gonder('ekran_paylasimi_basladi', {});
      } catch { bildirim.hata('Ekran paylaşımı iptal'); }
    }
  }, [aktifKullanici?.id, aktifKullanici?.rol, gonder]);

  const cik = useCallback(() => {
    temizle();
    useMedyaStore.getState().sifirla();
    sohbetSifirla();
    useToplantiStore.setState({ aktifToplanti: null, katilimcilar: [] });
    setBeklemedeYerel(false);
    setTamEkranId(null);
    router.push(aktifKullanici?.rol === 'misafir' ? '/' : '/panel');
  }, [aktifKullanici?.rol, router, sohbetSifirla]);

  // ─── WS OLAY İŞLE ───
  const olayIsle = useCallback((m: WebSocketMesaji) => {
    const { olay, veri } = m;
    const tid = aktifToplanti?.id;

    if (m.istek_id && pendingRef.current.has(m.istek_id)) {
      pendingRef.current.get(m.istek_id)?.(veri);
      return;
    }

    switch (olay) {
      case 'oda_durumu':
        // Device yükle ve transport'ları oluştur
        (async () => {
          try {
            const device = new Device();
            await device.load({ routerRtpCapabilities: veri.rtpCapabilities });
            deviceRef.current = device;
            console.log('[SFU] Device yüklendi');

            if (veri.iceServers) {
              iceServersRef.current = veri.iceServers;
            }

            // Transport'ları oluştur
            await sendTransportOlustur(device);
            await recvTransportOlustur(device);
            console.log('[SFU] Transport\'lar hazır');

            // Yerel medyayı produce et
            const akim = yerelAkimRef.current;
            if (akim) {
              const audioTrack = akim.getAudioTracks()[0];
              const videoTrack = akim.getVideoTracks()[0];
              
              if (audioTrack) {
                audioTrack.enabled = false;
                await produceTrack(audioTrack, { type: 'audio' });
              }
              if (videoTrack) {
                  videoTrack.enabled = false;
                  await produceTrack(videoTrack, { type: 'video' });
              }
              console.log('[SFU] Yerel medya produce edildi');
              console.log('[SFU] Tüm producers:', Array.from(producersRef.current.entries()).map(([k, p]) => `${k}: id=${p.id} paused=${p.paused} closed=${p.closed}`));
              console.log('[SFU] Mevcut producer data:', veri.mevcutProducerlar);
            }

            // Mevcut katılımcıları ekle ve consume et
            if (veri.katilimcilar) {
              Object.entries(veri.katilimcilar).forEach(([id, b]: [string, any]) => {
                uzakKatilimciEkle(id, b);
              });
            }

            // Mevcut producer'ları consume et
            if (veri.mevcutProducerlar) {
              for (const peer of veri.mevcutProducerlar) {
                for (const prod of peer.producers || []) {
                  producerMetaRef.current.set(prod.id, { peerId: peer.id, appData: prod.appData });
                  await consumeProducer(prod.id, peer.id, peer.data, prod.appData);
                }
              }
            }

            const bekleyenler = [...bekleyenProducerlarRef.current];
            bekleyenProducerlarRef.current = [];
            for (const producer of bekleyenler) {
              await consumeProducer(producer.producerId, producer.peerId, producer.peerData, producer.appData);
            }
          } catch (e) {
            console.error('[SFU] Başlatma hatası:', e);
          }
        })();
        break;

      case 'katildi':
        if (veri?.kullanici && veri.kullanici.id !== aktifKullanici?.id) {
          uzakKatilimciEkle(veri.kullanici.id, veri.kullanici);
          // Listeyi anında güncelle
          katilimciYerlestir(veri.kullanici);
          bildirim.bilgi(`${veri.kullanici.ad_soyad} katıldı`);
        }
        // Güvenlik için arka planda tam listeyi çek (re-sync)
        if (tid) katilimcilariGetir(tid);
        break;

      case 'ayrildi':
        if (veri?.kullanici_id) {
          useMedyaStore.getState().uzakMedyaCikar(veri.kullanici_id);
          // Listeyi anında güncelle
          useToplantiStore.getState().katilimciCikar(veri.kullanici_id);
          if (veri.ad_soyad) bildirim.bilgi(`${veri.ad_soyad} ayrıldı`);
        }
        if (tid) katilimcilariGetir(tid);
        break;

      // Yeni producer — consume et
      case 'yeniProducer':
        if (veri?.producerId && veri.peerId !== aktifKullanici?.id) {
          producerMetaRef.current.set(veri.producerId, { peerId: veri.peerId, appData: veri.appData });
          consumeProducer(veri.producerId, veri.peerId, veri.peerData, veri.appData);
        }
        break;

      case 'producerKapandi':
        // İlgili consumer'ı kapat ve store'u temizle
        consumersRef.current.forEach((c, cid) => {
          if (c.producerId === veri?.producerId) {
            const peerId = veri.peerId;
            const kind = c.kind;
            const producerMeta = producerMetaRef.current.get(veri.producerId);
            const isScreen = producerMeta?.appData?.type === 'screen';
            c.close();
            consumersRef.current.delete(cid);
            
            // Store'dan stream referansını temizle
            if (peerId) {
              useMedyaStore.setState(state => {
                const yeniMap = new Map(state.uzakMedyalar);
                const mevcut = yeniMap.get(peerId);
                if (mevcut) {
                  yeniMap.set(peerId, {
                    ...mevcut,
                    ...(kind === 'video' && isScreen ? { ekranStream: null, medya: { ...mevcut.medya, ekranPaylasimi: false } } : {}),
                    ...(kind === 'video' && !isScreen ? { videoStream: null, medya: { ...mevcut.medya, kamera: false } } : {}),
                    ...(kind === 'audio' ? { sesStream: null, medya: { ...mevcut.medya, mikrofon: false } } : {}),
                  });
                }
                return { uzakMedyalar: yeniMap };
              });
            }
          }
        });
        if (veri?.producerId) producerMetaRef.current.delete(veri.producerId);
        break;

      case 'mikrofon_degisti': if (veri?.kullanici_id) useMedyaStore.getState().uzakMedyaGuncelle(veri.kullanici_id, { mikrofon: veri.aktif }); break;
      case 'kamera_degisti': if (veri?.kullanici_id) useMedyaStore.getState().uzakMedyaGuncelle(veri.kullanici_id, { kamera: veri.aktif }); break;
      case 'ekran_paylasimi_basladi': if (veri?.kullanici_id) useMedyaStore.getState().uzakMedyaGuncelle(veri.kullanici_id, { ekranPaylasimi: true }); break;
      case 'ekran_paylasimi_bitti': if (veri?.kullanici_id) useMedyaStore.getState().uzakMedyaGuncelle(veri.kullanici_id, { ekranPaylasimi: false }); break;
      case 'sohbet_mesaji': if (veri) mesajEkle(veri); break;

      case 'izin_guncellendi':
        if (veri) {
          const targetId = veri.kullanici_id;
          const yeniIzinler = veri.izinler;
          const katilimciOzeti = veri.katilimci;

          if (katilimciOzeti) {
            katilimciYerlestir(katilimciOzeti, yeniIzinler);
          } else if (targetId) {
            katilimciYerlestir({ id: targetId, kullanici_id: targetId }, yeniIzinler);
          }

          if (targetId === aktifKullanici?.id) {
            if (typeof yeniIzinler.onayi_bekliyor === 'boolean') {
              setBeklemedeYerel(yeniIzinler.onayi_bekliyor);
            }
            // Eğer onaylandıysa (onayi_bekliyor: false olduysa)
            if (yeniIzinler.onayi_bekliyor === false) {
              bildirim.basari('Toplantıya kabul edildiniz!');
            }
            
            // Maunel olarak store'daki yerel katılımcı bilgisini güncelle (Reaktivite için)
            // Eğer onaylandıysa UI'ı zorla güncelle
            if (yeniIzinler.onayi_bekliyor === false) {
              setSayfa('oda');
            }

            // Kendi izinlerim değişti
            if (yeniIzinler.mikrofon_izni === false) {
               const ap = producersRef.current.get('audio');
               if (ap && !ap.paused) { 
                 ap.pause(); 
                 gonder('producerPause', { producerId: ap.id }); 
                 useMedyaStore.setState({ mikrofon: false });
                 gonder('mikrofon_degisti', { aktif: false });
               }
            }
            if (yeniIzinler.kamera_izni === false) {
               const vp = producersRef.current.get('video');
               if (vp && !vp.paused) { 
                 vp.pause(); 
                 gonder('producerPause', { producerId: vp.id }); 
                 useMedyaStore.setState({ kamera: false });
                 gonder('kamera_degisti', { aktif: false });
               }
            }
            if (yeniIzinler.ekran_paylasim_izni === false) {
               const ep = producersRef.current.get('screen');
               if (ep) {
                 ep.close();
                 gonder('producerKapat', { producerId: ep.id });
                 producersRef.current.delete('screen');
                 useMedyaStore.getState().ekranAkimi?.getTracks().forEach(t => t.stop());
                 useMedyaStore.setState({ ekranAkimi: null, ekranPaylasimi: false });
                 gonder('ekran_paylasimi_bitti', {});
               }
            }
          } else {
             // Başkasının izni değiştiyse de store'u güncelle (Anlık liste senkronu için)
          }

          // Arka planda tam senkronizasyon yap
          if (tid) katilimcilariGetir(tid);
        }
        break;

      case 'toplanti_bitti':
        bildirim.uyari('Toplantı yönetici tarafından sonlandırıldı');
        setTimeout(() => cik(), 2000);
        break;

      case 'tumu_sessize_alindi':
        bildirim.uyari('Herkes susturuldu');
        const ap2 = producersRef.current.get('audio');
        if (ap2) { ap2.pause(); gonder('producerPause', { producerId: ap2.id }); }
        useMedyaStore.setState({ mikrofon: false });
        gonder('mikrofon_degisti', { aktif: false });
        break;

      case 'tum_kameralar_kapatildi':
        bildirim.uyari('Tüm kameralar kapatıldı');
        const vp2 = producersRef.current.get('video');
        if (vp2) { vp2.pause(); gonder('producerPause', { producerId: vp2.id }); }
        useMedyaStore.setState({ kamera: false });
        gonder('kamera_degisti', { aktif: false });
        break;

      case 'atildiniz':
        if (!veri?.hedef_id || veri.hedef_id === aktifKullanici?.id) {
          bildirim.hata('Atıldınız');
          cik();
        }
        break;
      case 'hata': bildirim.hata(veri?.mesaj || 'Hata'); break;
      case 'heartbeat_yanit': break;
    }
  }, [aktifKullanici, aktifToplanti, cik, katilimciYerlestir, katilimcilariGetir, gonder, mesajEkle, uzakKatilimciEkle]);

  // ─── KATIL ───
  const katil = async () => {
    setHata('');
    setYukle(true);
    useToplantiStore.setState({ katilimcilar: [] });
    useMedyaStore.getState().sifirla();
    sohbetSifirla();
    setTamEkranId(null);
    try {
      let t;
      if (girisYapildi) {
        t = await toplantiyaKatil(kod, sifre);
      } else {
        if (!rumuz.trim()) {
           setHata('Lütfen bir rumuz girin');
           setYukle(false);
           return;
        }
        t = await useToplantiStore.getState().misafirKatil(kod, rumuz, sifre);
      }
      
      if (t) {
        const mevcutKullanici = useAuthStore.getState().kullanici ?? depolama.kullaniciGetir();
        await katilimcilariGetir(t.id);
        const kendiKaydi = useToplantiStore.getState().katilimcilar.find((k) => k.kullanici_id === mevcutKullanici?.id)
          ?? t.katilimcilar?.find((k) => k.kullanici_id === mevcutKullanici?.id);
        setBeklemedeYerel(Boolean(kendiKaydi?.onayi_bekliyor));
        setSayfa('oda');
        const token = depolama.tokenGetir();
        if (token) wsBaglan(t.id, token);
      } else {
        setHata(useToplantiStore.getState().hata || 'Katılım başarısız');
      }
    } catch (e: any) {
      setHata(e.message || 'Katılım başarısız');
    } finally {
      setYukle(false);
    }
  };

  // ─── LOBİ / GİRİŞ ───
  const ben = katilimcilar.find(k => k.kullanici_id === aktifKullanici?.id);
  const beklemede = beklemedeYerel;
  const yoneticiMi = aktifKullanici?.rol === 'admin' || ben?.rol === 'sahip' || ben?.rol === 'moderator';
  const bekleyenler = katilimcilar.filter(k => k.aktif && k.onayi_bekliyor);
  const ilkBekleyen = bekleyenler[0];

  useEffect(() => {
    if (typeof ben?.onayi_bekliyor === 'boolean') {
      setBeklemedeYerel(ben.onayi_bekliyor);
    }
  }, [ben?.onayi_bekliyor]);

  useEffect(() => {
    const aktifIdler = new Set(
      katilimcilar
        .filter((k) => k.aktif && !k.onayi_bekliyor)
        .map((k) => k.kullanici_id)
    );
    const mevcutUzaklar = useMedyaStore.getState().uzakMedyalar;
    if (mevcutUzaklar.size === 0) return;

    const temizlenmis = new Map(mevcutUzaklar);
    let degisti = false;
    for (const peerId of Array.from(temizlenmis.keys())) {
      if (!aktifIdler.has(peerId)) {
        temizlenmis.delete(peerId);
        degisti = true;
        if (tamEkranId === peerId) {
          setTamEkranId(null);
        }
      }
    }

    if (degisti) {
      useMedyaStore.setState({ uzakMedyalar: temizlenmis });
    }
  }, [katilimcilar, tamEkranId]);

  useEffect(() => {
    if (sayfa !== 'oda' || !aktifToplanti?.id) return;

    katilimcilariGetir(aktifToplanti.id);
    const aralik = setInterval(() => {
      katilimcilariGetir(aktifToplanti.id);
    }, beklemede || yoneticiMi || bekleyenler.length > 0 ? 2000 : 6000);

    return () => clearInterval(aralik);
  }, [sayfa, aktifToplanti?.id, beklemede, yoneticiMi, bekleyenler.length, katilimcilariGetir]);

  const bekleyeniKabulEt = async (kullaniciId: string) => {
    if (!aktifToplanti?.id) return;
    const basarili = await izinGuncelle(aktifToplanti.id, kullaniciId, { onayi_bekliyor: false });
    if (basarili) {
      bildirim.basari('Kullanici toplantiya alindi');
    } else {
      bildirim.hata('Kullanici onaylanamadi');
    }
  };

  const bekleyeniReddet = async (kullaniciId: string, adSoyad: string) => {
    if (!aktifToplanti?.id) return;
    const basarili = await katilimciAt(aktifToplanti.id, kullaniciId);
    if (basarili) {
      bildirim.bilgi(`${adSoyad} bekleme odasindan reddedildi`);
    } else {
      bildirim.hata('Kullanici reddedilemedi');
    }
  };

  let pcId: string | undefined;
  let pcAdi: string | undefined;
  if (medyaStore.ekranPaylasimi) {
    pcId = aktifKullanici?.id;
    pcAdi = aktifKullanici?.ad_soyad;
  } else {
    for (const [uid, um] of Array.from(medyaStore.uzakMedyalar.entries())) {
      if (um.medya.ekranPaylasimi) {
        pcId = uid;
        pcAdi = um.ad_soyad;
        break;
      }
    }
  }

  const ekranPaylasimiAktif = Boolean(pcId);
  const yerelEkranPaylasimi = ekranPaylasimiAktif && pcId === aktifKullanici?.id;

  useEffect(() => {
    if (ekranPaylasimiAktif && tamEkranId) {
      setTamEkranId(null);
    }
  }, [ekranPaylasimiAktif, tamEkranId]);

  if (sayfa === 'lobi') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full kart p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-birincil-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-birincil-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {toplantiBilgisi?.baslik || 'Toplantıya Katıl'}
          </h1>
          <p className="text-slate-500">Kod: <span className="font-mono font-bold text-birincil-600">{kod}</span></p>
        </div>
        
        <div className="space-y-4">
          {!girisYapildi && (
             <GirisAlani 
                etiket="Rumunuz (Nick)" 
                placeholder="Örn: Ahmet" 
                value={rumuz} 
                onChange={e => setRumuz(e.target.value)} 
             />
          )}

          {toplantiBilgisi?.sifreli && (
             <GirisAlani 
                etiket="Toplantı Şifresi" 
                sifreAlani 
                placeholder="Şifreyi girin" 
                value={sifre} 
                onChange={e => setSifre(e.target.value)} 
             />
          )}

          {hata && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium animate-shake">{hata}</div>}
          
          <Buton tamGenislik yukleniyor={yukle} onClick={katil}>Katıl</Buton>
          
          <div className="pt-2 text-center">
             <Link href="/" className="text-sm text-slate-400 hover:text-birincil-600 transition-colors">
                Ana Sayfa
             </Link>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── ODA ───
  if (sayfa === 'oda' && beklemede) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
      <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-yellow-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <h1 className="text-3xl font-bold text-white">Bekleme Odası</h1>
      <p className="text-slate-400 mt-2 max-w-sm mx-auto">Toplantı yöneticisinin sizi içeri alması bekleniyor...</p>
      <div className="pt-4">
        <Buton onClick={() => { temizle(); router.push(aktifKullanici?.rol === 'misafir' ? '/' : '/panel'); }} varyant="tehlike">Toplantıdan Çık</Buton>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden font-sans selection:bg-birincil-500/30">
      {/* Üst Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900/50 backdrop-blur-md border-b border-white/5 z-20">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase opacity-90 truncate max-w-[150px] md:max-w-none">{aktifToplanti?.baslik || 'Toplantı'}</h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{aktifToplanti?.toplanti_kodu}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="hidden sm:flex px-3 py-1 rounded-full bg-slate-800/50 border border-white/5 text-[11px] text-slate-400 font-medium">
             Canlı
           </div>
           {/* Mobil Menü Butonları */}
           <div className="flex md:hidden items-center gap-1 ml-2">
             <button onClick={() => { if (sohbetAcik) kapatSohbet(); else acSohbet(); setKatPanel(false); }} className={`p-2 rounded-lg ${sohbetAcik ? 'bg-birincil-500 text-white' : 'text-slate-400'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
             </button>
             <button onClick={() => { setKatPanel(!katPanel); kapatSohbet(); }} className={`p-2 rounded-lg ${katPanel ? 'bg-birincil-500 text-white' : 'text-slate-400'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
             </button>
           </div>
        </div>
      </div>

      {yoneticiMi && ilkBekleyen && (
        <div className="border-b border-yellow-500/10 bg-yellow-500/10 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-50 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-200/80">Bekleme odasi</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {ilkBekleyen.ad_soyad} bekliyor
                {bekleyenler.length > 1 ? ` +${bekleyenler.length - 1} kisi daha` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => bekleyeniReddet(ilkBekleyen.kullanici_id, ilkBekleyen.ad_soyad)}
                className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20"
              >
                Reddet
              </button>
              <button
                onClick={() => bekleyeniKabulEt(ilkBekleyen.kullanici_id)}
                className="rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500"
              >
                Kabul et
              </button>
              <button
                onClick={() => setKatPanel(true)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                Listeyi ac
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 relative overflow-hidden">
        {/* Ana İçerik */}
        <div className="flex flex-col flex-1 relative min-w-0">
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
            {ekranPaylasimiAktif ? (
              <>
                <div className="flex-1 min-h-0 px-3 pb-2 pt-3 md:px-4 md:pb-3">
                  <EkranPaylasimi
                    paylasanId={pcId}
                    paylasanAdi={pcAdi}
                    onPaylasimiDurdur={yerelEkranPaylasimi ? ekranToggle : undefined}
                  />
                </div>
                <div className="h-32 shrink-0 border-t border-white/5 bg-slate-950/70 md:h-36">
                  <VideoIzgarasi
                    tamEkranId={null}
                    setTamEkranId={setTamEkranId}
                    gorunum="serit"
                    tiklanabilir={false}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-0">
                <VideoIzgarasi
                  tamEkranId={tamEkranId}
                  setTamEkranId={setTamEkranId}
                  gorunum="grid"
                  tiklanabilir
                />
              </div>
            )}
          </div>
        </div>

        {/* Sohbet (Masaüstünde Relative, Mobilde Absolute) */}
        <div className={sinifBirlestir(
          "transition-all duration-300 md:relative",
          sohbetAcik 
            ? "absolute inset-0 z-40 md:inset-auto md:w-80 md:flex translate-x-0" 
            : "absolute inset-0 z-40 md:inset-auto md:w-0 md:hidden translate-x-full"
        )}>
           <div className="flex flex-col h-full bg-slate-950 border-l border-white/5 w-full">
             <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5">
                <span className="text-white font-bold">Mesajlar</span>
                <button onClick={() => kapatSohbet()} className="p-2 text-slate-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             <SohbetPaneli wsMesajGonder={gonder} />
           </div>
        </div>

        {/* Katılımcı Listesi (Masaüstünde Relative, Mobilde Absolute) */}
        <div className={sinifBirlestir(
          "transition-all duration-300 md:relative",
          katPanel 
            ? "absolute inset-0 z-40 md:inset-auto md:w-80 md:flex translate-x-0" 
            : "absolute inset-0 z-40 md:inset-auto md:w-0 md:hidden translate-x-full"
        )}>
          <div className="flex flex-col h-full bg-slate-950 border-l border-white/5 w-full">
             <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5">
                <span className="text-white font-bold">Katılımcılar</span>
                <button onClick={() => setKatPanel(false)} className="p-2 text-slate-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             <KatilimciListesi acik={true} kapatFn={() => setKatPanel(false)} wsMesajGonder={gonder} />
          </div>
        </div>
      </div>

      <KontrolPaneli toplantiId={aktifToplanti?.id || ''} 
        katilimciPaneliAcik={katPanel}
        katilimciPaneliAcKapat={() => { setKatPanel(!katPanel); kapatSohbet(); }}
        wsMesajGonder={gonder}
        kameraToggle={kamToggle} 
        mikrofonToggle={mikToggle} 
        ekranPaylasimiToggle={ekranToggle} />
    </div>
  );
}

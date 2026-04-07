/**
 * Mediasoup SFU Sunucusu (v2 — Tam Entegrasyon)
 * ================================================
 * WebSocket tabanlı sinyal sunucusu.
 * Her oda bir Router, her kullanıcı Transport/Producer/Consumer.
 */

const mediasoup = require('mediasoup');
const express = require('express');
const http = require('http');
const cors = require('cors');
const config = require('./config');
const https = require('https');

// ─── IP TESPİTİ ───
async function getPublicIp() {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
    }).on('error', (err) => reject(err));
  });
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// ─── GLOBAL STATE ───
let workers = [];
let nextWorkerIdx = 0;

// rooms: Map<roomId, {
//   router: Router,
//   peers: Map<peerId, {
//     transports: Map<transportId, Transport>,
//     producers: Map<producerId, Producer>,
//     consumers: Map<consumerId, Consumer>,
//     data: { id, ad_soyad, ... }
//   }>
// }>
const rooms = new Map();

// ─── WORKER YÖNETİMİ ───
async function createWorkers() {
  const num = config.worker.sayisi;
  for (let i = 0; i < num; i++) {
    const worker = await mediasoup.createWorker(config.worker.ayarlar);

    worker.on('died', () => {
      console.error(`Worker ${worker.pid} öldü!`);
      process.exit(1);
    });
    workers.push(worker);
    console.log(`Worker ${i+1}/${num} (PID: ${worker.pid})`);
  }
}

function getNextWorker() {
  const w = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return w;
}

// ─── ODA YÖNETİMİ ───
async function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);
  
  const worker = getNextWorker();
  const router = await worker.createRouter(config.routerSecenekleri);
  
  const room = { router, worker, peers: new Map() };
  rooms.set(roomId, room);
  console.log(`[Oda] Oluşturuldu: ${roomId}`);
  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function removeRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.router.close();
  rooms.delete(roomId);
  console.log(`[Oda] Silindi: ${roomId}`);
}

// ─── HTTP API (Backend Python'dan çağrılır) ───

app.get('/saglik', (req, res) => {
  res.json({
    durum: 'calisiyor',
    workers: workers.length,
    rooms: rooms.size,
    totalPeers: Array.from(rooms.values()).reduce((s, r) => s + r.peers.size, 0),
  });
});

// 1. Odaya katıl — router RTP capabilities döndür
app.post('/api/oda/katil', async (req, res) => {
  try {
    const { room_id, peer_id, peer_data } = req.body;
    const room = await getOrCreateRoom(room_id);
    
    // Peer kaydet
    room.peers.set(peer_id, {
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      data: peer_data || {},
    });
    
    res.json({
      rtpCapabilities: room.router.rtpCapabilities,
      peerSayisi: room.peers.size,
      mevcutPeerler: Array.from(room.peers.entries())
        .filter(([id]) => id !== peer_id)
        .map(([id, p]) => ({
          id,
          data: p.data,
          producers: Array.from(p.producers.entries()).map(([pid, prod]) => ({
            id: pid,
            kind: prod.kind,
            appData: prod.appData || {},
          })),
        })),
    });
  } catch (e) {
    console.error('[API] Oda katıl hatası:', e.message);
    res.status(500).json({ hata: e.message });
  }
});

// 2. Odadan ayrıl
app.post('/api/oda/ayril', (req, res) => {
  try {
    const { room_id, peer_id } = req.body;
    const room = getRoom(room_id);
    if (!room) return res.json({ ok: true });
    
    const peer = room.peers.get(peer_id);
    if (peer) {
      peer.transports.forEach(t => t.close());
      room.peers.delete(peer_id);
    }
    
    // Oda boşsa sil
    if (room.peers.size === 0) removeRoom(room_id);
    
    res.json({ ok: true, kalanPeer: room.peers?.size || 0 });
  } catch (e) {
    res.status(500).json({ hata: e.message });
  }
});

// 3. WebRTC Transport oluştur (send veya recv)
app.post('/api/transport/olustur', async (req, res) => {
  try {
    const { room_id, peer_id, direction } = req.body; // direction: 'send' | 'recv'
    const room = getRoom(room_id);
    if (!room) return res.status(404).json({ hata: 'Oda yok' });
    
    const peer = room.peers.get(peer_id);
    if (!peer) return res.status(404).json({ hata: 'Peer yok' });
    
    const transport = await room.router.createWebRtcTransport({
      ...config.webRtcTransportSecenekleri,
      appData: { direction, peerId: peer_id }
    });
    
    transport.on('dtlsstatechange', (state) => {
      if (state === 'closed') transport.close();
    });
    
    peer.transports.set(transport.id, transport);
    
    res.json({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    });
  } catch (e) {
    console.error('[API] Transport oluştur hatası:', e.message);
    res.status(500).json({ hata: e.message });
  }
});

// 4. Transport bağla (DTLS handshake)
app.post('/api/transport/bagla', async (req, res) => {
  try {
    const { room_id, peer_id, transport_id, dtlsParameters } = req.body;
    const room = getRoom(room_id);
    if (!room) return res.status(404).json({ hata: 'Oda yok' });
    
    const peer = room.peers.get(peer_id);
    if (!peer) return res.status(404).json({ hata: 'Peer yok' });
    
    const transport = peer.transports.get(transport_id);
    if (!transport) return res.status(404).json({ hata: 'Transport yok' });
    
    await transport.connect({ dtlsParameters });
    res.json({ ok: true });
  } catch (e) {
    console.error('[API] Transport bağla hatası:', e.message);
    res.status(500).json({ hata: e.message });
  }
});

// 5. Produce (medya gönder)
app.post('/api/produce', async (req, res) => {
  try {
    const { room_id, peer_id, transport_id, kind, rtpParameters, appData } = req.body;
    const room = getRoom(room_id);
    if (!room) return res.status(404).json({ hata: 'Oda yok' });
    
    const peer = room.peers.get(peer_id);
    if (!peer) return res.status(404).json({ hata: 'Peer yok' });
    
    const transport = peer.transports.get(transport_id);
    if (!transport) return res.status(404).json({ hata: 'Transport yok' });
    
    const producer = await transport.produce({ kind, rtpParameters, appData: appData || {} });
    
    producer.on('transportclose', () => {
      producer.close();
      peer.producers.delete(producer.id);
    });
    
    peer.producers.set(producer.id, producer);
    
    res.json({ id: producer.id, kind: producer.kind, appData: producer.appData || {} });
  } catch (e) {
    console.error('[API] Produce hatası:', e.message);
    res.status(500).json({ hata: e.message });
  }
});

// 6. Consume (medya al)
app.post('/api/consume', async (req, res) => {
  try {
    const { room_id, peer_id, producer_id, rtpCapabilities } = req.body;
    const room = getRoom(room_id);
    if (!room) return res.status(404).json({ hata: 'Oda yok' });
    
    if (!room.router.canConsume({ producerId: producer_id, rtpCapabilities })) {
      return res.status(400).json({ hata: 'Cannot consume' });
    }
    
    const peer = room.peers.get(peer_id);
    if (!peer) return res.status(404).json({ hata: 'Peer yok' });
    
    // Recv transport bul (sadece direction === 'recv')
    let recvTransport = null;
    for (const [, t] of peer.transports) {
      if (t.appData?.direction === 'recv') {
        recvTransport = t;
        break;
      }
    }
    if (!recvTransport) return res.status(404).json({ hata: 'Recv transport yok' });
    
    const consumer = await recvTransport.consume({
      producerId: producer_id,
      rtpCapabilities,
      paused: false,
    });
    
    consumer.on('transportclose', () => { consumer.close(); peer.consumers.delete(consumer.id); });
    consumer.on('producerclose', () => { consumer.close(); peer.consumers.delete(consumer.id); });
    
    peer.consumers.set(consumer.id, consumer);
    
    // Producer'ın appData'sını bul
    let producerAppData = {};
    room.peers.forEach((p) => {
      const prod = p.producers.get(producer_id);
      if (prod) producerAppData = prod.appData || {};
    });
    
    res.json({
      id: consumer.id,
      producerId: producer_id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      appData: producerAppData,
    });
  } catch (e) {
    console.error('[API] Consume hatası:', e.message);
    res.status(500).json({ hata: e.message });
  }
});

// 7. Consumer resume
app.post('/api/consumer/resume', async (req, res) => {
  try {
    const { room_id, peer_id, consumer_id } = req.body;
    const room = getRoom(room_id);
    const peer = room?.peers.get(peer_id);
    const consumer = peer?.consumers.get(consumer_id);
    if (!consumer) return res.status(404).json({ hata: 'Consumer yok' });
    
    await consumer.resume();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ hata: e.message });
  }
});

// 8. Producer kapat
app.post('/api/producer/kapat', (req, res) => {
  try {
    const { room_id, peer_id, producer_id } = req.body;
    const room = getRoom(room_id);
    const peer = room?.peers.get(peer_id);
    const producer = peer?.producers.get(producer_id);
    if (producer) { producer.close(); peer.producers.delete(producer_id); }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ hata: e.message });
  }
});

// 9. Producer pause/resume
app.post('/api/producer/pause', async (req, res) => {
  try {
    const { room_id, peer_id, producer_id } = req.body;
    const room = getRoom(room_id);
    const peer = room?.peers.get(peer_id);
    const producer = peer?.producers.get(producer_id);
    if (producer) await producer.pause();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

app.post('/api/producer/resume', async (req, res) => {
  try {
    const { room_id, peer_id, producer_id } = req.body;
    const room = getRoom(room_id);
    const peer = room?.peers.get(peer_id);
    const producer = peer?.producers.get(producer_id);
    if (producer) await producer.resume();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// 10. Oda bilgisi — bir peer'ın tüm producer'larını getir
app.get('/api/oda/:roomId/producers', (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.json({ producers: [] });
  
  const producers = [];
  room.peers.forEach((peer, peerId) => {
    peer.producers.forEach((prod, prodId) => {
      producers.push({
      producerId: prodId,
      peerId,
      kind: prod.kind,
      appData: prod.appData || {},
      peerData: peer.data,
    });
    });
  });
  res.json({ producers });
});

// ─── BAŞLAT ───
async function start() {
  // Canlı ortamda (Railway gibi) IP tespiti
  if (!config.sunucu.duyurulanIp) {
    try {
      console.log('[Sistem] Kamu IP tespiti yapılıyor...');
      const publicIp = await getPublicIp();
      config.sunucu.duyurulanIp = publicIp;
      
      // webRtcServerOptions varsa duyurulanIp'yi güncelle
      if (config.webRtcServerOptions && config.webRtcServerOptions.listenInfos) {
        config.webRtcServerOptions.listenInfos[0].announcedIp = publicIp;
        config.webRtcServerOptions.listenInfos[0].protocol = 'tcp'; // Railway için TCP zorla
        config.webRtcServerOptions.listenInfos[0].ip = '0.0.0.0';
      }
      
      console.log(`[Sistem] Tespit edilen IP: ${publicIp}`);
    } catch (e) {
      console.warn('[Sistem] IP tespiti başarısız, 127.0.0.1 kullanılıyor:', e.message);
      config.sunucu.duyurulanIp = '127.0.0.1';
    }
  }

  await createWorkers();
  const port = config.sunucu.port;
  server.listen(port, () => {
    console.log('='.repeat(50));
    console.log(`Mediasoup SFU v2 — Port: ${port}`);
    console.log(`Workers: ${workers.length}`);
    console.log('='.repeat(50));
  });
}

start().catch(e => { console.error('Başlatma hatası:', e); process.exit(1); });

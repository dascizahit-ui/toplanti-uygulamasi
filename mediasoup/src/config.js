/**
 * Mediasoup Yapılandırması — VPS Üretim
 * =======================================
 * - Sinyal sunucusu: PORT 8080 (http)
 * - WebRtcServer: PORT 10000 (udp+tcp, ayrı port)
 * - MEDIASOUP_ANNOUNCED_IP env zorunlu
 */

const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || process.env.MEDIASOUP_DUYURULAN_IP || '31.169.72.98';

module.exports = {
  // ─── Worker ───
  worker: {
    sayisi: parseInt(process.env.MEDIASOUP_WORKER_SAYISI || '2'),
    ayarlar: {
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp'],
      rtcMinPort: 40000,
      rtcMaxPort: 40200,
    }
  },

  // ─── Router ─── (VP8 + H264 + Opus)
  routerSecenekleri: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: { 'x-google-start-bitrate': 1000 },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
        },
      },
    ],
  },

  // ─── Sinyal Sunucusu (HTTP API) ───
  // Backend bu porta bağlanır: http://mediasoup:4443
  sunucu: {
    port: parseInt(process.env.MEDIASOUP_PORT || '4443'),
    duyurulanIp: ANNOUNCED_IP,
  },

  // ─── WebRtcServer ─── (UDP+TCP medya trafiği)
  // Sinyal portundan FARKLI bir port kullanılmalı!
  webRtcServerOptions: {
    listenInfos: [
      {
        protocol: 'udp',
        ip: '0.0.0.0',
        announcedIp: ANNOUNCED_IP,
        port: 10000,
      },
      {
        protocol: 'tcp',
        ip: '0.0.0.0',
        announcedIp: ANNOUNCED_IP,
        port: 10000,
      },
    ],
  },

  // ─── WebRTC Transport ───
  webRtcTransportSecenekleri: {
    initialAvailableOutgoingBitrate: 600000,
    minimumAvailableOutgoingBitrate: 100000,
    maxSctpMessageSize: 262144,
    // UDP birincil, TCP fallback (her ikisi açık)
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  },
};

/**
 * Mediasoup Yapılandırması (v3 — İşçi ve Port Çakışması Giderildi)
 */

module.exports = {
  // İşçi (Worker) Ayarları
  worker: {
    sayisi: 1, // Railway testi için 1 işçi yeterli ve çakışmayı önler
    ayarlar: {
      logLevel: 'debug',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: 40000,
      rtcMaxPort: 40100,
    }
  },

  // Router Ayarları
  routerSecenekleri: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: { 'x-google-start-bitrate': 1000 }
      },
    ]
  },

  // Sunucu Ayarları (Sinyalleşme Portu - Railway 8080'i tercih eder)
  sunucu: {
    port: process.env.PORT || 8080,
    duyurulanIp: process.env.MEDIASOUP_ANNOUNCED_IP || null,
  },

  // WebRtcServer ayarları (Ses ve Görüntü Trafiği Portu)
  webRtcServerOptions: {
    listenInfos: [
      {
        protocol: 'tcp',
        ip: '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || null,
        announcedPort: process.env.MEDIASOUP_ANNOUNCED_PORT ? parseInt(process.env.MEDIASOUP_ANNOUNCED_PORT) : null,
        port: 4443 // Sinyalleşmeden farklı bir port olmalı
      }
    ],
  },

  // WebRTC Transport ayarları
  webRtcTransportSecenekleri: {
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    enableUdp: false,
    enableTcp: true,
    preferUdp: false,
    preferTcp: true,
  },
};

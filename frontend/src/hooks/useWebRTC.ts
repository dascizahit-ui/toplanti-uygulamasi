/**
 * WebRTC Hook
 * ===========
 * Peer-to-peer bağlantı yönetimi.
 * Offer/Answer/ICE Candidate alışverişini yönetir.
 * Mediasoup SFU modunda transport/producer/consumer yönetimi sağlar.
 */

'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useMedyaStore } from '@/store/medyaStore';
import type { ICESunucusu } from '@/types';

interface WebRTCSecenekleri {
  iceSunuculari?: ICESunucusu[];
  wsMesajGonder: (olay: string, veri?: any, hedefId?: string) => void;
}

export function useWebRTC({ iceSunuculari = [], wsMesajGonder }: WebRTCSecenekleri) {
  // Peer bağlantıları: { kullaniciId: RTCPeerConnection }
  const peerBaglantilari = useRef<Map<string, RTCPeerConnection>>(new Map());
  const { yerelAkim, uzakAkimAyarla } = useMedyaStore();

  // ICE yapılandırması
  const iceYapilandirmasi: RTCConfiguration = {
    iceServers: iceSunuculari.length > 0
      ? iceSunuculari.map((s) => ({
          urls: s.urls,
          username: s.username,
          credential: s.credential,
        }))
      : [{ urls: 'stun:stun.l.google.com:19302' }],
    iceCandidatePoolSize: 10,
  };

  /**
   * Yeni peer bağlantısı oluşturur.
   */
  const peerOlustur = useCallback((hedefId: string): RTCPeerConnection => {
    // Eski bağlantıyı temizle
    const eski = peerBaglantilari.current.get(hedefId);
    if (eski) {
      eski.close();
    }

    const pc = new RTCPeerConnection(iceYapilandirmasi);

    // ICE adayı oluştuğunda
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsMesajGonder('sinyal_aday', {
          aday: event.candidate.toJSON(),
        }, hedefId);
      }
    };

    // Uzak akım geldiğinde
    pc.ontrack = (event) => {
      const [akim] = event.streams;
      if (akim) {
        const tur = event.track.kind === 'video' ? 'video' : 'ses';
        uzakAkimAyarla(hedefId, akim, tur as 'video' | 'ses');
      }
    };

    // Bağlantı durumu değişikliği
    pc.onconnectionstatechange = () => {
      console.log(`WebRTC [${hedefId}]: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        peerKaldir(hedefId);
      }
    };

    // Yerel akımı ekle
    if (yerelAkim) {
      yerelAkim.getTracks().forEach((track) => {
        pc.addTrack(track, yerelAkim);
      });
    }

    peerBaglantilari.current.set(hedefId, pc);
    return pc;
  }, [iceYapilandirmasi, wsMesajGonder, yerelAkim, uzakAkimAyarla]);

  /**
   * Teklif (offer) oluşturup gönderir — arayan taraf.
   */
  const teklifGonder = useCallback(async (hedefId: string) => {
    const pc = peerOlustur(hedefId);

    try {
      const teklif = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(teklif);

      wsMesajGonder('sinyal_teklif', {
        sdp: pc.localDescription,
      }, hedefId);

      console.log(`WebRTC: Teklif gönderildi → ${hedefId}`);
    } catch (e) {
      console.error('WebRTC: Teklif oluşturma hatası', e);
    }
  }, [peerOlustur, wsMesajGonder]);

  /**
   * Gelen teklifi işleyip yanıt (answer) gönderir — aranan taraf.
   */
  const teklifIsle = useCallback(async (gonderId: string, sdp: RTCSessionDescriptionInit) => {
    const pc = peerOlustur(gonderId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const yanit = await pc.createAnswer();
      await pc.setLocalDescription(yanit);

      wsMesajGonder('sinyal_yanit', {
        sdp: pc.localDescription,
      }, gonderId);

      console.log(`WebRTC: Yanıt gönderildi → ${gonderId}`);
    } catch (e) {
      console.error('WebRTC: Teklif işleme hatası', e);
    }
  }, [peerOlustur, wsMesajGonder]);

  /**
   * Gelen yanıtı işler.
   */
  const yanitIsle = useCallback(async (gonderId: string, sdp: RTCSessionDescriptionInit) => {
    const pc = peerBaglantilari.current.get(gonderId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log(`WebRTC: Yanıt alındı ← ${gonderId}`);
    } catch (e) {
      console.error('WebRTC: Yanıt işleme hatası', e);
    }
  }, []);

  /**
   * Gelen ICE adayını işler.
   */
  const adayIsle = useCallback(async (gonderId: string, aday: RTCIceCandidateInit) => {
    const pc = peerBaglantilari.current.get(gonderId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(aday));
    } catch (e) {
      console.error('WebRTC: ICE aday ekleme hatası', e);
    }
  }, []);

  /**
   * Peer bağlantısını kaldırır.
   */
  const peerKaldir = useCallback((hedefId: string) => {
    const pc = peerBaglantilari.current.get(hedefId);
    if (pc) {
      pc.close();
      peerBaglantilari.current.delete(hedefId);
    }
  }, []);

  /**
   * Tüm peer bağlantılarını kapatır.
   */
  const tumunuKapat = useCallback(() => {
    peerBaglantilari.current.forEach((pc) => pc.close());
    peerBaglantilari.current.clear();
  }, []);

  // Bileşen unmount olduğunda temizle
  useEffect(() => {
    return () => {
      tumunuKapat();
    };
  }, [tumunuKapat]);

  return {
    teklifGonder,
    teklifIsle,
    yanitIsle,
    adayIsle,
    peerKaldir,
    tumunuKapat,
    peerSayisi: peerBaglantilari.current.size,
  };
}

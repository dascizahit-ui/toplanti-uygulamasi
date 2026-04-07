import { useState, useEffect, useRef } from 'react';

export function useSesSeviyesi(stream: MediaStream | null | undefined) {
  const [konusuyor, setKonusuyor] = useState(false);
  const [sesSeviyesi, setSesSeviyesi] = useState(0);
  
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const reqIdRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setKonusuyor(false);
      setSesSeviyesi(0);
      return;
    }

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      let sonKonusmaZamani = 0;

      const update = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
        
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += dataArrayRef.current[i];
        }
        
        const average = sum / dataArrayRef.current.length;
        setSesSeviyesi(average);

        // Ortalama ses eşikten (mesela 15) yüksekse konuşuluyor kabul et
        if (average > 15) {
          setKonusuyor(true);
          sonKonusmaZamani = Date.now();
        } else {
          // Kesik kesik yanıp sönmeyi önlemek için debouncing
          if (Date.now() - sonKonusmaZamani > 500) {
            setKonusuyor(false);
          }
        }

        reqIdRef.current = requestAnimationFrame(update);
      };

      update();
    } catch (e) {
      console.warn('Ses seviyesi analizi başlatılamadı:', e);
    }

    return () => {
      cancelAnimationFrame(reqIdRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stream]);

  return { konusuyor, sesSeviyesi };
}

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_URL, API_ENDPOINTLERI, DEPOLAMA } from '@/utils/sabitler';
import { depolama } from '@/utils/yardimcilar';

const api: AxiosInstance = axios.create({
  baseURL: API_URL || '',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

let tokenYenileniyor = false;
let bekleyenler: Array<(token: string) => void> = [];

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = depolama.tokenGetir();
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const orig = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !orig._retry) {
      if (tokenYenileniyor) {
        return new Promise(resolve => {
          bekleyenler.push(token => {
            if (orig.headers) orig.headers.Authorization = `Bearer ${token}`;
            resolve(api(orig));
          });
        });
      }
      orig._retry = true;
      tokenYenileniyor = true;
      try {
        const yt = depolama.getir(DEPOLAMA.YENILEME_TOKENI);
        if (!yt) throw new Error('Token yok');
        const baseUrl = API_URL || '';
        const y = await axios.post(`${baseUrl}${API_ENDPOINTLERI.TOKEN_YENILE}`, null, { params: { yenileme_tokeni: yt } });
        depolama.kaydet(DEPOLAMA.ERISIM_TOKENI, y.data.erisim_tokeni);
        depolama.kaydet(DEPOLAMA.YENILEME_TOKENI, y.data.yenileme_tokeni);
        bekleyenler.forEach(fn => fn(y.data.erisim_tokeni));
        bekleyenler = [];
        if (orig.headers) orig.headers.Authorization = `Bearer ${y.data.erisim_tokeni}`;
        return api(orig);
      } catch {
        depolama.temizle();
        if (typeof window !== 'undefined') window.location.href = '/giris';
        return Promise.reject(error);
      } finally { tokenYenileniyor = false; }
    }
    return Promise.reject(error);
  }
);

export function hataMesajiGetir(error: any): string {
  if (axios.isAxiosError(error)) {
    const y = error.response?.data;
    if (y?.hata?.mesaj) return y.hata.mesaj;
    if (y?.detail) return y.detail;
  }
  if (error instanceof Error) return error.message;
  return 'Bilinmeyen hata';
}

export default api;

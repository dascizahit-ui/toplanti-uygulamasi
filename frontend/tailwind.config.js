/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Ana marka renkleri
        birincil: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Toplantı arayüzü için koyu renkler
        toplanti: {
          bg: '#1a1a2e',
          panel: '#16213e',
          kart: '#0f3460',
          vurgu: '#e94560',
          metin: '#eaeaea',
          sessiz: '#6b7280',
        },
      },
      animation: {
        'nabiz': 'nabiz 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'kayma': 'kayma 0.3s ease-out',
      },
      keyframes: {
        nabiz: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        kayma: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};

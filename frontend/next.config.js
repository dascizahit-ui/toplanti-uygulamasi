/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',

  async rewrites() {
    // Nginx üzerinden Nginx → backend proxy yapıldığı için
    // bu rewrite sadece local dev ortamında gerekli.
    // Production'da Nginx /api → backend:8000 yönlendirmesi yapar.
    const backendUrl =
      process.env.BACKEND_URL ||
      'http://toplanti_backend:8000';

    console.log(`[Next.js Config] Proxy: ${backendUrl}`);

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${backendUrl}/ws/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
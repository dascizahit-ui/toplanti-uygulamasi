/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  allowedDevOrigins: [
    'https://7692-2a02-ff0-3204-4759-75d3-c26c-adb-8d29.ngrok-free.app',
  ],
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://toplanti-backend-production.up.railway.app';
    console.log(`[Next.js Config] Proxy destination: ${backendUrl}`);
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
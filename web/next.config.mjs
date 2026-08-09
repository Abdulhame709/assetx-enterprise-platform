/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // The browser must never call a sandbox-local address. API calls use the
  // relative `/api` base (see lib/api/client.ts) and the Next.js server proxies
  // them to the running backend (default http://127.0.0.1:3001, overridable via
  // API_PROXY_TARGET for other environments).
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001'}/:path*`,
      },
    ];
  },
};

export default nextConfig;

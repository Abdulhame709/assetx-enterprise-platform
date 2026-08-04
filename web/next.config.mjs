/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // The preview origin differs from the API origin; dev server proxies are handled
  // in the API client via NEXT_PUBLIC_API_URL. Allow any host for preview.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;

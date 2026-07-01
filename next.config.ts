import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Native browser View Transitions API for smooth route changes
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
};

export default nextConfig;

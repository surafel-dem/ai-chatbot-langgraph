import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    optimizePackageImports: [
      'react-tweet',
      'echarts-for-react',
      '@lobehub/icons',
    ],
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '**',
      },
      {
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
};

export default nextConfig;

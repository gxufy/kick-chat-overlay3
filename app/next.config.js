/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'files.kick.com' },
      { protocol: 'https', hostname: 'cdn.7tv.app' },
    ],
  },
};

module.exports = nextConfig;

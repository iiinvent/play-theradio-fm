/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "public-rf-song-cover.minhawebradio.net",
      },
      {
        protocol: "https",
        hostname: "public-rf-upload.minhawebradio.net",
      },
      {
        protocol: "https",
        hostname: "theradio.fm",
      },
    ],
  },
}

export default nextConfig

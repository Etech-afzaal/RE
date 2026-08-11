/** @type {import('next').NextConfig} */
const nextConfig = {
  // compress.js is ESM-only; ensure the bundler transpiles it for the client.
  transpilePackages: ["compress.js"],
  experimental: {
    // Keep bundled video tools external so they resolve their installed binary paths.
    serverComponentsExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  },
  images: {
    // Allows <Image> to render files served from /public/uploads.
    // If you move to S3/R2 in production, add that domain here instead.
    remotePatterns: [],
  },
  async redirects() {
    return [
      {
        source: "/re/:estate_name/adminarea",
        destination: "/re/:estate_name/dashboard",
        permanent: true,
      },
      {
        source: "/re/:estate_name/adminarea/:path*",
        destination: "/re/:estate_name/dashboard/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;

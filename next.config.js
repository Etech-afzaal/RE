/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allows <Image> to render files served from /public/uploads.
    // If you move to S3/R2 in production, add that domain here instead.
    remotePatterns: [],
  },
};

module.exports = nextConfig;

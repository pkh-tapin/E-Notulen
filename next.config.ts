import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pada Next.js versi terbaru, ini diletakkan langsung di akar (root) konfigurasi
  allowedDevOrigins: ["10.114.223.211", "localhost"],
};

export default nextConfig;
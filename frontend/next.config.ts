import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["92.113.39.212"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

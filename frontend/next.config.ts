import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  // Silence workspace root inference by explicitly setting tracing root
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is for the Docker image; Vercel builds its own bundle.
  output: process.env.VERCEL ? undefined : "standalone",
  redirects: async () => [{ source: "/", destination: "/discover", permanent: false }],
};

export default nextConfig;

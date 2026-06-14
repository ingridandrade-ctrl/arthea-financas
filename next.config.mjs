/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "@anthropic-ai/sdk", "recharts"],
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;

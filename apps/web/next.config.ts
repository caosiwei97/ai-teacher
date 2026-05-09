import type { NextConfig } from "next";

const API_SERVER = process.env.API_SERVER_URL || "http://localhost:38422";

const nextConfig: NextConfig = {
  transpilePackages: ["@ai-teacher/shared", "@ai-teacher/db"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_SERVER}/api/:path*`,
      },
    ];
  },
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };

    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the Arena live-preview host (https://{port}-{sandbox}.e2b.app) to talk
  // to the dev server. Add your own domains here when deploying.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai"],

  // node:sqlite is a Node builtin — keep it out of the bundler.
  serverExternalPackages: [],

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

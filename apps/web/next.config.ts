import type { NextConfig } from "next";

// Local dev shares the repo-root .env with the server. In production env comes from the container.
try {
  process.loadEnvFile("../../.env");
} catch {}

const config: NextConfig = {
  output: "standalone",
  transpilePackages: ["@qf/core"],
  poweredByHeader: false,
  webpack: (cfg) => {
    // @qf/core is ESM TypeScript that imports "./x.js"; resolve those to the .ts sources.
    cfg.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return cfg;
  },
};
export default config;

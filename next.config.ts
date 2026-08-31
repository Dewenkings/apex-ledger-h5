import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core": false,
      "@x402/evm": false,
      "@x402/svm": false,
      "@x402/extensions": false,
      accounts: false,
    };
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /ox\/_esm\/tempo\/internal\/virtualMasterPool\.js$/ },
    ];
    return config;
  },
};

export default nextConfig;

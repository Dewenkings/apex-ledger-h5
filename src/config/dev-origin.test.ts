// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("development origin configuration", () => {
  it("uses one canonical loopback host and allows both local aliases", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const nextConfig = readFileSync(resolve(root, "next.config.ts"), "utf8");

    expect(packageJson.scripts.dev).toContain("--hostname 127.0.0.1");
    expect(nextConfig).toContain('allowedDevOrigins: ["127.0.0.1", "localhost"]');
  });

  it("excludes unused optional Coinbase x402 peers from the production bundle", () => {
    const nextConfig = readFileSync(resolve(root, "next.config.ts"), "utf8");

    expect(nextConfig).toContain('"@x402/core": false');
    expect(nextConfig).toContain('"@x402/evm": false');
    expect(nextConfig).toContain('"@x402/svm": false');
    expect(nextConfig).toContain('accounts: false');
    expect(nextConfig).toContain("virtualMasterPool");
  });
});

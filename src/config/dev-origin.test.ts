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
});

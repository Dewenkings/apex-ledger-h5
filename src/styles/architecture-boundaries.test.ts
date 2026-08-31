import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(process.cwd(), "src");

describe("source architecture boundaries", () => {
  it("keeps shared layout components in a focused layout folder", () => {
    expect(existsSync(path.join(sourceRoot, "components/layout/app-shell.tsx"))).toBe(true);
    expect(existsSync(path.join(sourceRoot, "components/layout/brand-header.tsx"))).toBe(true);
  });

  it("keeps browser feature modules away from Redis and server internals", () => {
    for (const file of sourceFiles(path.join(sourceRoot, "features"))) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@upstash\/redis/);
      if (source.startsWith('"use client"') || source.startsWith("'use client'")) {
        expect(source, file).not.toMatch(/(?:@\/server|src\/server)/);
      }
    }
  });

  it("keeps layout free of wallet and Demo business dependencies", () => {
    for (const file of sourceFiles(path.join(sourceRoot, "components/layout"))) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@\/features|demo-access|useSiwe|useAccount|@upstash/);
    }
  });
});

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const file = path.join(directory, entry);
    return statSync(file).isDirectory() ? sourceFiles(file) : /\.(ts|tsx)$/.test(file) ? [file] : [];
  });
}

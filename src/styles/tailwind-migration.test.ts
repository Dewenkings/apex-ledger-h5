// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("Tailwind CSS foundation", () => {
  it("loads Tailwind through the official PostCSS integration", () => {
    const css = readFileSync(resolve(root, "src/app/globals.css"), "utf8");
    const postcss = readFileSync(resolve(root, "postcss.config.mjs"), "utf8");

    expect(css).toContain('@import "tailwindcss"');
    expect(postcss).toContain('"@tailwindcss/postcss"');
  });

  it("exposes the Apex Ledger palette as Tailwind theme utilities", () => {
    const css = readFileSync(resolve(root, "src/app/globals.css"), "utf8");

    expect(css).toContain("@theme");
    expect(css).toContain("--color-primary: #44e092");
    expect(css).toContain("--color-paper: #02c076");
    expect(css).toContain("--radius-card: 0.875rem");
  });

  it("uses Tailwind utilities in the shared application shell", () => {
    const shell = readFileSync(resolve(root, "src/components/layout/app-shell.tsx"), "utf8");

    expect(shell).toContain("min-h-dvh");
    expect(shell).toContain("bg-base");
    expect(shell).toContain("border-line");
    expect(shell).toContain("text-primary");
  });
});

// @vitest-environment node

import { describe, expect, it } from "vitest";

import { requireTrustedOrigin } from "./origin";

describe("trusted request origin", () => {
  it("accepts the exact request origin", () => {
    const request = new Request("https://apex.example/api/auth/siwe/nonce", {
      method: "POST",
      headers: { Origin: "https://apex.example" },
    });
    expect(requireTrustedOrigin(request)).toBeNull();
  });

  it("rejects missing and cross-site origins", () => {
    expect(requireTrustedOrigin(new Request("https://apex.example/api", { method: "POST" }))).toMatchObject({ status: 403 });
    expect(requireTrustedOrigin(new Request("https://apex.example/api", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    }))).toMatchObject({ status: 403 });
  });
});

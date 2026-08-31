// @vitest-environment node

import { describe, expect, it } from "vitest";

import { anonymousOwnerId, snapshotOwnerId, walletOwnerId } from "./owner";

describe("workspace owner identity", () => {
  it("creates stable anonymous and checksum wallet owners", () => {
    expect(anonymousOwnerId("visitor-1")).toBe("visitor:visitor-1");
    expect(walletOwnerId("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"))
      .toBe("eip155:account:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  });

  it("falls back to a legacy visitor owner", () => {
    expect(snapshotOwnerId({ visitorId: "visitor-1" })).toBe("visitor:visitor-1");
    expect(snapshotOwnerId({ visitorId: "visitor-1", ownerId: "eip155:account:0xabc" }))
      .toBe("eip155:account:0xabc");
  });
});

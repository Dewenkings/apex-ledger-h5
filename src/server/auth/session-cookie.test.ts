// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  clearWalletSessionCookie,
  createWalletSessionCookie,
  readWalletSessionId,
} from "./session-cookie";

describe("wallet session cookie", () => {
  it("stores only the opaque session id with hardened attributes", () => {
    const cookie = createWalletSessionCookie("session-123", true);
    expect(cookie).toContain("apx_wallet_session=session-123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=86400");
  });

  it("reads and clears the wallet session cookie", () => {
    expect(readWalletSessionId("x=1; apx_wallet_session=session-123")).toBe("session-123");
    expect(readWalletSessionId("apx_wallet_session=bad value")).toBeUndefined();
    expect(clearWalletSessionCookie(false)).toContain("Max-Age=0");
  });
});

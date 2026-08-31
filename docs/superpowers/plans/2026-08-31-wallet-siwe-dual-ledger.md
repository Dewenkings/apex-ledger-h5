# Wallet SIWE Dual Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real EVM wallet connection and SIWE authentication while preserving OKX Demo as a separate virtual trading ledger and showing wallet assets as read-only on-chain data.

**Architecture:** Reown AppKit and wagmi own client wallet connectivity; a project-owned SIWE service owns nonce validation, signature verification, sessions, and anonymous-to-wallet workspace binding. Demo orders use a stable `ownerId`, while on-chain balances and OKX Demo balances remain separate resource types, queries, cards, and failure domains.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Reown AppKit, wagmi, viem, TanStack Query, `siwe`, Upstash Redis, Zod, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-31-wallet-siwe-dual-ledger-design.md`

## Global Constraints

- Supported networks are exactly Ethereum mainnet (`1`), Base (`8453`), and Arbitrum One (`42161`).
- Wallet actions are limited to connect, switch network, `personal_sign`, public RPC reads, disconnect, and SIWE logout.
- Never call `eth_sendTransaction`, contract write hooks, ERC-20 approve, Swap, deposit, withdrawal, or real trading endpoints.
- SIWE login does not grant OKX Demo write access; `apx_demo_session` remains a separate authorization gate.
- OKX Demo balances are virtual funds and must never be combined numerically with on-chain wallet balances.
- `NEXT_PUBLIC_REOWN_PROJECT_ID` is public config; Redis, Session Secret, and OKX credentials remain server-only secrets.
- Nonces expire after 5 minutes and are consumed once; wallet sessions expire after 24 hours.
- Preserve anonymous visitor order access and migrate it idempotently on first SIWE binding.
- Use TDD for every behavior change and keep `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` green.
- Do not refactor market adapters, candlestick behavior, or OKX request signing unless a failing integration test proves the wallet work requires it.

---

## File Structure

```text
src/
├── app/api/auth/siwe/
│   ├── nonce/route.ts
│   ├── session/route.ts
│   ├── verify/route.ts
│   ├── handlers.ts
│   └── routes.test.ts
├── components/layout/
│   ├── app-shell.tsx
│   └── brand-header.tsx
├── features/
│   ├── auth/
│   │   ├── auth-client.ts
│   │   ├── use-siwe-session.ts
│   │   └── use-siwe-session.test.tsx
│   ├── portfolio/
│   │   ├── demo-balance-card.tsx
│   │   ├── onchain-wallet-card.tsx
│   │   ├── portfolio-screen.tsx
│   │   └── portfolio-screen.test.tsx
│   └── wallet/
│       ├── connect-wallet-screen.tsx
│       ├── connect-wallet-screen.test.tsx
│       ├── use-wallet-assets.ts
│       └── use-wallet-assets.test.tsx
├── lib/web3/
│   ├── chains.ts
│   ├── chains.test.ts
│   ├── tokens.ts
│   └── tokens.test.ts
├── providers/
│   └── web3-provider.tsx
├── styles/
│   └── architecture-boundaries.test.ts
└── server/
    ├── auth/
    │   ├── contracts.ts
    │   ├── session-cookie.ts
    │   ├── session-cookie.test.ts
    │   ├── siwe-service.ts
    │   └── siwe-service.test.ts
    ├── http/
    │   ├── origin.ts
    │   └── origin.test.ts
    └── identity/
        ├── owner.ts
        ├── owner.test.ts
        ├── repository.ts
        └── repository.test.ts
```

Existing compatibility files modified by the plan:

- `src/lib/okx-demo/contracts.ts`: order snapshots gain stable `ownerId` and legacy visitor fallback.
- `src/lib/demo-access/store.ts`: owner-indexed ledger operations and workspace migration.
- `src/lib/okx-demo/order-service.ts`: order ownership uses `DemoActor.ownerId`.
- `src/app/api/demo/_shared.ts`: combines Demo authorization with optional wallet identity.
- `src/components/screens.tsx`: removes wallet/settings implementations and keeps temporary re-exports.
- `src/app/layout.tsx`: supplies cookie state to the Web3 provider.
- `src/app/connect-wallet/page.tsx`, `src/app/portfolio/page.tsx`, `src/app/settings/page.tsx`: import focused feature screens.
- `.env.example`, `README.md`, `docs/technical-design.md`: configuration and security semantics.

---

### Task 1: Web3 configuration and verified token allowlist

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `src/lib/web3/chains.ts`
- Create: `src/lib/web3/chains.test.ts`
- Create: `src/lib/web3/tokens.ts`
- Create: `src/lib/web3/tokens.test.ts`

**Interfaces:**
- Produces: `SUPPORTED_CHAINS`, `SupportedChainId`, `isSupportedChainId(value)`, `readReownProjectId(environment)`, `TOKENS_BY_CHAIN`, `getTrackedTokens(chainId)`.
- Token records use `{ chainId, address, symbol, decimals }` and only include contracts verified from issuer documentation.

- [ ] **Step 1: Write failing configuration tests**

```ts
expect(SUPPORTED_CHAINS.map((chain) => chain.id)).toEqual([1, 8453, 42161]);
expect(isSupportedChainId(8453)).toBe(true);
expect(isSupportedChainId(10)).toBe(false);
expect(() => readReownProjectId({})).toThrow("NEXT_PUBLIC_REOWN_PROJECT_ID is required");
expect(readReownProjectId({ NEXT_PUBLIC_REOWN_PROJECT_ID: "project-id" })).toBe("project-id");
```

Token tests assert Ethereum USDC/USDT and Base/Arbitrum native USDC addresses exactly:

```ts
expect(getTrackedTokens(1).map((token) => token.symbol)).toEqual(["USDC", "USDT"]);
expect(getTrackedTokens(8453)[0]?.address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
expect(getTrackedTokens(42161)[0]?.address).toBe("0xaf88d065e77c8cC2239327C5EDb3A432268e5831");
```

- [ ] **Step 2: Run tests and verify missing modules fail**

Run: `npm test -- src/lib/web3/chains.test.ts src/lib/web3/tokens.test.ts`

Expected: FAIL because `chains.ts` and `tokens.ts` do not exist.

- [ ] **Step 3: Install dependencies and implement config**

Run:

```bash
npm install @reown/appkit @reown/appkit-adapter-wagmi wagmi viem @tanstack/react-query siwe
```

Implement `SUPPORTED_CHAINS = [mainnet, base, arbitrum] as const`, a Set-based chain guard, strict project ID reader, and immutable token arrays. Use issuer-confirmed addresses:

```ts
export const TOKENS_BY_CHAIN = {
  1: [
    { chainId: 1, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { chainId: 1, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
  ],
  8453: [{ chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 }],
  42161: [{ chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 }],
} as const;
```

Append `NEXT_PUBLIC_REOWN_PROJECT_ID=` to `.env.example` with a comment that it is public configuration, not a secret.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/lib/web3/chains.test.ts src/lib/web3/tokens.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/web3
git commit -m "feat: add EVM wallet configuration"
```

---

### Task 2: Stable owner identity and owner-indexed Demo ledger

**Files:**
- Create: `src/server/identity/owner.ts`
- Create: `src/server/identity/owner.test.ts`
- Modify: `src/lib/okx-demo/contracts.ts`
- Modify: `src/lib/demo-access/store.ts`
- Modify: `src/lib/demo-access/store.test.ts`

**Interfaces:**
- Produces: `type OwnerId = \`visitor:${string}\` | \`eip155:account:${Address}\``.
- Produces: `anonymousOwnerId(visitorId)`, `walletOwnerId(address)`, `snapshotOwnerId(snapshot)`.
- `DemoOrderSnapshot` adds `ownerId?: OwnerId`; `visitorId` remains during migration.
- `DemoSafetyStore` adds `saveOwnerOrder`, `listOwnerOrders`, `removeOwnerOrder`, `countOwnerOpenOrders`, and `migrateVisitorWorkspace`.

- [ ] **Step 1: Write failing owner and migration tests**

```ts
expect(anonymousOwnerId("visitor-1")).toBe("visitor:visitor-1");
expect(walletOwnerId("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"))
  .toBe("eip155:account:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
expect(snapshotOwnerId({ ...snapshot, ownerId: undefined, visitorId: "visitor-1" }))
  .toBe("visitor:visitor-1");
```

Store tests create two legacy visitor orders, run `migrateVisitorWorkspace("visitor-1", walletOwner)`, assert both appear in `listOwnerOrders(walletOwner, 50)`, and run migration a second time to prove no duplicates.

- [ ] **Step 2: Run tests and verify interface failures**

Run: `npm test -- src/server/identity/owner.test.ts src/lib/demo-access/store.test.ts`

Expected: FAIL with missing owner module and store methods.

- [ ] **Step 3: Implement owner compatibility and repositories**

Use viem `getAddress` for checksum normalization. Memory storage indexes snapshots by `ownerId`. Redis storage uses:

```text
apx:owner-orders:{ownerId}       Sorted Set ordId -> createdAt
apx:migration:{visitorId}:{ownerId} completion marker, 30-day TTL
apx:bind-lock:{visitorId}        SET NX EX 10
```

Migration acquires the lock, reads the current anonymous visitor ZSET, writes owner-aware snapshots and owner ZSET entries, stores the per-wallet migration marker, then deletes the migrated anonymous index. Release the lock in `finally`. Every write is idempotent by `ordId`; failure before completion does not create a wallet session. A later wallet switch cannot move the previous wallet owner's index because only the anonymous visitor index is eligible; any new orders deliberately created after logout may be migrated to the next wallet after a new SIWE proof.

- [ ] **Step 4: Run owner/store tests and existing order-service tests**

Run: `npm test -- src/server/identity/owner.test.ts src/lib/demo-access/store.test.ts src/lib/okx-demo/order-service.test.ts`

Expected: PASS with legacy visitor behavior preserved.

- [ ] **Step 5: Commit**

```bash
git add src/server/identity src/lib/okx-demo/contracts.ts src/lib/demo-access/store.ts src/lib/demo-access/store.test.ts
git commit -m "feat: add stable demo workspace owners"
```

---

### Task 3: SIWE nonce and session repository

**Files:**
- Create: `src/server/auth/contracts.ts`
- Create: `src/server/auth/session-cookie.ts`
- Create: `src/server/auth/session-cookie.test.ts`
- Create: `src/server/identity/repository.ts`
- Create: `src/server/identity/repository.test.ts`

**Interfaces:**
- Produces: `SiweNonceRecord`, `WalletSession`, `IdentityRepository`.
- Produces: `createWalletSessionCookie(sessionId, secure)`, `clearWalletSessionCookie(secure)`, `readWalletSessionId(cookieHeader)`.
- Repository methods: `saveNonce`, `consumeNonce`, `saveSession`, `getSession`, `deleteSession`, `consumeRateLimit`.

- [ ] **Step 1: Write failing repository and Cookie tests**

```ts
expect(createWalletSessionCookie("session-123", true)).toContain("apx_wallet_session=session-123");
expect(createWalletSessionCookie("session-123", true)).toContain("HttpOnly");
expect(createWalletSessionCookie("session-123", true)).toContain("Secure");
expect(readWalletSessionId("x=1; apx_wallet_session=session-123")).toBe("session-123");
```

Repository tests save a nonce, consume it once successfully, receive `null` on the second consume, expire it after 5 minutes, and round-trip a 24-hour wallet session.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- src/server/auth/session-cookie.test.ts src/server/identity/repository.test.ts`

Expected: FAIL because repository and Cookie helpers do not exist.

- [ ] **Step 3: Implement Memory and Redis identity repositories**

Use these records:

```ts
export type SiweNonceRecord = {
  nonce: string; visitorId: string; address: Address; chainId: SupportedChainId;
  domain: string; uri: string; issuedAt: string; expirationTime: string;
};
export type WalletSession = {
  sessionId: string; visitorId: string; ownerId: OwnerId; address: Address;
  chainId: SupportedChainId; expiresAt: number;
};
```

Redis keys are `apx:siwe:nonce:{nonce}`, `apx:wallet-session:{sessionId}`, and `apx:siwe-rate:{scope}`. `consumeNonce` uses Lua `GET` + `DEL` atomically. Session Cookie max-age is 24 hours and contains only the random session ID.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/server/auth/session-cookie.test.ts src/server/identity/repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/auth src/server/identity/repository.ts src/server/identity/repository.test.ts
git commit -m "feat: persist SIWE nonces and sessions"
```

---

### Task 4: SIWE validation service and HTTP routes

**Files:**
- Create: `src/server/http/origin.ts`
- Create: `src/server/http/origin.test.ts`
- Create: `src/server/auth/siwe-service.ts`
- Create: `src/server/auth/siwe-service.test.ts`
- Create: `src/app/api/auth/siwe/handlers.ts`
- Create: `src/app/api/auth/siwe/routes.test.ts`
- Create: `src/app/api/auth/siwe/nonce/route.ts`
- Create: `src/app/api/auth/siwe/verify/route.ts`
- Create: `src/app/api/auth/siwe/session/route.ts`

**Interfaces:**
- Produces: `SiweAuthService.issueChallenge(input, requestContext)`, `verify(input, requestContext)`, `getSession(id)`, `logout(id)`.
- Produces response codes: `invalid_request`, `unsupported_chain`, `origin_forbidden`, `nonce_expired`, `signature_invalid`, `rate_limited`, `auth_unavailable`.

- [ ] **Step 1: Write failing security tests**

Cover exact-origin acceptance, cross-origin rejection, unsupported chain, nonce reuse, expired message, address mismatch, domain mismatch, URI mismatch, invalid signature, successful EOA verification, and workspace migration failure.

```ts
await expect(service.verify({ message, signature }, context)).resolves.toMatchObject({
  authenticated: true,
  address,
  chainId: 1,
});
await expect(service.verify({ message, signature }, context)).rejects.toMatchObject({ code: "nonce_expired" });
```

Inject `verifyMessage(args): Promise<boolean>` into the service so unit tests do not call a public RPC.

- [ ] **Step 2: Run SIWE tests and verify failure**

Run: `npm test -- src/server/http/origin.test.ts src/server/auth/siwe-service.test.ts src/app/api/auth/siwe/routes.test.ts`

Expected: FAIL because service and routes do not exist.

- [ ] **Step 3: Implement validation and routes**

Generate nonce with `randomBytes(16).toString("hex")`. Parse with `new SiweMessage(message)`. Validate EIP-4361 fields against the stored nonce record before calling the injected viem Public Client verifier. Atomically consume the nonce, migrate the visitor workspace, create a random 32-byte session ID, save the 24-hour session, and then set the Cookie.

Route schemas:

```ts
const challengeSchema = z.object({ address: z.string(), chainId: z.number().int() });
const verifySchema = z.object({
  message: z.string().min(1).max(4096),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(2048),
});
```

All responses set `Cache-Control: no-store`. POST/DELETE routes require same origin. The session response returns `{ authenticated, address, chainId, expiresAt }` and never returns nonce, signature, ownerId, or Redis keys.

- [ ] **Step 4: Run focused and Demo route regression tests**

Run: `npm test -- src/server/http/origin.test.ts src/server/auth/siwe-service.test.ts src/app/api/auth/siwe/routes.test.ts src/app/api/demo/routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/http src/server/auth/siwe-service.ts src/server/auth/siwe-service.test.ts src/app/api/auth/siwe
git commit -m "feat: authenticate EVM wallets with SIWE"
```

---

### Task 5: Owner-aware Demo request principal

**Files:**
- Modify: `src/app/api/demo/_shared.ts`
- Modify: `src/app/api/demo/_handlers.ts`
- Modify: `src/app/api/demo/routes.test.ts`
- Modify: `src/lib/okx-demo/order-service.ts`
- Modify: `src/lib/okx-demo/order-service.test.ts`
- Modify: `src/components/trade/use-demo-account.ts`

**Interfaces:**
- Produces: `DemoActor = DemoSession & { ownerId: OwnerId }`.
- `getActor(request)` requires Demo session + visitor Cookie and optionally resolves a valid wallet session.
- Order service methods consume `DemoActor`; shared balance remains account-scoped and unchanged.

- [ ] **Step 1: Write failing principal tests**

Assert an anonymous request uses `visitor:{visitorId}`, a valid wallet session uses `eip155:account:{address}`, an expired wallet session falls back to anonymous, and missing Demo authorization remains HTTP 401 even with a valid SIWE session.

Order-service tests save/list/cancel by `ownerId` and prove another wallet owner cannot list or cancel the order.

- [ ] **Step 2: Run focused tests and verify legacy API fails the new assertions**

Run: `npm test -- src/app/api/demo/routes.test.ts src/lib/okx-demo/order-service.test.ts`

Expected: FAIL because Demo APIs only resolve `visitorId`.

- [ ] **Step 3: Implement actor resolution and owner ledger usage**

`createDefaultDemoApiDependencies` reads the opaque wallet Cookie and `IdentityRepository.getSession`. It accepts the wallet identity only when its `visitorId` matches the current signed visitor Cookie. Otherwise it safely uses `anonymousOwnerId(visitorId)`.

Replace order rate/idempotency/index scopes with `actor.ownerId`; keep IP/global limits unchanged. Keep `visitorId` in newly written snapshots for rollback compatibility, but treat `ownerId` as authoritative.

- [ ] **Step 4: Run Demo integration regression suite**

Run: `npm test -- src/app/api/demo/routes.test.ts src/lib/okx-demo/order-service.test.ts src/components/trade/demo-account-screens.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/demo src/lib/okx-demo/order-service.ts src/lib/okx-demo/order-service.test.ts src/components/trade/use-demo-account.ts
git commit -m "feat: bind demo orders to wallet owners"
```

---

### Task 6: Reown AppKit and wagmi SSR provider

**Files:**
- Create: `src/providers/web3-provider.tsx`
- Create: `src/providers/web3-provider.test.tsx`
- Create: `src/lib/web3/appkit.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/test-setup.ts`

**Interfaces:**
- Produces: `Web3Provider({ children, cookies })`.
- Produces: a single `wagmiAdapter`, `wagmiConfig`, and AppKit instance for the application.

- [ ] **Step 1: Write failing provider tests**

Mock Reown initialization and assert the Provider renders children, initializes QueryClient once, uses the three supported networks, disables analytics, and passes cookie-derived initial wagmi state.

```tsx
render(<Web3Provider cookies="wagmi.store=value"><span>child</span></Web3Provider>);
expect(screen.getByText("child")).toBeInTheDocument();
expect(cookieToInitialState).toHaveBeenCalledWith(wagmiConfig, "wagmi.store=value");
```

- [ ] **Step 2: Run provider tests and verify missing module failure**

Run: `npm test -- src/providers/web3-provider.test.tsx`

Expected: FAIL because the Provider does not exist.

- [ ] **Step 3: Implement SSR-safe provider**

Use `WagmiAdapter({ ssr: true, storage: createStorage({ storage: cookieStorage }), projectId, networks })`. Initialize AppKit once in a client-only module with metadata URL matching `NEXT_PUBLIC_APP_URL` or `https://apex-ledger-h5.vercel.app`, and `features.analytics = false`.

Make `RootLayout` async, read request cookies with `headers()`, and render:

```tsx
<Web3Provider cookies={cookieHeader}>{children}</Web3Provider>
```

Create QueryClient through lazy `useState(() => new QueryClient())`; do not create it during every render and do not update state from module/render side effects.

- [ ] **Step 4: Run provider, hydration regression, type tests**

Run: `npm test -- src/providers/web3-provider.test.tsx src/config/dev-origin.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/providers src/lib/web3/appkit.ts src/app/layout.tsx src/test-setup.ts
git commit -m "feat: configure SSR-safe wallet providers"
```

---

### Task 7: Wallet connect and SIWE client flow

**Files:**
- Create: `src/features/auth/auth-client.ts`
- Create: `src/features/auth/use-siwe-session.ts`
- Create: `src/features/auth/use-siwe-session.test.tsx`
- Create: `src/features/wallet/connect-wallet-screen.tsx`
- Create: `src/features/wallet/connect-wallet-screen.test.tsx`
- Modify: `src/app/connect-wallet/page.tsx`
- Modify: `src/components/screens.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `getChallenge(address, chainId)`, `verifySiwe(message, signature)`, `getSiweSession()`, `logoutSiwe()`.
- Produces: `useSiweSession()` state machine: `disconnected | connected | signing | authenticated | error`.

- [ ] **Step 1: Write failing UI state tests**

Mock wagmi/AppKit boundaries and cover disconnected, connected-not-authenticated, signing, authenticated, unsupported network, rejected signature, expired nonce retry, and logout.

```tsx
expect(screen.getByText("连接不等于登录")).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "签名并登录" }));
expect(await screen.findByText("钱包身份已验证")).toBeInTheDocument();
expect(mockSignMessage).toHaveBeenCalledTimes(1);
```

Assert no component imports or invokes `sendTransaction`, `writeContract`, or approval hooks.

- [ ] **Step 2: Run component tests and verify failure**

Run: `npm test -- src/features/auth/use-siwe-session.test.tsx src/features/wallet/connect-wallet-screen.test.tsx`

Expected: FAIL because the wallet feature does not exist.

- [ ] **Step 3: Implement client flow and focused screen**

Use AppKit for connection modal, wagmi `useAccount`, `useChainId`, `useSignMessage`, and `useDisconnect`. The server challenge supplies canonical SIWE fields; construct with `SiweMessage`, sign the prepared message, verify server-side, then invalidate the session query.

Render explicit copy:

- “连接钱包” before connection.
- “连接不等于登录” after connection.
- “签名仅用于登录，不授权转账，不产生 Gas” before signing.
- “钱包身份已验证” after successful SIWE.

Replace the static provider list and remote Google-hosted logos. `src/components/screens.tsx` temporarily re-exports the new screen so existing imports remain stable.

- [ ] **Step 4: Run focused tests and lint**

Run: `npm test -- src/features/auth/use-siwe-session.test.tsx src/features/wallet/connect-wallet-screen.test.tsx && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth src/features/wallet/connect-wallet-screen.tsx src/features/wallet/connect-wallet-screen.test.tsx src/app/connect-wallet/page.tsx src/components/screens.tsx src/app/globals.css
git commit -m "feat: connect and authenticate EVM wallets"
```

---

### Task 8: Read-only wallet assets and dual-ledger portfolio

**Files:**
- Create: `src/features/wallet/use-wallet-assets.ts`
- Create: `src/features/wallet/use-wallet-assets.test.tsx`
- Create: `src/features/portfolio/demo-balance-card.tsx`
- Create: `src/features/portfolio/onchain-wallet-card.tsx`
- Create: `src/features/portfolio/portfolio-screen.tsx`
- Create: `src/features/portfolio/portfolio-screen.test.tsx`
- Modify: `src/app/portfolio/page.tsx`
- Modify: `src/components/screens.tsx`
- Delete: `src/components/trade/portfolio-screen.tsx`
- Modify: `src/components/trade/demo-account-screens.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `WalletAsset = { source: "onchain"; chainId; symbol; balance; decimals; usdValue: string | null; updatedAt }`.
- Produces: `useWalletAssets(address, chainId)` with isolated `loading | ready | stale | error` state.
- Demo balance retains `scope: "shared-okx-demo"` and `virtual: true`.

- [ ] **Step 1: Write failing asset and semantic-isolation tests**

Mock native balance plus tracked token reads. Assert formatting uses token decimals, unsupported chains do not query, RPC errors affect only the wallet card, and no total combines `50000` Demo USDT with wallet values.

```tsx
expect(await screen.findByText("OKX DEMO · VIRTUAL FUNDS")).toBeInTheDocument();
expect(screen.getByText("ON-CHAIN · READ ONLY")).toBeInTheDocument();
expect(screen.getByText("两类资产不会合并计算")).toBeInTheDocument();
expect(screen.queryByText("50,123.45 USDT")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- src/features/wallet/use-wallet-assets.test.tsx src/features/portfolio/portfolio-screen.test.tsx`

Expected: FAIL because the wallet asset hook and dual cards do not exist.

- [ ] **Step 3: Implement read-only queries and cards**

Use wagmi `useBalance` for native ETH and `useReadContracts` with the ERC-20 `balanceOf` ABI for `getTrackedTokens(chainId)`. Do not import any wallet write action. Reuse the existing market price service only for supported symbols; stablecoins may use `1.00` display valuation with a “reference estimate” label, not as a trading balance.

Keep separate components and error boundaries:

```tsx
<DemoBalanceCard account={demoAccount} />
<OnchainWalletCard wallet={walletAssets} />
```

Move the portfolio page to the feature folder and leave a compatibility re-export until all imports/tests are migrated.

- [ ] **Step 4: Run portfolio and Demo regression tests**

Run: `npm test -- src/features/wallet/use-wallet-assets.test.tsx src/features/portfolio/portfolio-screen.test.tsx src/components/trade/demo-account-screens.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/wallet src/features/portfolio src/app/portfolio/page.tsx src/components/screens.tsx src/components/trade/demo-account-screens.test.tsx src/app/globals.css
git add -u src/components/trade/portfolio-screen.tsx
git commit -m "feat: separate demo and onchain assets"
```

---

### Task 9: Settings extraction, layout cleanup, documentation, and production gate

**Files:**
- Create: `src/features/wallet/settings-screen.tsx`
- Create: `src/features/wallet/settings-screen.test.tsx`
- Move: `src/components/app-shell.tsx` -> `src/components/layout/app-shell.tsx`
- Move: `src/components/brand-header.tsx` -> `src/components/layout/brand-header.tsx`
- Modify: imports under `src/components/**` and `src/features/**`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/components/screens.tsx`
- Create: `src/styles/architecture-boundaries.test.ts`
- Modify: `README.md`
- Modify: `docs/technical-design.md`
- Modify: `.env.example`

**Interfaces:**
- Settings displays wallet address, supported chain, SIWE status, Demo authorization status, switch-network action, disconnect action, and SIWE logout.
- Layout components have no feature-specific wallet or Demo dependencies.

- [ ] **Step 1: Write failing settings and architecture tests**

```tsx
expect(screen.getByText("钱包身份")).toBeInTheDocument();
expect(screen.getByText("模拟交易权限")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "退出钱包登录" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "断开钱包连接" })).toBeInTheDocument();
```

Add a source-boundary test that fails if `src/features` imports `@upstash/redis` or if client files import `src/server`.

- [ ] **Step 2: Run tests and verify missing focused settings screen**

Run: `npm test -- src/features/wallet/settings-screen.test.tsx src/styles/tailwind-migration.test.ts`

Expected: FAIL because settings are still embedded in `screens.tsx`.

- [ ] **Step 3: Extract settings/layout and update durable docs**

Settings masks the address visually but copies the full checksum address only after an explicit click. “断开钱包连接” calls the connector disconnect action; “退出钱包登录” deletes the server SIWE session. Neither action deletes Demo orders.

Move AppShell and BrandHeader with mechanical import updates. Reduce `screens.tsx` to compatibility exports only; do not move stable market/trade screens in this task.

README and technical design must document:

- connection vs SIWE vs Demo authorization;
- public Reown Project ID and server-only secrets;
- owner workspace migration;
- separate Demo/on-chain asset semantics;
- no transaction/approve/write capability;
- local and Vercel setup steps.

- [ ] **Step 4: Run the complete local quality gate**

Run:

```bash
npm test
npm run lint
npm run typecheck
NEXT_PUBLIC_REOWN_PROJECT_ID=local-build-verification npm run build
git diff --check
```

Expected: all tests pass, lint/typecheck pass, every route builds, and no whitespace errors appear.

- [ ] **Step 5: Commit**

```bash
git add src README.md docs/technical-design.md .env.example
git commit -m "refactor: organize wallet identity features"
```

- [ ] **Step 6: Configure and verify production**

Create a Reown Cloud AppKit project for `https://apex-ledger-h5.vercel.app`, add localhost for development, and set `NEXT_PUBLIC_REOWN_PROJECT_ID` in Vercel Production. Push `main`, wait for Vercel `READY`, and verify:

1. Public markets render without wallet interaction.
2. MetaMask connects and SIWE signs a readable login message.
3. No wallet prompt contains transfer, approval, value, or Gas.
4. Refresh preserves the connected UI without hydration warnings.
5. Demo access remains separately locked until the Demo access code is entered.
6. A new Demo order appears under the authenticated wallet owner.
7. The same wallet in a second browser restores its wallet-owned order after SIWE.
8. Wallet RPC failure leaves the OKX Demo card and orders usable.

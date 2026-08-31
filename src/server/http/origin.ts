export function requireTrustedOrigin(request: Request, canonicalOrigin?: string): Response | null {
  const provided = request.headers.get("origin");
  const expected = canonicalOrigin?.replace(/\/$/, "") ?? new URL(request.url).origin;
  if (provided === expected) return null;
  return Response.json(
    { error: "Cross-origin authentication writes are not allowed", code: "origin_forbidden" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

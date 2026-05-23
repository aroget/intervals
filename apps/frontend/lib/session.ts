/**
 * Stateless HMAC-SHA256 signed session tokens.
 * Uses Web Crypto API — compatible with Edge Runtime (middleware) and Node.js.
 */

export interface SessionPayload {
  athleteId: string;
  athleteName: string;
  expiresAt: number; // epoch ms
}

const SESSION_COOKIE = "intervals_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── base64url helpers ─────────────────────────────────────────────────────────

function b64url(input: ArrayBuffer | string): string {
  const binary =
    typeof input === "string"
      ? input
      : String.fromCharCode(...new Uint8Array(input));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromB64url(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// ── HMAC key ─────────────────────────────────────────────────────────────────

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is not set");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function signSession(
  payload: Omit<SessionPayload, "expiresAt">,
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const key = await getKey();
  const data = b64url(JSON.stringify(full));
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${b64url(sig)}`;
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 0) return null;
    const data = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    const key = await getKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromB64url(sig) as unknown as ArrayBuffer,
      new TextEncoder().encode(data),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      atob(data.replace(/-/g, "+").replace(/_/g, "/")),
    ) as SessionPayload;
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Short-lived HMAC token for streaming a private storage object via the
 * /api/files/stream/$token endpoint.
 *
 * Token format: base64url(JSON payload).base64url(hex hmac)
 * Payload: { p: file_path, exp: unix_seconds }
 *
 * Signed with SUPABASE_SERVICE_ROLE_KEY (server-only), so tokens cannot be
 * forged by clients. Tokens are stateless and valid for ~10 minutes.
 */

const TOKEN_TTL_SECONDS = 10 * 60;

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function getSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for stream token signing");
  return secret;
}

export function signFileStreamToken(filePath: string): string {
  const payload = JSON.stringify({
    p: filePath,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });
  const payloadEnc = b64url(payload);
  const sig = createHmac("sha256", getSecret()).update(payloadEnc).digest();
  return `${payloadEnc}.${b64url(sig)}`;
}

export function verifyFileStreamToken(token: string): { filePath: string } | null {
  const [payloadEnc, sigEnc] = token.split(".");
  if (!payloadEnc || !sigEnc) return null;
  let expectedSig: Buffer;
  let providedSig: Buffer;
  try {
    expectedSig = createHmac("sha256", getSecret()).update(payloadEnc).digest();
    providedSig = b64urlDecode(sigEnc);
  } catch {
    return null;
  }
  if (expectedSig.length !== providedSig.length) return null;
  if (!timingSafeEqual(expectedSig, providedSig)) return null;

  let payload: { p?: string; exp?: number };
  try {
    payload = JSON.parse(b64urlDecode(payloadEnc).toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.p || !payload.exp) return null;
  if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
  return { filePath: payload.p };
}

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "madagin_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 12;

export type MadaginSession = {
  username: string;
};

function getSigningKey() {
  const secret = process.env.MADAGIN_AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export function isInternalAuthConfigured() {
  return Boolean(
    getSigningKey() && process.env.MADAGIN_INTERNAL_PASSWORD?.length,
  );
}

export async function createSessionToken(username: string) {
  const key = getSigningKey();
  if (!key) throw new Error("Internal authentication is not configured.");

  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .setIssuer("madagin-internal")
    .setAudience("madagin-owner")
    .sign(key);
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<MadaginSession | null> {
  const key = getSigningKey();
  if (!key || !token) return null;

  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: "madagin-internal",
      audience: "madagin-owner",
    });

    return typeof payload.username === "string"
      ? { username: payload.username }
      : null;
  } catch {
    return null;
  }
}

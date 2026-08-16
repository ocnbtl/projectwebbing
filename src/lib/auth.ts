import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function passwordMatches(password: string) {
  const expectedPassword = process.env.MADAGIN_INTERNAL_PASSWORD || "";

  return (
    timingSafeEqual(digest(password), digest(expectedPassword)) &&
    expectedPassword.length > 0
  );
}

export async function getInternalSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

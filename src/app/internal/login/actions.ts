"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { credentialsMatch } from "@/lib/auth";
import {
  createSessionToken,
  isInternalAuthConfigured,
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
} from "@/lib/session";

const FAILURE_DELAY_MS = 450;

export async function login(formData: FormData) {
  if (!isInternalAuthConfigured()) {
    redirect("/internal/login?error=unconfigured");
  }

  const username = String(formData.get("username") || "").slice(0, 120);
  const password = String(formData.get("password") || "").slice(0, 512);

  if (!credentialsMatch(username, password)) {
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
    redirect("/internal/login?error=invalid");
  }

  const token = await createSessionToken(username);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });

  redirect("/internal");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/internal/login");
}

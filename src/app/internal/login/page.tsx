import type { Metadata } from "next";
import Link from "next/link";
import { isInternalAuthConfigured } from "@/lib/session";
import { login } from "./actions";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Private workspace",
  robots: { index: false, follow: false, nocache: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = isInternalAuthConfigured();

  return (
    <main className={styles.page}>
      <Link className={styles.publicLink} href="/">
        Public site <span aria-hidden="true">{"\u2197"}</span>
      </Link>

      <section className={styles.login} aria-labelledby="login-title">
        <div className={styles.wordmark}>MADAGIN</div>
        <div>
          <p className={styles.privateLabel}>Private workspace</p>
          <h1 id="login-title">Owner access.</h1>
        </div>

        {configured ? (
          <form action={login} className={styles.form}>
            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                name="password"
                required
                type="password"
              />
            </label>
            {error === "invalid" ? (
              <p className={styles.error} role="alert">
                That password was not recognized.
              </p>
            ) : null}
            <button type="submit">Enter workspace</button>
          </form>
        ) : (
          <div className={styles.configuration} role="status">
            <p>Internal access is not configured yet.</p>
            <p>
              Add <code>MADAGIN_AUTH_SECRET</code> and{" "}
              <code>MADAGIN_INTERNAL_PASSWORD</code> to enable owner access.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

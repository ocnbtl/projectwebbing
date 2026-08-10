import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InternalShell } from "@/components/internal/internal-shell";
import { getInternalSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false, nocache: true },
};

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getInternalSession();
  if (!session) redirect("/internal/login");

  return <InternalShell username={session.username}>{children}</InternalShell>;
}

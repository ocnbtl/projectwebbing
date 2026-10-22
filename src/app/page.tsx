import { PublicHome } from "@/components/public/public-home";
export const dynamic = "force-dynamic";
export default function Home() {
  // Illustrative proof is review material only, never a production claim.
  const previewProof = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview";
  return <PublicHome previewProof={previewProof}/>;
}

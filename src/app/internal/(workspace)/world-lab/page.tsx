import { WorldLabLoader } from "@/components/internal/world-lab-loader";

export default function WorldLabPage() {
  if (process.env.VERCEL === "1") {
    return <section><h1>World lab</h1><p>The archived 3D experiments are available in the local studio. Their source assets are preserved locally and excluded from website deployments.</p></section>;
  }
  return <WorldLabLoader />;
}

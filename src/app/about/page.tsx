import type { Metadata } from "next";
import { AboutPage } from "@/components/public/public-pages";

export const metadata: Metadata = {
  title: "About",
  description: "Madagin is a founder-led web studio for businesses ready to show up differently.",
};

export default function About() {
  return <AboutPage />;
}

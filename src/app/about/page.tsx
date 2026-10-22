import type { Metadata } from "next";
import { AboutPage } from "@/components/public/public-pages";

export const metadata: Metadata = {
  title: "About",
  description: "Madagin is a design and development studio. We work closely with our clients to create brands and websites that reflect who they are and where they want to go.",
};

export default function About() {
  return <AboutPage />;
}

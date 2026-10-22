import type { Metadata } from "next";
import { ContactJourney } from "@/components/public/contact-journey";

export const metadata: Metadata = {
  title: "Let’s talk",
  description: "Tell Madagin about your website, your goals, and the project you have in mind.",
};

export const runtime = "nodejs";

export default function ContactPage() {
  return <ContactJourney preview={process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview"} />;
}

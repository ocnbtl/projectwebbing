import type { Metadata } from "next";
import { ContactJourney } from "@/components/public/contact-journey";

export const metadata: Metadata = {
  title: "Let’s Talk",
  description: "Tell Madagin where things are now and what needs to change.",
};

export const runtime = "nodejs";

export default function ContactPage() {
  return <ContactJourney />;
}

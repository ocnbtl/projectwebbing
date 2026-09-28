import type { Metadata } from "next";
import { ContactJourney } from "@/components/public/contact-journey";

export const metadata: Metadata = {
  title: "Bring an idea",
  description: "Give your next project a little shape. Prepare and keep a private outline with Madagin.",
};

export const runtime = "nodejs";

export default function ContactPage() {
  return <ContactJourney />;
}

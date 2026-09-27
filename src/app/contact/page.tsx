import type { Metadata } from "next";
import { ContactJourney } from "@/components/public/contact-journey";

export const metadata: Metadata = {
  title: "Project brief",
  description: "Six questions to clarify your next website. Prepare and save your project brief on your device.",
};

export const runtime = "nodejs";

export default function ContactPage() {
  return <ContactJourney />;
}

import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, Plaster } from "next/font/google";
import { SiteAnalytics } from "@/components/site-analytics";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const plaster = Plaster({
  variable: "--font-plaster",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://projectwebbing.vercel.app"),
  title: {
    default: "Madagin",
    template: "%s \u00B7 Madagin",
  },
  description: "Madagin creates distinctive websites people remember, trust, and choose.",
  openGraph: {
    type: "website",
    siteName: "Madagin",
    title: "Madagin",
    description: "Distinctive websites people remember, trust, and choose.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Madagin",
    description: "Distinctive websites people remember, trust, and choose.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${instrumentSerif.variable} ${plaster.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}

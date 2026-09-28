import type { Metadata, Viewport } from "next";
import { Manrope, Bodoni_Moda, Bricolage_Grotesque, Gloock } from "next/font/google";
import { SiteAnalytics } from "@/components/site-analytics";
import { PublicWaterProvider } from "@/components/public/water-surface";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "800"],
  display: "swap",
});

const gloock = Gloock({ variable: "--font-gloock", subsets: ["latin"], weight: "400", display: "swap" });

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
  themeColor: "#0f2334",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${bodoni.variable} ${bricolage.variable} ${gloock.variable}`}
      data-scroll-behavior="smooth"
    >
      <body id="top">
        <PublicWaterProvider>{children}</PublicWaterProvider>
        <SiteAnalytics />
      </body>
    </html>
  );
}

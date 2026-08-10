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
  title: {
    default: "Madagin",
    template: "%s \u00B7 Madagin",
  },
  description: "Strategy, design, and development for a distinctive digital presence.",
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

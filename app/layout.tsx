import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SITE_NAME, TAGLINE, siteUrl } from "@/lib/config";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME} — ${TAGLINE}`, template: `%s · The Universe Store` },
  description: "Discover useful products across electronics, home, fashion, beauty and more — with honest notes and clear links to the retailer.",
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, title: `${SITE_NAME} — ${TAGLINE}`, images: [{ url: "/brand/logo-512.png", width: 512, height: 512, alt: "The Universe Store logo" }] },
  twitter: { card: "summary", images: ["/brand/logo-512.png"] },
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#087A45", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}

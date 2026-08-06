import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { PaymentReturnGateway } from "@/components/commerce/payment-return-gateway";
import { ProductNameNormalizer } from "@/components/brand/product-name-normalizer";
import { GlobalScrollStability } from "@/components/layout/global-scroll-stability";
import { MetaPixelTracker } from "@/components/marketing/meta-pixel-tracker";
import { ConsentAnalytics } from "@/components/privacy/consent-analytics";
import { PrivacyConsent } from "@/components/privacy/privacy-consent";
import "./globals.css";
import "./ios-form-controls.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "VISR — Carry Your Build",
    template: "%s — VISR",
  },
  description:
    "Carry Your Build. A magnetic diecast display system created around the collection, not the frame.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "VISR — Carry Your Build",
    description: "Carry Your Build. Designed around the collection, not the frame.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VISR — Carry Your Build",
    description: "Carry Your Build. Designed around the collection, not the frame.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="visr-grain antialiased">
        <GlobalScrollStability />
        {children}
        <ProductNameNormalizer />
        <MetaPixelTracker />
        <PrivacyConsent />
        <Suspense fallback={null}>
          <PaymentReturnGateway />
        </Suspense>
        <ConsentAnalytics />
      </body>
    </html>
  );
}

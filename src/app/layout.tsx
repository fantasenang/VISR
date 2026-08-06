import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { PaymentReturnGateway } from "@/components/commerce/payment-return-gateway";
import { ProductNameNormalizer } from "@/components/brand/product-name-normalizer";
import { MetaPixelTracker } from "@/components/marketing/meta-pixel-tracker";
import { ConsentAnalytics } from "@/components/privacy/consent-analytics";
import { PrivacyConsent } from "@/components/privacy/privacy-consent";
import "./globals.css";
import "./ios-form-controls.css";

const SITE_URL = "https://visr.works";
const SITE_TITLE = "VISR — Carry Your Build";
const SITE_DESCRIPTION =
  "Handmade magnetic display systems for 1:64 diecast collectors. Discover VISR Carry, VISR Link, and the VISR display ecosystem.";
const SHARE_IMAGE = "/media/phase-16/visr-c01.jpg";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "VISR",
      url: SITE_URL,
      description:
        "VISR creates handmade magnetic display systems for 1:64 diecast collectors.",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Bandung",
        addressCountry: "ID",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "VISR",
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-ID",
    },
  ],
};

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
  metadataBase: new URL(SITE_URL),
  applicationName: "VISR",
  title: {
    default: SITE_TITLE,
    template: "%s — VISR",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  keywords: [
    "VISR",
    "VISR Carry",
    "VISR Link",
    "diecast display",
    "1:64 diecast display",
    "magnetic diecast display",
    "display diecast Indonesia",
  ],
  authors: [{ name: "VISR", url: SITE_URL }],
  creator: "VISR",
  publisher: "VISR",
  category: "Diecast display systems",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "VISR",
    locale: "en_ID",
    type: "website",
    images: [
      {
        url: SHARE_IMAGE,
        alt: "VISR Carry magnetic display system for 1:64 diecast",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="visr-grain antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
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

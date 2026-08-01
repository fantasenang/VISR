import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PaymentReturnGateway } from "@/components/commerce/payment-return-gateway";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        {children}
        <Suspense fallback={null}>
          <PaymentReturnGateway />
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

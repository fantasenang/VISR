import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://visr.works/privacy",
  },
  openGraph: {
    url: "https://visr.works/privacy",
  },
};

export default function PrivacyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

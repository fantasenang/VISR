import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "VISR Control",
  description: "Private VISR operations dashboard.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function VisrControlLayout({ children }: { children: ReactNode }) {
  return children;
}

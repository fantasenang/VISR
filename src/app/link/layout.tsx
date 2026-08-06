import type { Metadata } from "next";

const PRODUCT_URL = "https://visr.works/link";
const PRODUCT_IMAGE = "https://visr.works/media/phase-15/visr-e05.jpg";

export const metadata: Metadata = {
  alternates: {
    canonical: PRODUCT_URL,
  },
  openGraph: {
    title: "VISR Link — Magnetic Diecast Display Interface",
    description:
      "Explore VISR Link, the reusable magnetic interface behind the VISR display ecosystem.",
    url: PRODUCT_URL,
    type: "website",
    images: [
      {
        url: PRODUCT_IMAGE,
        alt: "VISR Link magnetic interface displayed on a dark surface",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VISR Link — Magnetic Diecast Display Interface",
    description:
      "The reusable magnetic interface behind the VISR display ecosystem.",
    images: [PRODUCT_IMAGE],
  },
};

const productStructuredData = {
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": `${PRODUCT_URL}/#product`,
  name: "VISR Link",
  description:
    "A reusable magnetic interface connecting 1:64 diecast cars to the VISR display ecosystem.",
  image: [PRODUCT_IMAGE],
  brand: {
    "@type": "Brand",
    name: "VISR",
  },
  sku: "VISR-LINK-ADD",
  offers: {
    "@type": "Offer",
    url: PRODUCT_URL,
    priceCurrency: "IDR",
    price: "19000",
    availability: "https://schema.org/InStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: {
      "@type": "Organization",
      name: "VISR",
      url: "https://visr.works",
    },
  },
};

export default function VisrLinkLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productStructuredData).replace(/</g, "\\u003c"),
        }}
      />
      {children}
    </>
  );
}

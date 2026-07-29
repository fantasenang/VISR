import type { Metadata } from "next";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = {
  title: "Reserve Your VISR — Batch 2",
  description: "Build and review your VISR Batch 2 reservation.",
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}

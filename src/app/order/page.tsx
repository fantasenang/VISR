import { MobileOnlyPage } from "@/components/layout/mobile-only-page";
import { OrderLookupReceiptClient } from "./order-lookup-receipt-client";

export const metadata = {
  title: "Track My VISR",
  description: "Access your VISR order and paid receipt without creating an account.",
};

export default function OrderPage() {
  return (
    <MobileOnlyPage>
      <OrderLookupReceiptClient />
    </MobileOnlyPage>
  );
}

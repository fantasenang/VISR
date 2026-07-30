import { OrderLookupClient } from "./order-lookup-client";

export const metadata = {
  title: "Track My VISR",
  description: "Access your VISR order without creating an account.",
};

export default function OrderPage() {
  return <OrderLookupClient />;
}

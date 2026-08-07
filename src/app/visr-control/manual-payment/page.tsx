import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";
import ManualPaymentClient from "./manual-payment-client";

export const dynamic = "force-dynamic";

export default async function ManualPaymentPage() {
  const session = await getAdminSession();
  if (!session) redirect("/visr-control/login");
  return <ManualPaymentClient />;
}

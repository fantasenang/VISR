import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AnalyticsLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/visr-control");
  return children;
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import dbConnect from "@/lib/db";
import AffiliatesManagerClient from "@/components/admin/AffiliatesManagerClient";
import RequirePermission from "@/components/admin/RequirePermission";

export const metadata = {
  title: "Affiliate Management — Pairo Admin",
  robots: "noindex, nofollow"
};

export default async function AdminAffiliatesPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user?.isStaff) {
    redirect("/login");
  }

  await dbConnect();

  return (
    <RequirePermission permission="affiliates.view">
      <Suspense fallback={<div className="min-h-screen bg-[#f6f7f7]" />}>
        <AffiliatesManagerClient userSession={session} />
      </Suspense>
    </RequirePermission>
  );
}

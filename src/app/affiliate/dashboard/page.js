import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/db";
import AffiliateDashboardClient from "@/components/affiliate/AffiliateDashboardClient";

export const metadata = {
  title: "Affiliate Portal — Pairo Studio",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AffiliateDashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user?.isAffiliate) {
    redirect("/affiliate-login");
  }

  await dbConnect();

  return (
    <div className="bg-[#FAF9F6] min-h-screen text-black">
      <AffiliateDashboardClient userSession={session} />
    </div>
  );
}

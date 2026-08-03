"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/layout/CartDrawer";
import ReferralDiscountPopup from "@/components/common/ReferralDiscountPopup";

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const isIsolatedRoute = pathname?.startsWith("/admin") || pathname?.startsWith("/admin-login") || pathname?.startsWith("/affiliate") || pathname?.startsWith("/profile");

  if (isIsolatedRoute) {
    return (
      <div className="relative w-full overflow-x-clip min-h-screen flex flex-col">
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-x-clip min-h-screen flex flex-col">
      <Navbar />
      <ReferralDiscountPopup />
      <CartDrawer />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
    </div>
  );
}



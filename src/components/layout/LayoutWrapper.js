"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/layout/CartDrawer";
import AffiliateDiscountBanner from "@/components/common/AffiliateDiscountBanner";

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const isIsolatedRoute = pathname?.startsWith("/admin") || pathname?.startsWith("/admin-login") || pathname?.startsWith("/affiliate");

  if (isIsolatedRoute) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Navbar />
      <AffiliateDiscountBanner />
      <CartDrawer />
      <main>{children}</main>
      <Footer />
    </>
  );
}

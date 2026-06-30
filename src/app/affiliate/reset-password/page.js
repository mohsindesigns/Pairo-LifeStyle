import { Suspense } from "react";
import AffiliateResetPasswordClient from "@/components/affiliate/AffiliateResetPasswordClient";

export const metadata = {
  title: "Reset Password — PAIRO Partner Portal",
  description: "Set a new password for your PAIRO affiliate account.",
};

export default function AffiliateResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0a0a" }} />}>
      <AffiliateResetPasswordClient />
    </Suspense>
  );
}

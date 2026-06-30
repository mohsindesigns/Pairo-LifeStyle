import AffiliateLoginClient from "@/components/affiliate/AffiliateLoginClient";

export const metadata = {
  title: "Affiliate Portal Login — Pairo Studio",
  description: "Access your Pairo Lifestyle affiliate account. View your dashboard, clicks, conversion metrics, and payout logs.",
  robots: {
    index: false,
    follow: false
  }
};

export default function AffiliateLoginPage() {
  return (
    <div className="bg-white min-h-screen flex items-center justify-center px-4 py-20 text-black">
      <div className="w-full max-w-md space-y-8 p-8 md:p-10 border border-black/5 bg-white shadow-sm rounded-[32px]">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold text-primary/60 uppercase tracking-[0.3em]">
            Pairo Partners
          </p>
          <h1 className="text-2xl font-medium heading-font tracking-tight text-primary uppercase">
            Affiliate Login
          </h1>
          <p className="text-xs text-primary/60 font-light max-w-xs mx-auto">
            Log in to manage your referrals, download media assets, and check withdrawal history.
          </p>
        </div>

        {/* Form Client */}
        <AffiliateLoginClient />
      </div>
    </div>
  );
}

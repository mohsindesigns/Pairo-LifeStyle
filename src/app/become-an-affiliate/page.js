import dbConnect from "@/lib/db";
import BecomeAffiliateClient from "@/components/affiliate/BecomeAffiliateClient";

export const metadata = {
  title: "Pairo Studio — Become an Affiliate Partner",
  description: "Join the Pairo Lifestyle Affiliate Program. Partner with us, promote premium handcrafted shearling jackets, and earn high commissions.",
  robots: {
    index: true,
    follow: true
  }
};

export default async function BecomeAnAffiliatePage() {
  await dbConnect();
  
  return (
    <div className="bg-white min-h-screen text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* Banner Section */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <p className="text-[10px] md:text-[11px] font-bold text-primary/60 uppercase tracking-[0.3em]">
            Pairo Studio Partner Program
          </p>
          <h1 className="text-4xl md:text-5xl font-medium heading-font tracking-tight text-primary uppercase">
            Become an Affiliate
          </h1>
          <p className="text-sm md:text-base text-primary/70 font-light leading-relaxed">
            Partner with Pairo Lifestyle to share the pinnacle of artisanal outerwear. Promote our signature sheepskin jackets and earn premium commissions on every sale.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          <div className="p-8 border border-black/5 bg-black/[0.01] rounded-[24px] space-y-4 hover:border-black/10 transition-all duration-300">
            <span className="text-[10px] font-mono text-black/40">01 / REVENUE</span>
            <p className="text-lg font-semibold uppercase tracking-wider text-primary">5% Base Commission</p>
            <p className="text-xs text-primary/70 font-light leading-relaxed">
              Earn a solid 5% commission on every delivered order generated through your referral links or unique coupon codes.
            </p>
          </div>
          <div className="p-8 border border-black/5 bg-black/[0.01] rounded-[24px] space-y-4 hover:border-black/10 transition-all duration-300">
            <span className="text-[10px] font-mono text-black/40">02 / TRACKING</span>
            <p className="text-lg font-semibold uppercase tracking-wider text-primary">30-Day Cookie Window</p>
            <p className="text-xs text-primary/70 font-light leading-relaxed">
              Our advanced tracking cookies log traffic and conversions for 30 full days, automatically refreshing on repeat visits.
            </p>
          </div>
          <div className="p-8 border border-black/5 bg-black/[0.01] rounded-[24px] space-y-4 hover:border-black/10 transition-all duration-300">
            <span className="text-[10px] font-mono text-black/40">03 / COLLATERAL</span>
            <p className="text-lg font-semibold uppercase tracking-wider text-primary">Creative Assets & Support</p>
            <p className="text-xs text-primary/70 font-light leading-relaxed">
              Access clean high-res logos, editorial product photography, banners, and a dedicated partner support email.
            </p>
          </div>
        </div>

        {/* Form & Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          {/* FAQ and Info Panel */}
          <div className="lg:col-span-4 space-y-10">
            <div className="space-y-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/70">Program Details</p>
              <div className="space-y-4 text-xs text-primary/80 font-light leading-relaxed">
                <p>
                  <strong>How do I get paid?</strong><br/>
                  We process payouts via direct Bank Transfer (IBAN/Swift) or PayPal once your approved earnings reach the $50 minimum threshold.
                </p>
                <p>
                  <strong>When are commissions approved?</strong><br/>
                  Commissions are registered as Pending immediately upon order placement, and transition to Approved once the package is marked as Delivered.
                </p>
                <p>
                  <strong>Is identity check required?</strong><br/>
                  Yes, to protect against fraud, we require a clear photocopy upload of your passport, national ID card, or driver's license during registration.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Multi-step Form */}
          <div className="lg:col-span-8 border border-black/5 rounded-[32px] p-6 md:p-10 bg-white shadow-sm">
            <BecomeAffiliateClient />
          </div>
        </div>
      </div>
    </div>
  );
}

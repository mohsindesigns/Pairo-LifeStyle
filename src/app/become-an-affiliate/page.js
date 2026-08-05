import dbConnect from "@/lib/db";
import BecomeAffiliateClient from "@/components/affiliate/BecomeAffiliateClient";
import Link from "next/link";
import { Shield, Target, Award, ArrowLeft, ArrowUpRight } from "lucide-react";

export const metadata = {
  title: "Pairo Studio — Become an Affiliate Partner",
  description: "Join the Pairo Lifestyle Affiliate Program. Partner with us, promote premium handcrafted shearling jackets, and earn high commissions.",
  robots: "index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1"
};

export default async function BecomeAnAffiliatePage() {
  await dbConnect();
  
  return (
    <div className="bg-[#FAF9F6] min-h-screen text-black font-sans py-16">
      <div className="max-w-6xl mx-auto px-4">
        {/* Top Navigation */}
        <div className="flex justify-between items-center mb-16">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Store
          </Link>
          <Link href="/affiliate-login" className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors">
            Partner Login
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Banner Section */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <p className="text-[10px] md:text-[11px] font-bold text-neutral-400 uppercase tracking-[0.3em]">
            Pairo Studio
          </p>
          <h1 className="text-3xl md:text-4xl font-normal tracking-tight text-black">
            Become an Affiliate
          </h1>
          <p className="text-xs md:text-sm text-neutral-500 font-light leading-relaxed max-w-lg mx-auto">
            Partner with Pairo Lifestyle to share the pinnacle of artisanal shearling outerwear. Promote our hand-stitched jackets and earn premium commissions on every acquisition.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <div className="p-8 border border-neutral-200 bg-white rounded-[3px] space-y-4 hover:border-black transition-colors duration-300 shadow-sm">
            <span className="text-[9px] font-mono font-bold text-neutral-400 flex items-center gap-1.5 uppercase">
              <Shield className="w-3.5 h-3.5" /> 01 / Compensation
            </span>
            <p className="text-md font-bold uppercase tracking-wider text-black">Competitive Commission</p>
            <p className="text-xs text-neutral-500 font-light leading-relaxed">
              Earn attractive percentage or fixed commissions on every delivered checkout generated through your custom links.
            </p>
          </div>
          <div className="p-8 border border-neutral-200 bg-white rounded-[3px] space-y-4 hover:border-black transition-colors duration-300 shadow-sm">
            <span className="text-[9px] font-mono font-bold text-neutral-400 flex items-center gap-1.5 uppercase">
              <Target className="w-3.5 h-3.5" /> 02 / Tracking
            </span>
            <p className="text-md font-bold uppercase tracking-wider text-black">30-Day Cookie Window</p>
            <p className="text-xs text-neutral-500 font-light leading-relaxed">
              Our secure tracking cookies log customer clicks and conversions for 30 full days, automatic-attributing your codes.
            </p>
          </div>
          <div className="p-8 border border-neutral-200 bg-white rounded-[3px] space-y-4 hover:border-black transition-colors duration-300 shadow-sm">
            <span className="text-[9px] font-mono font-bold text-neutral-400 flex items-center gap-1.5 uppercase">
              <Award className="w-3.5 h-3.5" /> 03 / Assets
            </span>
            <p className="text-md font-bold uppercase tracking-wider text-black">Premium Media Assets</p>
            <p className="text-xs text-neutral-500 font-light leading-relaxed">
              Access high-resolution branding assets, product catalog imagery, seasonal banners, and priority email support.
            </p>
          </div>
        </div>

        {/* Form & Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* FAQ Panel */}
          <div className="lg:col-span-4 space-y-8 bg-white border border-neutral-200 p-8 rounded-[3px] shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">Program Guidelines</p>
            <div className="space-y-6 text-xs text-neutral-500 font-light leading-relaxed">
              <div>
                <strong className="text-black font-semibold block mb-1">How are payouts processed?</strong>
                We clear verified balances via bank routing transfer (IBAN/Swift) or PayPal once earnings meet the $50 minimum threshold.
              </div>
              <div>
                <strong className="text-black font-semibold block mb-1">When are commissions approved?</strong>
                Commissions credit as Pending instantly, and finalize to Approved following order shipment delivery verification.
              </div>
              <div>
                <strong className="text-black font-semibold block mb-1">Is identity check required?</strong>
                Yes, to comply with tax and AML policies, we verify signups using government-issued photo ID uploads.
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="lg:col-span-8 border border-neutral-200 rounded-[3px] p-6 md:p-10 bg-white shadow-sm">
            <BecomeAffiliateClient />
          </div>
        </div>
      </div>
    </div>
  );
}

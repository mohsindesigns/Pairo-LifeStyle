"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Tag } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function PromoLinkPage() {
  const { code } = useParams();
  const router = useRouter();
  const { applyPromoCode, setPendingPromoCode, isCartLoaded } = useCart();
  const [status, setStatus] = useState("applying"); // applying | applied | pending

  useEffect(() => {
    if (!isCartLoaded || !code) return;

    const normalizedCode = decodeURIComponent(code).toUpperCase().trim();
    setPendingPromoCode(normalizedCode);

    let cancelled = false;
    (async () => {
      const result = await applyPromoCode(normalizedCode);
      if (cancelled) return;
      setStatus(result.success ? "applied" : "pending");
      setTimeout(() => {
        if (!cancelled) router.push("/shop");
      }, 1400);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCartLoaded, code]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center">
        {status === "applied" ? <CheckCircle2 className="w-6 h-6" /> : <Tag className="w-6 h-6" />}
      </div>
      <div>
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-black">
          {status === "applied" ? "Discount Applied" : "Saving Your Discount"}
        </p>
        <p className="text-[13px] text-black/60 mt-1.5">
          {status === "applied"
            ? "Taking you to the shop — your discount is ready at checkout."
            : "Add items to your bag and this code will apply automatically once eligible."}
        </p>
      </div>
    </div>
  );
}

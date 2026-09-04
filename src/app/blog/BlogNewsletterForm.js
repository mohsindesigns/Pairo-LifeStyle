"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

export default function BlogNewsletterForm({ dark = false }) {
  const [email, setEmail] = useState("");
  const [hpField, setHpField] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;

    if (hpField) {
      toast.success("You're on the list!");
      setEmail("");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          hp_field: hpField,
          sourcePage: "/blog"
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "You're on the list!");
        setEmail("");
      } else {
        toast.error(data.error || "Something went wrong.");
      }
    } catch {
      toast.error("Failed to subscribe. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubscribe} className="flex flex-col md:flex-row gap-3 justify-center w-full max-w-md mx-auto">
       <input
          type="email"
          required
          placeholder="ENTER YOUR EMAIL"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          className={`border px-5 py-3.5 rounded-[4px] w-full text-[10px] font-bold tracking-widest focus:outline-none transition-colors disabled:opacity-50 uppercase ${
            dark
              ? "bg-white/5 border-white/15 text-white placeholder-white/40 focus:border-white/50"
              : "bg-white border-black/15 text-black placeholder-black/30 focus:border-black"
          }`}
       />
       <input
          type="text"
          className="hidden"
          value={hpField}
          onChange={(e) => setHpField(e.target.value)}
          tabIndex="-1"
          autoComplete="off"
       />
       <button
          type="submit"
          disabled={submitting}
          className={`px-8 py-3.5 rounded-[4px] font-black text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer ${
            dark
              ? "bg-white text-black hover:bg-neutral-100"
              : "bg-black text-white hover:bg-neutral-900"
          }`}
       >
          {submitting ? "Joining..." : "Join Archive"}
       </button>
    </form>
  );
}

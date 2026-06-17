"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

export default function BlogNewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
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
    <form onSubmit={handleSubscribe} className="flex flex-col md:flex-row gap-4 justify-center">
       <input 
          type="email" 
          required
          placeholder="ENTER YOUR EMAIL" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          className="bg-background border border-foreground/15 text-foreground px-8 py-4 rounded-full w-full md:w-96 text-xs font-bold tracking-widest focus:outline-none focus:border-foreground transition-colors placeholder-foreground/40 disabled:opacity-50"
       />
       <button 
          type="submit"
          disabled={submitting}
          className="bg-foreground text-background px-10 py-4 rounded-full font-bold text-xs uppercase tracking-[0.2em] hover:bg-foreground/90 transition-all disabled:opacity-50"
       >
          {submitting ? "Joining..." : "Join Archive"}
       </button>
    </form>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { RefreshCw } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

const STATUS_STYLES = {
  "Awaiting Reply": "bg-[#f0f0f1] text-[#50575e]",
  Replied: "bg-[#fcf0c3] text-[#7a5d00]",
  Confirmed: "bg-[#d5f0dc] text-[#007017]",
};

const FILTERS = ["All", "Replied", "Awaiting Reply", "Confirmed"];

export default function SizeConfirmationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState("All");
  const [inboxConfigured, setInboxConfigured] = useState(true);

  const load = useCallback(async () => {
    try {
      const qs = filter === "All" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/admin/size-confirmations${qs}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.confirmations || []);
        setInboxConfigured(data.inboxConfigured !== false);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const checkReplies = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/size-confirmations/sync?force=1", { method: "POST" });
      const data = await res.json();
      if (data.configured === false) toast.error("Reply inbox not connected — set IMAP_HOST in the server environment.");
      else if (data.error) toast.error(`Could not check inbox: ${data.error}`);
      else toast.success(data.newReplies ? `${data.newReplies} new repl${data.newReplies === 1 ? "y" : "ies"}` : "No new replies");
      await load();
    } finally {
      setChecking(false);
    }
  };

  return (
    <AdminPageLayout
      title="Size Confirmations"
      subtitle="Emails sent to customers to confirm jacket sizes, and their replies"
      breadcrumbs={[{ label: "Size Confirmations" }]}
    >
      <div className="bg-white border border-[#ccd0d4] shadow-sm">
        <div className="px-3 py-2 border-b border-[#ccd0d4] bg-[#f6f7f7] flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 text-[12px]">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`font-semibold pb-0.5 border-b-2 cursor-pointer ${
                  filter === f ? "text-[#1d2327] border-[#2271b1]" : "text-[#646970] border-transparent hover:text-[#1d2327]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={checkReplies}
            disabled={checking}
            className="ml-auto flex items-center gap-1.5 text-[12px] text-[#2271b1] hover:text-[#135e96] font-semibold disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} /> Check for replies
          </button>
        </div>

        {!inboxConfigured && (
          <p className="text-[12px] text-[#7a5d00] bg-[#fcf0c3] px-3 py-2">
            Replies can&apos;t be picked up yet — add <code>IMAP_HOST</code> (plus <code>IMAP_USER</code> / <code>IMAP_PASS</code>) to the server environment.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#f6f7f7] text-[11px] uppercase text-[#646970]">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Sent</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Latest reply</th>
                <th className="px-3 py-2">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[#646970]">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[#646970]">Nothing here yet. Send a size confirmation from an order page.</td></tr>
              ) : (
                items.map((c) => {
                  const last = c.replies?.[c.replies.length - 1];
                  return (
                    <tr key={c._id} className={c.unreadReplies > 0 ? "bg-[#f0f6fc]" : ""}>
                      <td className="px-3 py-2">
                        <Link href={`/admin/orders/${c.orderId}`} className="text-[#2271b1] hover:underline font-semibold">
                          #{c.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-[#1d2327]">{c.customerName || "—"}</div>
                        <div className="text-[11px] text-[#646970]">{c.customerEmail}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-[#50575e]">{new Date(c.sentAt).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[2px] ${STATUS_STYLES[c.status] || ""}`}>
                          {c.status}
                        </span>
                        {c.unreadReplies > 0 && (
                          <span className="ml-1.5 bg-[#d63638] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                            {c.unreadReplies} new
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[320px]">
                        {last ? <span className="line-clamp-2 text-[#2c3338]">{last.text}</span> : <span className="text-[#a7aaad]">—</span>}
                      </td>
                      <td className="px-3 py-2 font-semibold">{c.confirmedSize || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageLayout>
  );
}

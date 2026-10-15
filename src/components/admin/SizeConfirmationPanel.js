"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { Ruler, Send, MessageSquareReply, CheckCircle2, RefreshCw } from "lucide-react";

const STATUS_STYLES = {
  "Awaiting Reply": "bg-[#f0f0f1] text-[#50575e]",
  Replied: "bg-[#fcf0c3] text-[#7a5d00]",
  Confirmed: "bg-[#d5f0dc] text-[#007017]",
};

/**
 * Order-page panel: send the size confirmation email, see the customer's
 * replies, and record the confirmed size.
 */
export default function SizeConfirmationPanel({ orderId, customerEmail }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [chartUrl, setChartUrl] = useState("");
  const [sizeInputs, setSizeInputs] = useState({});
  const [inboxConfigured, setInboxConfigured] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/size-confirmations?orderId=${orderId}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.confirmations || []);
        setInboxConfigured(data.inboxConfigured !== false);
        const last = (data.confirmations || []).find((c) => c.sizeChartImageUrl);
        setChartUrl((prev) => prev || last?.sizeChartImageUrl || "");
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!customerEmail) return toast.error("This order has no customer email.");
    setSending(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/size-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sizeChartImageUrl: chartUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast.success(`Size confirmation emailed to ${customerEmail}`);
      await load();
    } catch (err) {
      toast.error(err.message || "Failed to send size confirmation");
    } finally {
      setSending(false);
    }
  };

  const checkReplies = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/size-confirmations/sync?force=1", { method: "POST" });
      const data = await res.json();
      if (data.configured === false) {
        toast.error("Reply inbox not connected — set IMAP_HOST in the server environment.");
      } else if (data.error) {
        toast.error(`Could not check inbox: ${data.error}`);
      } else {
        toast.success(data.newReplies ? `${data.newReplies} new repl${data.newReplies === 1 ? "y" : "ies"}` : "No new replies");
      }
      await load();
    } finally {
      setChecking(false);
    }
  };

  const patch = async (id, payload, okMsg) => {
    const res = await fetch(`/api/admin/size-confirmations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || "Update failed");
    if (okMsg) toast.success(okMsg);
    await load();
  };

  return (
    <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-[2px]">
      <div className="px-4 py-3 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center gap-2">
        <Ruler className="w-3.5 h-3.5 text-[#2271b1]" />
        <h3 className="text-[13px] font-bold text-[#1d2327] flex-1">Size Confirmation</h3>
        <button
          type="button"
          onClick={checkReplies}
          disabled={checking}
          title="Check the inbox for new replies"
          className="text-[#2271b1] hover:text-[#135e96] disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#3c434a] mb-1">Size chart image URL (optional)</label>
          <input
            type="url"
            value={chartUrl}
            onChange={(e) => setChartUrl(e.target.value)}
            placeholder="https://… (shown in the email)"
            className="w-full border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[12px] outline-none focus:border-[#2271b1]"
          />
        </div>

        <button
          type="button"
          onClick={send}
          disabled={sending || !customerEmail}
          className="w-full flex items-center justify-center gap-1.5 bg-[#1a1a1a] text-white py-2 rounded-[3px] font-bold text-xs uppercase hover:bg-black transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          {sending ? "Sending..." : items.length ? "Send Again" : "Send Size Confirmation"}
        </button>
        <p className="text-[11px] text-[#646970] text-center">
          Emails {customerEmail || "the customer"} and tracks their reply here.
        </p>

        {!inboxConfigured && (
          <p className="text-[11px] text-[#7a5d00] bg-[#fcf0c3] rounded-[3px] px-2 py-1.5">
            Replies can&apos;t be picked up yet — add <code>IMAP_HOST</code> (and mailbox login) to the server environment.
          </p>
        )}

        {loading ? (
          <p className="text-[11px] text-[#646970] text-center">Loading…</p>
        ) : (
          items.map((c) => (
            <div key={c._id} className="border border-[#dcdcde] rounded-[3px]">
              <div className="px-3 py-2 bg-[#f6f7f7] flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#50575e]">
                  Sent {new Date(c.sentAt).toLocaleString()}
                </span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[2px] ${STATUS_STYLES[c.status] || ""}`}>
                  {c.status}
                </span>
              </div>

              {c.replies?.map((r) => (
                <div key={r._id} className={`px-3 py-2 border-t border-[#f0f0f1] ${r.read ? "" : "bg-[#f0f6fc]"}`}>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#50575e] mb-1">
                    <MessageSquareReply className="w-3 h-3" />
                    <span className="font-semibold">{r.fromName || r.fromEmail}</span>
                    <span>· {new Date(r.receivedAt).toLocaleString()}</span>
                  </div>
                  <p className="text-[12px] text-[#1d2327] whitespace-pre-wrap break-words">{r.text}</p>
                </div>
              ))}

              {c.status === "Confirmed" ? (
                <div className="px-3 py-2 border-t border-[#f0f0f1] flex items-center gap-1.5 text-[12px] text-[#007017] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed size: {c.confirmedSize}
                </div>
              ) : (
                c.replies?.length > 0 && (
                  <div className="px-3 py-2 border-t border-[#f0f0f1] space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={sizeInputs[c._id] || ""}
                        onChange={(e) => setSizeInputs((s) => ({ ...s, [c._id]: e.target.value }))}
                        placeholder="Confirmed size (e.g. Medium)"
                        className="flex-1 min-w-0 border border-[#8c8f94] rounded-[3px] px-2 py-1 text-[12px] outline-none focus:border-[#2271b1]"
                      />
                      <button
                        type="button"
                        onClick={() => patch(c._id, { action: "confirm", size: sizeInputs[c._id] }, "Size confirmed")}
                        className="bg-[#2271b1] hover:bg-[#135e96] text-white text-[11px] font-bold px-2.5 rounded-[3px] cursor-pointer"
                      >
                        Confirm
                      </button>
                    </div>
                    {c.unreadReplies > 0 && (
                      <button
                        type="button"
                        onClick={() => patch(c._id, { action: "markRead" })}
                        className="text-[11px] text-[#2271b1] hover:underline cursor-pointer"
                      >
                        Mark replies as read
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

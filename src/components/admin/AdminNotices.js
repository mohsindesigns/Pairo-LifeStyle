"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, Check, AlertTriangle, ShieldCheck, CheckCheck } from "lucide-react";
import { toast } from "react-hot-toast";

export default function AdminNotices() {
  const [notices, setNotices] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [dismissedIds, setDismissedIds] = useState([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("admin_read_notifications");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setDismissedIds(parsed);
        }
      } catch (err) {
        console.error("Failed to load read notifications", err);
      }
    }
  }, []);

  // Fetch notices safely
  const fetchNotices = useCallback(async () => {
    try {
      const [ordersRes, affiliatesRes, productsRes] = await Promise.all([
        fetch("/api/admin/orders?status=Pending").then(r => r.json().catch(() => ({}))),
        fetch("/api/admin/affiliates/requests").then(r => r.json().catch(() => ({}))),
        fetch("/api/admin/products").then(r => r.json().catch(() => ([])))
      ]);

      let list = [];

      // 1. Order notices
      if (ordersRes?.success && Array.isArray(ordersRes.orders)) {
        ordersRes.orders.forEach(order => {
          list.push({
            id: `order-${order._id}`,
            type: "warning", // yellow border
            label: "Pending Order",
            text: `Order #${order.orderNumber} is pending confirmation from ${order.shippingAddress?.fullName || order.customer?.email || "Guest"} (Total: $${order.financials?.total || 0}).`,
            actions: [
              { label: "Confirm Order", action: () => handleOrderAction(order._id, "Confirmed") },
              { label: "View Details", href: `/admin/orders/${order._id}` }
            ]
          });
        });
      }

      // 2. Affiliate notices
      if (affiliatesRes?.success && Array.isArray(affiliatesRes.applications)) {
        affiliatesRes.applications.filter(app => app.status === "Pending").forEach(app => {
          list.push({
            id: `affiliate-${app._id}`,
            type: "info", // blue border
            label: "Affiliate Request",
            text: `New application from ${app.name} (${app.email}) is pending review.`,
            actions: [
              { label: "Approve Application", action: () => handleAffiliateAction(app._id, "Approve") },
              { label: "Reject", action: () => handleAffiliateAction(app._id, "Reject") }
            ]
          });
        });
      }

      // 3. Stock notices
      const prodList = Array.isArray(productsRes) ? productsRes : [];
      prodList.filter(p => p.manageStock && p.stock <= (p.lowStockThreshold || 5)).forEach(p => {
        list.push({
          id: `product-${p._id}`,
          type: "error", // red border
          label: "Low Stock Alert",
          text: `Product '${p.name}' is running low in stock (${p.stock} units remaining).`,
          actions: [
            { label: "Update Stock / Edit", href: `/admin/products/${p._id}?focus=stock` }
          ]
        });
      });

      setNotices(list);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
    const interval = setInterval(fetchNotices, 35000);
    return () => clearInterval(interval);
  }, [fetchNotices]);

  const handleOrderAction = async (id, status) => {
    setUpdatingId(`order-${id}`);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Order status updated to ${status}!`);
        await fetchNotices();
      } else {
        toast.error("Failed to update order.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAffiliateAction = async (applicationId, action) => {
    setUpdatingId(`affiliate-${applicationId}`);
    try {
      const res = await fetch("/api/admin/affiliates/requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, action })
      });
      if (res.ok) {
        toast.success(`Affiliate application ${action === 'Approve' ? 'approved' : 'rejected'} successfully!`);
        await fetchNotices();
      } else {
        const data = await res.json();
        toast.error(`Failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const saveDismissedIds = (newIds) => {
    setDismissedIds(newIds);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("admin_read_notifications", JSON.stringify(newIds.slice(-200)));
      } catch (err) {
        console.error("Failed to save read notification states", err);
      }
    }
  };

  const dismissNotice = (id) => {
    if (dismissedIds.includes(id)) return;
    const updated = [...dismissedIds, id];
    saveDismissedIds(updated);
  };

  const markAllAsRead = () => {
    if (notices.length === 0) return;
    const allIds = notices.map(n => n.id);
    const updated = Array.from(new Set([...dismissedIds, ...allIds]));
    saveDismissedIds(updated);
    toast.success("All notices marked as read");
  };

  const visibleNotices = notices.filter(n => !dismissedIds.includes(n.id));

  if (visibleNotices.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 pr-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={markAllAsRead}
          className="text-[12px] text-[#2271b1] hover:text-[#135e96] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          Mark all as read
        </button>
      </div>
      {visibleNotices.map((notice) => {
        let borderClass = "border-l-[#72aee6]"; // info / blue
        if (notice.type === "warning") borderClass = "border-l-[#dba617]"; // warning / orange
        if (notice.type === "error") borderClass = "border-l-[#d63638]"; // error / red

        const isUpdating = updatingId === notice.id;

        return (
          <div
            key={notice.id}
            className={`bg-white border border-[#c3c4c7] border-l-4 ${borderClass} shadow-sm px-4 py-3 text-[13px] relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left`}
          >
            <div>
              <span className="font-bold text-[#1d2327] mr-1.5">{notice.label}:</span>
              <span className="text-[#2c3338]">{notice.text}</span>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto pr-6">
              {notice.actions.map((act, i) => {
                if (act.href) {
                  return (
                    <Link
                      key={i}
                      href={act.href}
                      className="text-[#2271b1] hover:text-[#135e96] underline font-semibold transition-colors"
                    >
                      {act.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={i}
                    disabled={isUpdating}
                    onClick={act.action}
                    className="text-[#2271b1] hover:text-[#135e96] underline font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isUpdating ? "Processing..." : act.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => dismissNotice(notice.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#8c8f94] hover:text-[#d63638] rounded-full transition-colors cursor-pointer"
              title="Dismiss this notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

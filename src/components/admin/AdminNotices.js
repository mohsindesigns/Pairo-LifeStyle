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
    <div className="mb-4">
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={markAllAsRead}
          className="wp-link inline-flex items-center gap-1 min-h-10 sm:min-h-0 bg-transparent border-0 p-0 text-[13px] cursor-pointer"
        >
          <CheckCheck className="w-4 h-4" aria-hidden="true" />
          Mark all as read
        </button>
      </div>
      {visibleNotices.map((notice) => {
        let typeClass = "wp-notice-info"; // info / blue
        if (notice.type === "warning") typeClass = "wp-notice-warning"; // warning / yellow
        if (notice.type === "error") typeClass = "wp-notice-error"; // error / red

        const isUpdating = updatingId === notice.id;

        return (
          <div
            key={notice.id}
            className={`wp-notice ${typeClass} flex-wrap sm:flex-nowrap`}
            role={notice.type === "error" ? "alert" : "status"}
          >
            <p className="min-w-0 basis-[calc(100%-40px)] sm:basis-auto">
              <strong className="text-[#1d2327]">{notice.label}:</strong> {notice.text}
              {notice.actions.length > 0 && (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  {notice.actions.map((act, i) => {
                    if (act.href) {
                      return (
                        <Link key={i} href={act.href} className="wp-link">
                          {act.label}
                        </Link>
                      );
                    }
                    return (
                      <button
                        key={i}
                        disabled={isUpdating}
                        onClick={act.action}
                        className="wp-btn"
                      >
                        {isUpdating ? "Processing..." : act.label}
                      </button>
                    );
                  })}
                </span>
              )}
            </p>

            <button
              type="button"
              onClick={() => dismissNotice(notice.id)}
              className="wp-notice-dismiss self-start min-w-10 min-h-10 sm:min-w-0 sm:min-h-0 items-center justify-center"
              aria-label="Dismiss this notice"
              title="Dismiss this notice"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

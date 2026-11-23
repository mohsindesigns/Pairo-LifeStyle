"use client";

// Shared building blocks for admin screens. Styles live in src/app/admin/admin-ui.css.

import { X } from "lucide-react";

export function Page({ children }) {
  return <div className="wp-page">{children}</div>;
}

export function PageHeader({ title, actions, aside }) {
  return (
    <div className="wp-page-head">
      <h1>{title}</h1>
      {actions}
      {aside && (
        <>
          <span className="wp-spacer" />
          {aside}
        </>
      )}
    </div>
  );
}

export function Postbox({ title, aside, footer, flush = false, children, id }) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className="wp-postbox" aria-labelledby={headingId}>
      {title && (
        <div className="wp-postbox-head">
          <h2 id={headingId}>{title}</h2>
          {aside && <span className="wp-postbox-aside">{aside}</span>}
        </div>
      )}
      <div className={flush ? undefined : "wp-inside"}>{children}</div>
      {footer && <div className="wp-box-foot">{footer}</div>}
    </section>
  );
}

export function Notice({ type = "success", children, onDismiss }) {
  return (
    <div className={`wp-notice wp-notice-${type}`} role={type === "error" ? "alert" : "status"}>
      <p>{children}</p>
      {onDismiss && (
        <button type="button" className="wp-notice-dismiss" aria-label="Dismiss this notice" onClick={onDismiss}>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

const STATUS_CLASS = {
  Pending: "wp-st-pending",
  Confirmed: "wp-st-confirmed",
  Processing: "wp-st-processing",
  Packed: "wp-st-packed",
  Shipped: "wp-st-shipped",
  "Out for Delivery": "wp-st-out",
  Delivered: "wp-st-delivered",
  Cancelled: "wp-st-cancelled",
  Refunded: "wp-st-refunded",
};

export const ORDER_STATUSES = Object.keys(STATUS_CLASS);

export function StatusPill({ status, small = false }) {
  return (
    <span className={`wp-pill ${small ? "wp-pill-sm" : ""} ${STATUS_CLASS[status] || ""}`}>{status}</span>
  );
}

export function formatMoney(amount, currency = "USD", { decimals = 2 } = {}) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount || 0);
  } catch {
    return `$${Number(amount || 0).toFixed(decimals)}`;
  }
}

export function formatDate(value, opts = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d) ? "" : d.toLocaleDateString("en-US", opts);
}

/** "2 hours ago", "Yesterday", or a date for anything older than a week. */
export function timeAgo(value, now = Date.now()) {
  const d = new Date(value);
  if (isNaN(d)) return "";
  const mins = Math.round((now - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(d);
}

export function Skeleton({ height = 16, width = "100%", style }) {
  return <div className="wp-skeleton" aria-hidden="true" style={{ height, width, ...style }} />;
}

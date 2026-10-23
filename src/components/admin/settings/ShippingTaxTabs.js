"use client";

import Link from "next/link";

// Settings › Shipping zones | Pickup locations | Tax — one copy shared by the three screens.
const TABS = [
  ["shipping", "/admin/settings/shipping", "Shipping zones"],
  ["pickup-locations", "/admin/settings/shipping/pickup-locations", "Pickup locations"],
  ["tax", "/admin/settings/tax", "Tax"],
];

export default function ShippingTaxTabs({ activeTab }) {
  return (
    <nav className="wp-tabs" aria-label="Shipping and tax settings">
      {TABS.map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          className={`wp-tab ${activeTab === key ? "is-current" : ""}`}
          aria-current={activeTab === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

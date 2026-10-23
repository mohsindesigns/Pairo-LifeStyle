"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Tag,
  Users,
  BarChart2,
  Megaphone,
  Link2,
  FileText,
  PenLine,
  Image as ImageIcon,
  Paintbrush,
  ShieldCheck,
  SlidersHorizontal,
  LogOut,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { can } from "@/lib/rbac";
import { visibleModules as visibleTrashModules } from "@/app/admin/trash/trashModules";

// WordPress-style admin menu (matches the approved mockup): flat top-level items, the current
// one highlighted with its submenu open underneath, other items show their submenu as a flyout
// on hover (desktop) or open in place when tapped (mobile drawer).
//
// Each menu: { id, title, icon, href?, perm?, items?, sepBefore?, badge? }.
// Each item: { href, label, perm?, also?: [extra path prefixes it owns] }.
// `perm` is a "module.action" key (or array: any one). The active item is the one whose href
// (or `also` prefix) is the LONGEST match for the current path.
export const MENUS = [
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard, items: [
    { href: "/admin", label: "Home", exact: true },
  ] },
  { id: "orders", title: "Orders", icon: ShoppingCart, perm: "orders.view", badge: "pendingOrders", items: [
    { href: "/admin/orders", label: "All Orders" },
    { href: "/admin/orders/new", label: "Add New", perm: "orders.create" },
    { href: "/admin/custom-jacket-orders", label: "Custom Orders" },
    { href: "/admin/abandoned-carts", label: "Abandoned Carts" },
    { href: "/admin/size-confirmations", label: "Size Confirmations" },
  ] },
  { id: "products", title: "Products", icon: Tag, perm: "products.view", items: [
    { href: "/admin/products", label: "All Products", also: ["/admin/product"] },
    { href: "/admin/products/new", label: "Add New", perm: "products.create" },
    { href: "/admin/categories", label: "Categories", also: ["/admin/category", "/admin/products/categories"] },
    { href: "/admin/products/size-charts", label: "Size Charts" },
    { href: "/admin/size-chart-items", label: "Size Chart Items", perm: "products.edit" },
    { href: "/admin/reviews", label: "Reviews", perm: "reviews.view" },
    { href: "/admin/product-questions", label: "Questions" },
    { href: "/admin/product-process", label: "Product Process" },
    { href: "/admin/settings/filters", label: "Shop Filters" },
  ] },
  { id: "customers", title: "Customers", icon: Users, items: [
    { href: "/admin/customers", label: "All Customers", perm: "customers.view" },
    { href: "/admin/customers/new", label: "Add New", perm: "customers.edit" },
    { href: "/admin/custom-jacket-inquiries", label: "Custom Inquiries", perm: "submissions.view" },
    { href: "/admin/corporate-gifting-inquiries", label: "Gifting Inquiries", perm: "submissions.view" },
    { href: "/admin/contact", label: "Contact Forms", perm: "submissions.view" },
  ] },
  { id: "analytics", title: "Analytics", icon: BarChart2, perm: "analytics.view", items: [
    { href: "/admin/analytics", label: "Store Analytics" },
    { href: "/admin/site-analytics", label: "Visitor Analytics" },
  ] },
  { id: "marketing", title: "Marketing", icon: Megaphone, perm: "promotions.view", items: [
    { href: "/admin/discounts", label: "Coupons" },
    { href: "/admin/promotions", label: "Promotions & BOGO" },
  ] },
  { id: "affiliates", title: "Affiliates", icon: Link2, perm: "affiliates.view", affiliates: true },
  { id: "pages", title: "Pages", icon: FileText, perm: "pages.view", sepBefore: true, items: [
    { href: "/admin/pages", label: "All Pages", also: ["/admin/page"] },
    { href: "/admin/pages/new", label: "Add New", perm: "pages.create" },
    { href: "/admin/gallery-items", label: "Gallery Items", perm: "pages.edit" },
  ] },
  { id: "blog", title: "Blog", icon: PenLine, perm: "blogs.view", items: [
    { href: "/admin/blogs", label: "All Posts", also: ["/admin/blog"] },
    { href: "/admin/blogs/new", label: "Add New", perm: "blogs.create" },
    { href: "/admin/blogs/categories", label: "Categories" },
  ] },
  { id: "media", title: "Media", icon: ImageIcon, perm: "media.manage", items: [
    { href: "/admin/media", label: "Library" },
  ] },
  { id: "appearance", title: "Appearance", icon: Paintbrush, perm: "settings.view", items: [
    { href: "/admin/appearance", label: "Themes" },
  ] },
  { id: "team", title: "Team & Roles", icon: ShieldCheck, sepBefore: true, items: [
    { href: "/admin/settings/team", label: "All Users", perm: ["staff.view", "staff.manage_roles"], also: ["/admin/team", "/admin/users"] },
    { href: "/admin/settings/team/new", label: "Add New", perm: "staff.create", also: ["/admin/team/new", "/admin/users/new"] },
    { href: "/admin/settings/roles", label: "Roles", perm: ["staff.view", "staff.manage_roles"], also: ["/admin/roles"] },
  ] },
  { id: "settings", title: "Settings", icon: SlidersHorizontal, items: [
    { href: "/admin/settings/site", label: "General", perm: "settings.view" },
    { href: "/admin/settings/shipping", label: "Shipping", perm: "settings.view", also: ["/admin/settings/shipping/pickup-locations"] },
    { href: "/admin/settings/tax", label: "Tax", perm: "settings.view" },
    { href: "/admin/settings/scripts", label: "Custom Scripts", perm: "scripts.view" },
    { href: "/admin/settings/logs", label: "Audit Log", perm: "settings.view" },
    { href: "/admin/trash", label: "Trash", perm: "__trash" },
  ] },
];

const AFFILIATE_VIEWS = [
  ["overview", "Overview"],
  ["requests", "Applications"],
  ["list", "All Affiliates"],
  ["links", "Referral Links"],
  ["orders", "Orders"],
  ["conversions", "Conversions"],
  ["commissions", "Commissions"],
  ["payouts", "Payouts"],
  ["analytics", "Analytics"],
  ["settings", "Settings"],
];

const matchLength = (pathname, prefix, exact) =>
  pathname === prefix || (!exact && pathname.startsWith(prefix + "/")) ? prefix.length : -1;

/** { groupId, href } of the best-matching menu item for a path. */
export function resolveActive(pathname, menus = MENUS) {
  let best = { groupId: "", href: "", len: -1 };
  for (const m of menus) {
    if (m.affiliates) {
      const len = matchLength(pathname, "/admin/affiliates");
      if (len > best.len) best = { groupId: m.id, href: "/admin/affiliates", len };
    }
    for (const it of m.items || []) {
      for (const prefix of [it.href, ...(it.also || [])]) {
        const len = matchLength(pathname, prefix, it.exact);
        if (len > best.len) best = { groupId: m.id, href: it.href, len };
      }
    }
  }
  return best;
}

const isMobileWidth = () => typeof window !== "undefined" && window.matchMedia("(max-width: 781px)").matches;

// Reads ?view= for the affiliate sub-links (useSearchParams needs its own Suspense boundary).
function AffiliateLinks({ onAffiliates, linkClass }) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("view");
  const current = AFFILIATE_VIEWS.some(([v]) => v === raw) ? raw : "overview";
  return AFFILIATE_VIEWS.map(([view, label]) => {
    const on = onAffiliates && current === view;
    return (
      <Link key={view} href={`/admin/affiliates?view=${view}`} className={linkClass(on)} aria-current={on ? "page" : undefined}>{label}</Link>
    );
  });
}

export default function AdminSidebar({ open = false, onClose }) {
  const pathname = usePathname() || "";
  const { data: session } = useSession();
  const user = session?.user;

  // Mirrors the permission keys enforced server-side on each section's API routes — a nav
  // entry pointing at a page the role can't use is worse than no entry, so it is hidden.
  const has = (perm) => {
    if (!perm) return true;
    if (perm === "__trash") return visibleTrashModules((k) => can(user, k)).length > 0;
    return (Array.isArray(perm) ? perm : [perm]).some((k) => can(user, k));
  };

  const active = resolveActive(pathname);

  // Mobile drawer: which non-current menu is expanded in place (tap to open, like WordPress)
  const [expanded, setExpanded] = useState("");
  // Desktop flyout for a non-current menu: { id, top } (fixed position so the scrolling menu can't clip it)
  const [flyout, setFlyout] = useState(null);
  const closeTimer = useRef(null);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setExpanded("");
    setFlyout(null);
  }

  // Pending-orders bubble on Orders (refreshed on navigation)
  const canOrders = can(user, "orders.view");
  const [pendingOrders, setPendingOrders] = useState(0);
  useEffect(() => {
    if (!canOrders) return;
    let cancelled = false;
    fetch("/api/admin/orders?status=Pending&limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setPendingOrders(Number(d.pagination?.total) || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [canOrders, pathname]);

  // Close the mobile drawer whenever navigation happens
  useEffect(() => {
    if (open && typeof onClose === "function") onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape closes the mobile drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && typeof onClose === "function") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const showFlyout = (id, el) => {
    if (isMobileWidth()) return;
    clearTimeout(closeTimer.current);
    const r = el.getBoundingClientRect();
    setFlyout({ id, top: r.top });
  };
  const hideFlyoutSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFlyout(null), 120);
  };
  const keepFlyout = () => clearTimeout(closeTimer.current);

  const subLinkClass = (on) =>
    `block py-2.5 md:py-[5px] pl-11 md:pl-[34px] pr-3 text-[14px] md:text-[13px] leading-5 ${on ? "text-white font-semibold" : "text-[#c3c4c7] hover:text-[#72aee6]"}`;
  const flyLinkClass = (on) =>
    `block px-3 py-[6px] text-[13px] leading-5 ${on ? "text-white font-semibold" : "text-[#c3c4c7] hover:text-[#72aee6]"}`;

  const visibleMenus = MENUS.map((m) => {
    if (m.affiliates) return has(m.perm) ? { ...m, links: null } : null;
    if (!has(m.perm)) return null;
    const links = (m.items || []).filter((it) => has(it.perm));
    return links.length ? { ...m, links } : null;
  }).filter(Boolean);

  const badgeCount = (m) => (m.badge === "pendingOrders" ? pendingOrders : 0);

  const renderSubLinks = (m, linkClass) =>
    m.affiliates ? (
      <Suspense fallback={null}>
        <AffiliateLinks onAffiliates={active.groupId === m.id} linkClass={linkClass} />
      </Suspense>
    ) : (
      m.links.map((it) => {
        const on = active.href === it.href;
        return (
          <Link key={it.href} href={it.href} className={linkClass(on)} aria-current={on ? "page" : undefined}>{it.label}</Link>
        );
      })
    );

  const flyMenu = flyout && visibleMenus.find((m) => m.id === flyout.id);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-x-0 top-11 bottom-0 bg-black/50 z-[90] md:hidden transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />
      <aside
        id="admin-sidebar"
        aria-label="Admin navigation"
        className={`w-[min(260px,85vw)] md:w-[160px] bg-[#1d2327] text-[#f0f0f1] flex flex-col fixed left-0 top-11 md:top-0 h-[calc(100dvh-2.75rem)] md:h-screen z-[95] md:z-50 font-sans select-none shrink-0 transition-transform duration-200 ease-out ${open ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0 md:shadow-none"}`}
      >
        <div className="flex-1 overflow-y-auto admin-menu-scroll pt-3 pb-6" onScroll={() => setFlyout(null)}>
          <nav aria-label="Main menu">
            <ul className="m-0 p-0 list-none">
              {visibleMenus.map((m) => {
                const Icon = m.icon;
                const isCurrent = active.groupId === m.id;
                const isExpanded = !isCurrent && expanded === m.id;
                const firstHref = m.affiliates ? "/admin/affiliates" : m.links[0].href;
                const count = badgeCount(m);
                const hasSub = m.affiliates || m.links.length > 1;
                return (
                  <li
                    key={m.id}
                    className={m.sepBefore ? "mt-3" : ""}
                    onMouseEnter={(e) => { if (!isCurrent && hasSub) showFlyout(m.id, e.currentTarget); }}
                    onMouseLeave={hideFlyoutSoon}
                  >
                    <Link
                      href={firstHref}
                      aria-current={isCurrent && active.href === firstHref ? "page" : undefined}
                      aria-haspopup={hasSub && !isCurrent ? "true" : undefined}
                      onClick={(e) => {
                        // Mobile: first tap on another section opens its submenu instead of navigating
                        if (!isCurrent && hasSub && isMobileWidth() && expanded !== m.id) {
                          e.preventDefault();
                          setExpanded(m.id);
                        }
                      }}
                      onFocus={(e) => { if (!isCurrent && hasSub) showFlyout(m.id, e.currentTarget.parentElement); }}
                      className={`relative flex items-center gap-2 min-h-11 md:min-h-[34px] px-4 md:px-[10px] text-[15px] md:text-[14px] leading-[18px] ${isCurrent
                        ? "bg-[#2271b1] text-white"
                        : flyout?.id === m.id
                          ? "bg-[#2c3338] text-[#72aee6]"
                          : "text-[#f0f0f1] hover:bg-[#2c3338] hover:text-[#72aee6]"}`}
                    >
                      <Icon className={`w-[18px] h-[18px] shrink-0 ${isCurrent ? "opacity-100" : "opacity-60"}`} aria-hidden="true" />
                      <span className="truncate">{m.title}</span>
                      {count > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] px-[5px] rounded-full bg-[#d63638] text-white text-[10px] font-bold leading-[18px] text-center" aria-label={`${count} pending`}>
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                      {/* WordPress's little arrow pointing at the content for the current menu */}
                      {isCurrent && (
                        <span aria-hidden="true" className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 border-y-[8px] border-y-transparent border-r-[8px] border-r-[#f0f0f1]" />
                      )}
                    </Link>
                    {(isCurrent || isExpanded) && hasSub && (
                      <div className="bg-[#2c3338] py-[7px]">
                        {renderSubLinks(m, subLinkClass)}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="p-3 border-t border-white/5 shrink-0 bg-[#1d2327]">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 min-h-10 md:min-h-0 text-[#c3c4c7] hover:text-[#72aee6] transition-colors text-[14px] md:text-[13px] w-full px-1"
          >
            <LogOut className="w-4 h-4 opacity-60" aria-hidden="true" />
            Log Out
          </button>
        </div>

        <style jsx global>{`
          .admin-menu-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.15) transparent; }
          .admin-menu-scroll::-webkit-scrollbar { width: 6px; }
          .admin-menu-scroll::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,.15); border-radius: 10px; }
        `}</style>
      </aside>

      {/* Desktop hover flyout for a non-current menu (WordPress style) */}
      {flyMenu && (
        <div
          role="menu"
          aria-label={`${flyMenu.title} submenu`}
          onMouseEnter={keepFlyout}
          onMouseLeave={hideFlyoutSoon}
          className="hidden md:block fixed left-[160px] z-[96] min-w-[180px] bg-[#2c3338] py-[7px] shadow-[0_3px_5px_rgba(0,0,0,.2)]"
          style={{ top: flyout.top }}
        >
          <span aria-hidden="true" className="absolute -left-[8px] top-[9px] border-y-[8px] border-y-transparent border-r-[8px] border-r-[#2c3338]" />
          {renderSubLinks(flyMenu, flyLinkClass)}
        </div>
      )}
    </>
  );
}

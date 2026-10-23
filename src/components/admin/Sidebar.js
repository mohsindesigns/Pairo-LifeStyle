"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Image as ImageIcon,
  Settings,
  ChevronRight,
  LogOut,
  FileText,
  ShoppingCart,
  Box,
  Users,
  Palette,
  MessageSquare,
  Wrench,
  Link2,
  BarChart2,
  DollarSign,
  MousePointerClick,
  CreditCard,
  ClipboardList,
  UserCheck,
  SlidersHorizontal,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { can } from "@/lib/rbac";
import { visibleModules as visibleTrashModules } from "@/app/admin/trash/trashModules";

// Sidebar structure. Each item: { href, label, perm?, also?: [extra path prefixes it owns] }.
// `perm` is a "module.action" key (or array: any one). Items without perm show for every staff.
// The active item is the one whose href (or `also` prefix) is the LONGEST match for the current
// path, so /admin/products/123 highlights "All Products" but /admin/products/new highlights
// "Add New", and the accordion holding it opens automatically.
const GROUPS = [
  { id: "posts", title: "Posts", icon: FileText, perm: "blogs.view", items: [
    { href: "/admin/blogs", label: "All Posts", also: ["/admin/blog"] },
    { href: "/admin/blogs/new", label: "Add New", perm: "blogs.create" },
    { href: "/admin/blogs/categories", label: "Categories" },
  ] },
  { id: "media", title: "Media", icon: ImageIcon, href: "/admin/media", perm: "media.manage" },
  { id: "pages", title: "Pages", icon: Layers, perm: "pages.view", items: [
    { href: "/admin/pages", label: "All Pages", also: ["/admin/page"] },
    { href: "/admin/pages/new", label: "Add New", perm: "pages.create" },
    { href: "/admin/gallery-items", label: "Gallery Items", perm: "pages.edit" },
  ] },
  { id: "reviews", title: "Reviews", icon: MessageSquare, href: "/admin/reviews", perm: "reviews.view" },
  { divider: true },
  { id: "commerce", title: "Commerce", icon: ShoppingCart, items: [
    { href: "/admin/orders", label: "Orders", perm: "orders.view" },
    { href: "/admin/abandoned-carts", label: "Abandoned Carts", perm: "orders.view" },
    { href: "/admin/custom-jacket-orders", label: "Custom Orders", perm: "orders.view" },
    { href: "/admin/size-confirmations", label: "Size Confirmations", perm: "orders.view" },
    { href: "/admin/custom-jacket-inquiries", label: "Custom Inquiries", perm: "submissions.view" },
    { href: "/admin/corporate-gifting-inquiries", label: "Gifting Inquiries", perm: "submissions.view" },
    { href: "/admin/customers", label: "Customers", perm: "customers.view" },
    { href: "/admin/discounts", label: "Coupons", perm: "promotions.view" },
    { href: "/admin/promotions", label: "Promotions & BOGO", perm: "promotions.view" },
  ] },
  { id: "affiliates", title: "Affiliates", icon: Link2, perm: "affiliates.view", affiliates: true },
  { id: "products", title: "Products", icon: Box, perm: "products.view", items: [
    { href: "/admin/products", label: "All Products", also: ["/admin/product"] },
    { href: "/admin/products/new", label: "Add New", perm: "products.create" },
    { href: "/admin/products/size-charts", label: "Size Charts" },
    { href: "/admin/size-chart-items", label: "Size Chart Items", perm: "products.edit" },
    { href: "/admin/categories", label: "Categories", also: ["/admin/category", "/admin/products/categories"] },
    { href: "/admin/product-process", label: "Product Process" },
    { href: "/admin/product-questions", label: "Product Questions" },
  ] },
  { divider: true },
  { id: "appearance", title: "Appearance", icon: Palette, href: "/admin/appearance", perm: "settings.view" },
  { id: "users", title: "Users", icon: Users, items: [
    { href: "/admin/settings/team", label: "All Users", perm: ["staff.view", "staff.manage_roles"], also: ["/admin/team", "/admin/users"] },
    { href: "/admin/settings/team/new", label: "Add New", perm: "staff.create", also: ["/admin/team/new", "/admin/users/new"] },
    { href: "/admin/settings/roles", label: "Roles", perm: ["staff.view", "staff.manage_roles"], also: ["/admin/roles"] },
  ] },
  { id: "tools", title: "Tools", icon: Wrench, items: [
    { href: "/admin/contact", label: "Contact Forms", perm: "submissions.view" },
    { href: "/admin/settings/logs", label: "Audit Logs", perm: "settings.view" },
    { href: "/admin/settings/scripts", label: "Custom Scripts", perm: "scripts.view" },
    { href: "/admin/settings/filters", label: "Category Filters", perm: "products.view" },
    { href: "/admin/trash", label: "Trash", perm: "__trash" },
  ] },
  { id: "settings", title: "Settings", icon: Settings, perm: "settings.view", items: [
    { href: "/admin/settings/site", label: "General" },
    { href: "/admin/settings/shipping", label: "Shipping", also: ["/admin/settings/shipping/pickup-locations"] },
    { href: "/admin/settings/tax", label: "Tax" },
  ] },
];

const AFFILIATE_VIEWS = [
  ["overview", "Overview", BarChart2],
  ["requests", "Applications", ClipboardList],
  ["list", "All Affiliates", UserCheck],
  ["links", "Referral Links", Link2],
  ["orders", "Orders", ShoppingCart],
  ["conversions", "Conversions", MousePointerClick],
  ["commissions", "Commissions", DollarSign],
  ["payouts", "Payouts", CreditCard],
  ["analytics", "Analytics", BarChart2],
  ["settings", "Settings", SlidersHorizontal],
];

const matchLength = (pathname, prefix) =>
  pathname === prefix || pathname.startsWith(prefix + "/") ? prefix.length : -1;

/** { groupId, href } of the best-matching sidebar item for a path. */
export function resolveActive(pathname, groups = GROUPS) {
  let best = { groupId: "", href: "", len: -1 };
  for (const g of groups) {
    if (g.divider) continue;
    if (g.href) {
      const len = matchLength(pathname, g.href);
      if (len > best.len) best = { groupId: g.id, href: g.href, len };
    }
    if (g.affiliates) {
      const len = matchLength(pathname, "/admin/affiliates");
      if (len > best.len) best = { groupId: g.id, href: "/admin/affiliates", len };
    }
    for (const it of g.items || []) {
      for (const prefix of [it.href, ...(it.also || [])]) {
        const len = matchLength(pathname, prefix);
        if (len > best.len) best = { groupId: g.id, href: it.href, len };
      }
    }
  }
  return best;
}

const subLinkClass = (isActive) =>
  `block py-2.5 md:py-[6px] pr-3 pl-10 text-[14px] md:text-[13px] leading-5 transition-colors ${isActive
    ? "text-white font-semibold"
    : "text-[#c3c4c7] hover:text-[#72aee6]"}`;

const topClass = (isActive) =>
  `w-full flex items-center justify-between px-3 py-2.5 md:py-2 text-[14px] md:text-[13px] transition-all group ${isActive
    ? "bg-[#2271b1] text-white font-medium"
    : "text-[#f0f0f1] hover:bg-[#2c3338] hover:text-[#72aee6]"}`;

const iconClass = (isActive) => `w-[18px] h-[18px] ${isActive ? "text-white" : "text-[#a7aaad] group-hover:text-[#72aee6]"}`;

const SubLink = ({ href, active, children }) => (
  <Link href={href} className={subLinkClass(active)} aria-current={active ? "page" : undefined}>{children}</Link>
);

const AccordionMenu = ({ id, title, icon: Icon, children, isOpen, isCurrent, onToggle }) => (
  <div className="mb-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={`admin-menu-${id}`}
      className={topClass(isOpen || isCurrent)}
    >
      <span className="flex items-center gap-2">
        <Icon className={iconClass(isOpen || isCurrent)} aria-hidden="true" />
        <span>{title}</span>
      </span>
      <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-90" : ""} ${isOpen || isCurrent ? "text-white" : "text-[#a7aaad] group-hover:text-[#72aee6]"}`} aria-hidden="true" />
    </button>
    <div id={`admin-menu-${id}`} className={`bg-[#32373c] py-1.5 ${isOpen ? "block" : "hidden"}`}>
      {children}
    </div>
  </div>
);

// Reads ?view= for the affiliate sub-links (useSearchParams needs its own Suspense boundary).
function AffiliateLinks({ onAffiliates }) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("view");
  const current = AFFILIATE_VIEWS.some(([v]) => v === raw) ? raw : "overview";
  return AFFILIATE_VIEWS.map(([view, label, Icon]) => (
    <SubLink key={view} href={`/admin/affiliates?view=${view}`} active={onAffiliates && current === view}>
      <span className="flex items-center gap-1.5"><Icon size={11} aria-hidden="true" />{label}</span>
    </SubLink>
  ));
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
  const [openAccordion, setOpenAccordion] = useState(active.groupId);
  const [lastPath, setLastPath] = useState(pathname);
  // Open the section holding the current page whenever the route changes.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpenAccordion(active.groupId);
  }

  // Close the mobile drawer whenever navigation happens
  useEffect(() => {
    if (open && typeof onClose === "function") onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape key closes the mobile drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && typeof onClose === "function") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleToggle = (id) => setOpenAccordion((prev) => (prev === id ? "" : id));

  const isDashboardActive = pathname === "/admin" || pathname === "/admin/analytics" || pathname.startsWith("/admin/site-analytics");
  const canAnalytics = can(user, "analytics.view");

  const renderGroup = (g, i) => {
    if (g.divider) return <div key={`d${i}`} className="my-1.5 bg-[#ffffff1a] h-[1px] w-full" />;
    if (!has(g.perm)) return null;

    if (g.href) {
      const isActive = active.groupId === g.id;
      const Icon = g.icon;
      return (
        <Link key={g.id} href={g.href} className={topClass(isActive)} aria-current={isActive ? "page" : undefined}>
          <span className="flex items-center gap-2">
            <Icon className={iconClass(isActive)} aria-hidden="true" />
            <span>{g.title}</span>
          </span>
        </Link>
      );
    }

    const isCurrent = active.groupId === g.id;
    if (g.affiliates) {
      return (
        <AccordionMenu key={g.id} id={g.id} title={g.title} icon={g.icon} isOpen={openAccordion === g.id} isCurrent={isCurrent} onToggle={() => handleToggle(g.id)}>
          <Suspense fallback={null}>
            <AffiliateLinks onAffiliates={isCurrent} />
          </Suspense>
        </AccordionMenu>
      );
    }

    const items = g.items.filter((it) => has(it.perm));
    if (items.length === 0) return null;
    return (
      <AccordionMenu key={g.id} id={g.id} title={g.title} icon={g.icon} isOpen={openAccordion === g.id} isCurrent={isCurrent} onToggle={() => handleToggle(g.id)}>
        {items.map((it) => (
          <SubLink key={it.href} href={it.href} active={active.href === it.href}>{it.label}</SubLink>
        ))}
      </AccordionMenu>
    );
  };

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
      className={`w-[min(260px,85vw)] md:w-[160px] bg-[#1d2327] text-[#f0f0f1] flex flex-col fixed left-0 top-11 md:top-0 h-[calc(100dvh-2.75rem)] md:h-screen z-[95] md:z-50 font-sans border-r border-white/5 select-none shrink-0 transition-transform duration-200 ease-out ${open ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0 md:shadow-none"}`}
    >
      {/* Scrollable Nav */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 mt-2">
        <nav className="py-2 flex flex-col gap-0.5">
          {/* Dashboard */}
          <div className="mb-0">
            <Link href="/admin" className={topClass(isDashboardActive)} aria-current={pathname === "/admin" ? "page" : undefined}>
              <span className="flex items-center gap-2">
                <LayoutDashboard className={iconClass(isDashboardActive)} aria-hidden="true" />
                <span>Dashboard</span>
              </span>
            </Link>
            {isDashboardActive && (
              <div className="bg-[#32373c] py-1.5">
                <SubLink href="/admin" active={pathname === "/admin"}>Home</SubLink>
                {canAnalytics && <SubLink href="/admin/analytics" active={pathname === "/admin/analytics"}>Analytics</SubLink>}
                {canAnalytics && <SubLink href="/admin/site-analytics" active={pathname.startsWith("/admin/site-analytics")}>Visitor Analytics</SubLink>}
              </div>
            )}
          </div>

          <div className="my-1.5 bg-[#ffffff1a] h-[1px] w-full" />

          {GROUPS.map(renderGroup)}
        </nav>
      </div>

      {/* Logout Footer */}
      <div className="p-3 border-t border-white/5 shrink-0 bg-[#1d2327]">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-2 min-h-10 md:min-h-0 text-[#72aee6] hover:text-white transition-colors text-[14px] md:text-[13px] font-medium w-full px-2"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Log Out
        </button>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-initial {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </aside>
    </>
  );
}

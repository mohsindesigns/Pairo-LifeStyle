"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Ruler
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { can } from "@/lib/rbac";

const NavLink = ({ href, icon: Icon, children, exact = false, isSubmenu = false }) => {
  const pathname = usePathname();

  // Exact match for standalone items, prefix match for groups
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  if (isSubmenu) {
    return (
      <Link
        href={href}
        className={`block py-2 md:py-[6px] pr-3 pl-10 text-[14px] md:text-[13px] leading-5 transition-colors ${isActive
            ? "text-white font-semibold"
            : "text-[#c3c4c7] hover:text-[#72aee6]"
          }`}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2.5 md:py-2 text-[14px] md:text-[13px] transition-all group ${isActive
          ? "bg-[#2271b1] text-white font-medium"
          : "text-[#a7aaad] hover:bg-[#2c3338] hover:text-[#72aee6]"
        }`}
    >
      {Icon && <Icon className={`w-[18px] h-[18px] ${isActive ? "text-white" : "text-[#a7aaad] group-hover:text-[#72aee6]"}`} />}
      <span>{children}</span>
    </Link>
  );
};

const AccordionMenu = ({ title, icon: Icon, children, isOpen, onToggle }) => {
  return (
    <div className="mb-0">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2.5 md:py-2 text-[14px] md:text-[13px] transition-all group ${isOpen
            ? "bg-[#2271b1] text-white font-medium"
            : "hover:bg-[#2c3338] hover:text-[#72aee6] text-[#a7aaad]"
          }`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-[18px] h-[18px] ${isOpen ? "text-white" : "text-[#a7aaad] group-hover:text-[#72aee6]"}`} />
          <span>{title}</span>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-90" : ""} ${isOpen ? "text-white" : "text-[#a7aaad] group-hover:text-[#72aee6]"}`} />
      </button>

      {/* Accordion Submenu */}
      <div className={`bg-[#32373c] py-1.5 overflow-hidden transition-all duration-200 ${isOpen ? "block" : "hidden"}`}>
        {children}
      </div>
    </div>
  );
};

export default function AdminSidebar({ open = false, onClose }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [openAccordion, setOpenAccordion] = useState("");

  // Mirrors the exact permission keys enforced server-side on each section's underlying API
  // routes — a nav entry pointing at a page the staff member's role can't actually use is
  // worse than no entry at all, so this hides it instead of letting them click into a 403.
  const user = session?.user;
  const perms = {
    analyticsView: can(user, "analytics.view"),
    blogsView: can(user, "blogs.view"),
    blogsCreate: can(user, "blogs.create"),
    mediaManage: can(user, "media.manage"),
    pagesView: can(user, "pages.view"),
    pagesCreate: can(user, "pages.create"),
    pagesEdit: can(user, "pages.edit"),
    reviewsView: can(user, "reviews.view"),
    ordersView: can(user, "orders.view"),
    submissionsView: can(user, "submissions.view"),
    customersView: can(user, "customers.view"),
    promotionsView: can(user, "promotions.view"),
    affiliatesView: can(user, "affiliates.view"),
    productsView: can(user, "products.view"),
    productsEdit: can(user, "products.edit"),
    settingsView: can(user, "settings.view"),
    staffView: can(user, "staff.view"),
    staffCreate: can(user, "staff.create"),
    staffManageRoles: can(user, "staff.manage_roles"),
    scriptsView: can(user, "scripts.view"),
  };
  const canSeeCommerce = perms.ordersView || perms.submissionsView || perms.customersView || perms.promotionsView;
  const canSeeTools = perms.submissionsView || perms.settingsView || perms.scriptsView || perms.productsView;
  const canSeeUsers = perms.staffView || perms.staffManageRoles;

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

  // Determine initial open accordion based on path
  useEffect(() => {
    if (pathname.startsWith("/admin/products") || pathname.startsWith("/admin/categories") || pathname.startsWith("/admin/product-process") || pathname.startsWith("/admin/product-questions")) setOpenAccordion("products");
    else if (pathname.startsWith("/admin/affiliates")) setOpenAccordion("affiliates");
    else if (pathname.startsWith("/admin/orders") || pathname.startsWith("/admin/custom-jacket-orders") || pathname.startsWith("/admin/custom-jacket-inquiries") || pathname.startsWith("/admin/customers") || pathname.startsWith("/admin/discounts")) setOpenAccordion("commerce");
    else if (pathname.startsWith("/admin/blogs")) setOpenAccordion("posts");
    else if (pathname.startsWith("/admin/pages") || pathname.startsWith("/admin/gallery-items")) setOpenAccordion("pages");
    else if (pathname.startsWith("/admin/settings/team") || pathname.startsWith("/admin/settings/roles")) setOpenAccordion("users");
    else if (pathname.startsWith("/admin/appearance")) setOpenAccordion("appearance");
    else if (pathname.startsWith("/admin/contact") || pathname.startsWith("/admin/settings/logs") || pathname.startsWith("/admin/settings/scripts") || pathname.startsWith("/admin/settings/filters")) setOpenAccordion("tools");
    else if (pathname.startsWith("/admin/settings/site")) setOpenAccordion("settings");
    else setOpenAccordion("");
  }, [pathname]);

  const handleToggle = (id) => {
    setOpenAccordion(prev => prev === id ? "" : id);
  };

  const isDashboardActive = pathname === "/admin" || pathname === "/admin/analytics";

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

          {/* Dashboard Accordion */}
          <div className="mb-0">
            <Link href="/admin" className={`flex items-center justify-between px-3 py-2 text-[13px] transition-all group ${isDashboardActive ? "bg-[#2271b1] text-white font-medium" : "text-[#a7aaad] hover:bg-[#2c3338] hover:text-[#72aee6]"}`}>
              <div className="flex items-center gap-2">
                <LayoutDashboard className={`w-[18px] h-[18px] ${isDashboardActive ? "text-white" : "text-[#a7aaad] group-hover:text-[#72aee6]"}`} />
                <span>Dashboard</span>
              </div>
            </Link>
            {isDashboardActive && (
              <div className="bg-[#32373c] py-1.5">
                <NavLink href="/admin" exact isSubmenu>Home</NavLink>
                {perms.analyticsView && <NavLink href="/admin/analytics" exact isSubmenu>Analytics</NavLink>}
              </div>
            )}
          </div>

          <div className="my-1.5 bg-[#ffffff1a] h-[1px] w-full" />

          {/* Posts (Blogs) */}
          {perms.blogsView && (
            <AccordionMenu
              title="Posts" icon={FileText}
              isOpen={openAccordion === "posts"} onToggle={() => handleToggle("posts")}
            >
              <NavLink href="/admin/blogs" exact isSubmenu>All Posts</NavLink>
              {perms.blogsCreate && <NavLink href="/admin/blogs/new" exact isSubmenu>Add New</NavLink>}
              <NavLink href="/admin/blogs/categories" exact isSubmenu>Categories</NavLink>
            </AccordionMenu>
          )}

          {/* Media Standalone */}
          {perms.mediaManage && <NavLink href="/admin/media" exact icon={ImageIcon}>Media</NavLink>}

          {/* Pages Accordion */}
          {perms.pagesView && (
            <AccordionMenu
              title="Pages" icon={Layers}
              isOpen={openAccordion === "pages"} onToggle={() => handleToggle("pages")}
            >
              <NavLink href="/admin/pages" exact isSubmenu>All Pages</NavLink>
              {perms.pagesCreate && <NavLink href="/admin/pages/new" exact isSubmenu>Add New</NavLink>}
              {perms.pagesEdit && <NavLink href="/admin/gallery-items" exact isSubmenu>Gallery Items</NavLink>}
            </AccordionMenu>
          )}

          {/* Comments / Reviews Standalone */}
          {perms.reviewsView && <NavLink href="/admin/reviews" exact icon={MessageSquare}>Reviews</NavLink>}

          <div className="my-1.5 bg-[#ffffff1a] h-[1px] w-full" />

          {/* Commerce */}
          {canSeeCommerce && (
            <AccordionMenu
              title="Commerce" icon={ShoppingCart}
              isOpen={openAccordion === "commerce"} onToggle={() => handleToggle("commerce")}
            >
              {perms.ordersView && <NavLink href="/admin/orders" exact isSubmenu>Orders</NavLink>}
              {perms.ordersView && <NavLink href="/admin/abandoned-carts" exact isSubmenu>Abandoned Carts</NavLink>}
              {perms.ordersView && <NavLink href="/admin/custom-jacket-orders" exact isSubmenu>Custom Orders</NavLink>}
              {perms.submissionsView && <NavLink href="/admin/custom-jacket-inquiries" exact isSubmenu>Custom Inquiries</NavLink>}
              {perms.customersView && <NavLink href="/admin/customers" exact isSubmenu>Customers</NavLink>}
              {perms.promotionsView && <NavLink href="/admin/discounts" exact isSubmenu>Coupons</NavLink>}
              {perms.promotionsView && <NavLink href="/admin/promotions" exact isSubmenu>Promotions & BOGO</NavLink>}
            </AccordionMenu>
          )}

          {/* Affiliates — Dedicated Module */}
          {perms.affiliatesView && (
          <AccordionMenu
            title="Affiliates" icon={Link2}
            isOpen={openAccordion === "affiliates"} onToggle={() => handleToggle("affiliates")}
          >
            <NavLink href="/admin/affiliates?view=overview" isSubmenu>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><BarChart2 size={11}/>Overview</span>
            </NavLink>
            <NavLink href="/admin/affiliates?view=requests" isSubmenu>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><ClipboardList size={11}/>Applications</span>
            </NavLink>
            <NavLink href="/admin/affiliates?view=list" isSubmenu>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><UserCheck size={11}/>All Affiliates</span>
            </NavLink>
            <NavLink href="/admin/affiliates?view=links" isSubmenu>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><Link2 size={11}/>Referral Links</span>
            </NavLink>
            <NavLink href="/admin/affiliates?view=orders" isSubmenu>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><ShoppingCart size={11}/>Orders</span>
            </NavLink>
            <NavLink href="/admin/affiliates?view=conversions" isSubmenu>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><MousePointerClick size={11}/>Conversions</span>
            </NavLink>
            <NavLink href="/admin/affiliates?view=commissions" isSubmenu>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><DollarSign size={11}/>Commissions</span>
            </NavLink>
            <NavLink href="/admin/affiliates?view=payouts" isSubmenu>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><CreditCard size={11}/>Payouts</span>
            </NavLink>
            <NavLink href="/admin/affiliates?view=analytics" isSubmenu>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><BarChart2 size={11}/>Analytics</span>
            </NavLink>
            <NavLink href="/admin/affiliates?view=settings" isSubmenu>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><SlidersHorizontal size={11}/>Settings</span>
            </NavLink>
          </AccordionMenu>
          )}

          {/* Products Accordion */}
          {perms.productsView && (
            <AccordionMenu
              title="Products" icon={Box}
              isOpen={openAccordion === "products"} onToggle={() => handleToggle("products")}
            >
              <NavLink href="/admin/products" exact isSubmenu>All Products</NavLink>
              <NavLink href="/admin/products/new" exact isSubmenu>Add New</NavLink>
              <NavLink href="/admin/products/size-charts" exact isSubmenu>Size Charts</NavLink>
              {perms.productsEdit && <NavLink href="/admin/size-chart-items" exact isSubmenu>Size Chart Items</NavLink>}
              <NavLink href="/admin/categories" exact isSubmenu>Categories</NavLink>
              <NavLink href="/admin/product-process" exact isSubmenu>Product Process</NavLink>
              <NavLink href="/admin/product-questions" exact isSubmenu>Product Questions</NavLink>
            </AccordionMenu>
          )}

          <div className="my-1.5 bg-[#ffffff1a] h-[1px] w-full" />

          {/* Appearance Standalone */}
          {perms.settingsView && <NavLink href="/admin/appearance" exact icon={Palette}>Appearance</NavLink>}

          {/* Users Accordion */}
          {canSeeUsers && (
            <AccordionMenu
              title="Users" icon={Users}
              isOpen={openAccordion === "users"} onToggle={() => handleToggle("users")}
            >
              <NavLink href="/admin/settings/team" exact isSubmenu>All Users</NavLink>
              {perms.staffCreate && <NavLink href="/admin/settings/team/new" exact isSubmenu>Add New</NavLink>}
              <NavLink href="/admin/settings/roles" exact isSubmenu>Roles</NavLink>
            </AccordionMenu>
          )}

          {/* Tools Accordion */}
          {canSeeTools && (
            <AccordionMenu
              title="Tools" icon={Wrench}
              isOpen={openAccordion === "tools"} onToggle={() => handleToggle("tools")}
            >
              {perms.submissionsView && <NavLink href="/admin/contact" exact isSubmenu>Contact Forms</NavLink>}
              {perms.settingsView && <NavLink href="/admin/settings/logs" exact isSubmenu>Audit Logs</NavLink>}
              {perms.scriptsView && <NavLink href="/admin/settings/scripts" exact isSubmenu>Custom Scripts</NavLink>}
              {perms.productsView && <NavLink href="/admin/settings/filters" exact isSubmenu>Category Filters</NavLink>}
            </AccordionMenu>
          )}

          {/* Settings Accordion */}
          {perms.settingsView && (
            <AccordionMenu
              title="Settings" icon={Settings}
              isOpen={openAccordion === "settings"} onToggle={() => handleToggle("settings")}
            >
              <NavLink href="/admin/settings/site" exact isSubmenu>General</NavLink>
              <NavLink href="/admin/settings/shipping" exact isSubmenu>Shipping</NavLink>
              <NavLink href="/admin/settings/tax" exact isSubmenu>Tax</NavLink>
            </AccordionMenu>
          )}

        </nav>
      </div>

      {/* Logout Footer */}
      <div className="p-3 border-t border-white/5 shrink-0 bg-[#1d2327]">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-2 text-[#72aee6] hover:text-white transition-colors text-[13px] font-medium w-full px-2"
        >
          <LogOut className="w-4 h-4" />
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

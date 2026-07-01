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
import { signOut } from "next-auth/react";

const NavLink = ({ href, icon: Icon, children, exact = false, isSubmenu = false }) => {
  const pathname = usePathname();

  // Exact match for standalone items, prefix match for groups
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  if (isSubmenu) {
    return (
      <Link
        href={href}
        className={`block py-[6px] pr-3 pl-10 text-[13px] leading-5 transition-colors ${isActive
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
      className={`flex items-center gap-2 px-3 py-2 text-[13px] transition-all group ${isActive
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
        className={`w-full flex items-center justify-between px-3 py-2 text-[13px] transition-all group ${isOpen
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

export default function AdminSidebar() {
  const pathname = usePathname();
  const [openAccordion, setOpenAccordion] = useState("");

  // Determine initial open accordion based on path
  useEffect(() => {
    if (pathname.startsWith("/admin/products") || pathname.startsWith("/admin/categories")) setOpenAccordion("products");
    else if (pathname.startsWith("/admin/affiliates")) setOpenAccordion("affiliates");
    else if (pathname.startsWith("/admin/orders") || pathname.startsWith("/admin/customers") || pathname.startsWith("/admin/discounts")) setOpenAccordion("commerce");
    else if (pathname.startsWith("/admin/blogs")) setOpenAccordion("posts");
    else if (pathname.startsWith("/admin/pages")) setOpenAccordion("pages");
    else if (pathname.startsWith("/admin/settings/team") || pathname.startsWith("/admin/settings/roles")) setOpenAccordion("users");
    else if (pathname.startsWith("/admin/appearance")) setOpenAccordion("appearance");
    else if (pathname.startsWith("/admin/contact") || pathname.startsWith("/admin/settings/logs") || pathname.startsWith("/admin/settings/scripts")) setOpenAccordion("tools");
    else if (pathname.startsWith("/admin/settings/site")) setOpenAccordion("settings");
    else setOpenAccordion("");
  }, [pathname]);

  const handleToggle = (id) => {
    setOpenAccordion(prev => prev === id ? "" : id);
  };

  const isDashboardActive = pathname === "/admin" || pathname === "/admin/analytics";

  return (
    <aside className="w-[160px] bg-[#1d2327] text-[#f0f0f1] h-screen flex flex-col fixed left-0 top-0 z-50 font-sans border-r border-white/5 select-none shrink-0">
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
                <NavLink href="/admin/analytics" exact isSubmenu>Analytics</NavLink>
              </div>
            )}
          </div>

          <div className="my-1.5 bg-[#ffffff1a] h-[1px] w-full" />

          {/* Posts (Blogs) */}
          <AccordionMenu
            title="Posts" icon={FileText}
            isOpen={openAccordion === "posts"} onToggle={() => handleToggle("posts")}
          >
            <NavLink href="/admin/blogs" exact isSubmenu>All Posts</NavLink>
            <NavLink href="/admin/blogs/new" exact isSubmenu>Add New</NavLink>
            <NavLink href="/admin/blogs/categories" exact isSubmenu>Categories</NavLink>
          </AccordionMenu>

          {/* Media Standalone */}
          <NavLink href="/admin/media" exact icon={ImageIcon}>Media</NavLink>

          {/* Pages Accordion */}
          <AccordionMenu
            title="Pages" icon={Layers}
            isOpen={openAccordion === "pages"} onToggle={() => handleToggle("pages")}
          >
            <NavLink href="/admin/pages" exact isSubmenu>All Pages</NavLink>
            <NavLink href="/admin/pages/new" exact isSubmenu>Add New</NavLink>
          </AccordionMenu>

          {/* Comments / Reviews Standalone */}
          <NavLink href="/admin/reviews" exact icon={MessageSquare}>Reviews</NavLink>

          <div className="my-1.5 bg-[#ffffff1a] h-[1px] w-full" />

          {/* Commerce */}
          <AccordionMenu
            title="Commerce" icon={ShoppingCart}
            isOpen={openAccordion === "commerce"} onToggle={() => handleToggle("commerce")}
          >
            <NavLink href="/admin/orders" exact isSubmenu>Orders</NavLink>
            <NavLink href="/admin/customers" exact isSubmenu>Customers</NavLink>
            <NavLink href="/admin/discounts" exact isSubmenu>Coupons</NavLink>
          </AccordionMenu>

          {/* Affiliates — Dedicated Module */}
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

          {/* Products Accordion */}
          <AccordionMenu
            title="Products" icon={Box}
            isOpen={openAccordion === "products"} onToggle={() => handleToggle("products")}
          >
            <NavLink href="/admin/products" exact isSubmenu>All Products</NavLink>
            <NavLink href="/admin/products/new" exact isSubmenu>Add New</NavLink>
            <NavLink href="/admin/categories" exact isSubmenu>Categories</NavLink>
          </AccordionMenu>

          <div className="my-1.5 bg-[#ffffff1a] h-[1px] w-full" />

          {/* Appearance Standalone */}
          <NavLink href="/admin/appearance" exact icon={Palette}>Appearance</NavLink>

          {/* Users Accordion */}
          <AccordionMenu
            title="Users" icon={Users}
            isOpen={openAccordion === "users"} onToggle={() => handleToggle("users")}
          >
            <NavLink href="/admin/settings/team" exact isSubmenu>All Users</NavLink>
            <NavLink href="/admin/settings/team/new" exact isSubmenu>Add New</NavLink>
            <NavLink href="/admin/settings/roles" exact isSubmenu>Roles</NavLink>
          </AccordionMenu>

          {/* Tools Accordion */}
          <AccordionMenu
            title="Tools" icon={Wrench}
            isOpen={openAccordion === "tools"} onToggle={() => handleToggle("tools")}
          >
            <NavLink href="/admin/contact" exact isSubmenu>Contact Forms</NavLink>
            <NavLink href="/admin/settings/logs" exact isSubmenu>Audit Logs</NavLink>
            <NavLink href="/admin/settings/scripts" exact isSubmenu>Custom Scripts</NavLink>
          </AccordionMenu>

          {/* Settings Accordion */}
          <AccordionMenu
            title="Settings" icon={Settings}
            isOpen={openAccordion === "settings"} onToggle={() => handleToggle("settings")}
          >
            <NavLink href="/admin/settings/site" exact isSubmenu>General</NavLink>
            <NavLink href="/admin/settings/shipping" exact isSubmenu>Shipping</NavLink>
            <NavLink href="/admin/settings/tax" exact isSubmenu>Tax</NavLink>
          </AccordionMenu>

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
  );
}

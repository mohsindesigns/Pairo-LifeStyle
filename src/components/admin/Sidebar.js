"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Package, 
  Layers, 
  ShoppingBag, 
  Users, 
  Tag, 
  Image as ImageIcon, 
  Mail, 
  Settings, 
  Trash2,
  ChevronRight,
  LogOut,
  FileText,
  ShoppingCart,
  Plus,
  BarChart3,
  Box,
  Shield,
  UserPlus,
  History,
  Code2,
  Palette
} from "lucide-react";

import { signOut } from "next-auth/react";
import { useRBAC } from "@/hooks/useRBAC";

const NavLink = ({ href, icon: Icon, children, exact = false, permission, isSubmenu = false }) => {
  const pathname = usePathname();
  const { can } = useRBAC();
  if (permission && !can(permission)) return null;
  
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  return (
     <Link 
       href={href}
       className={`flex items-center gap-2 px-3 py-1.5 text-[14px] leading-[1.3] transition-all group ${
         isActive 
           ? "text-white font-medium bg-[#2271b1]" 
           : isSubmenu ? "text-[#c3c4c7] hover:text-[#72aee6]" : "text-[#a7aaad] hover:text-[#72aee6]"
       } ${isSubmenu ? "py-2 px-4 hover:bg-[#353c42]" : ""}`}
     >
       {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-[#a7aaad] group-hover:text-[#72aee6]"}`} />}
       <span>{children}</span>
     </Link>
  );
};

const FlyoutMenu = ({ title, icon: Icon, children, permission, activePath }) => {
  const pathname = usePathname();
  const { can } = useRBAC();
  if (permission && !can(permission)) return null;
  const isActive = pathname.includes(activePath);

  return (
      <div className="relative group/main">
          <button 
              className={`w-full flex items-center justify-between px-3 py-2 text-[14px] transition-all ${isActive ? "bg-[#2271b1] text-white font-bold" : "hover:bg-[#2c3338] hover:text-[#72aee6]"}`}
          >
              <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{title}</span>
              </div>
              <ChevronRight className="w-3 h-3 opacity-50" />
          </button>
          
          {/* Flyout Submenu */}
          <div className="invisible group-hover/main:visible absolute left-full top-0 w-[180px] bg-[#2c3338] shadow-xl border-l border-white/5 z-[60] py-1 translate-x-[-10px] group-hover/main:translate-x-0 transition-all opacity-0 group-hover/main:opacity-100">
              <div className="px-4 py-2 border-b border-white/5 mb-1">
                  <span className="text-[12px] font-bold text-[#72aee6] uppercase tracking-wider">{title}</span>
              </div>
              {children}
          </div>
      </div>
  );
};

export default function AdminSidebar() {
  const pathname = usePathname();
  const { can } = useRBAC();

  return (
    <aside className="w-[160px] bg-[#1d2327] text-[#f0f0f1] min-h-screen flex flex-col fixed left-0 top-0 z-50 font-sans border-r border-white/5 select-none overflow-visible">
      {/* Sidebar Header */}
      <div className="mb-2 border-b border-white/5">
        <Link href="/admin" className="flex items-center gap-2 px-3 py-4 hover:text-[#72aee6] transition-colors">
           <div className="w-5 h-5 bg-[#2271b1] rounded-sm flex items-center justify-center">
              <span className="text-[10px] font-black italic text-white">P</span>
           </div>
           <span className="text-[14px] font-bold">Pairo Store</span>
        </Link>
      </div>

      <nav className="flex-1">
        <div className="space-y-1 py-2">
           
           {/* Dashboard */}
           <Link href="/admin" className={`flex items-center gap-2 px-3 py-2 text-[14px] transition-all ${pathname === "/admin" ? "bg-[#2271b1] text-white" : "hover:bg-[#2c3338] hover:text-[#72aee6]"}`}>
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
           </Link>

           {/* Page Builder */}
           <FlyoutMenu title="Page Builder" icon={Layers} permission="pages.view" activePath="/admin/pages">
                <NavLink href="/admin/pages" exact isSubmenu>Manage Pages</NavLink>
                <NavLink href="/admin/pages/new" isSubmenu>Add New Page</NavLink>
           </FlyoutMenu>

           {/* Appearance */}
           {can("settings.view") && (
              <Link href="/admin/appearance" className={`flex items-center gap-2 px-3 py-2 text-[14px] transition-all ${pathname === "/admin/appearance" ? "bg-[#2271b1] text-white" : "hover:bg-[#2c3338] hover:text-[#72aee6]"}`}>
                 <Palette className="w-4 h-4" />
                 <span>Appearance</span>
              </Link>
           )}

           {/* Blog Flyout */}
           <FlyoutMenu title="Blog" icon={FileText} permission="blogs.view" activePath="/admin/blogs">
                <NavLink href="/admin/blogs" exact isSubmenu>All Posts</NavLink>
                <NavLink href="/admin/blogs/new" isSubmenu>Add New</NavLink>
                <NavLink href="/admin/blogs/categories" isSubmenu>Categories</NavLink>
           </FlyoutMenu>

           {/* Media */}
           {can("media.manage") && (
            <Link href="/admin/media" className={`flex items-center gap-2 px-3 py-2 text-[14px] transition-all ${pathname === "/admin/media" ? "bg-[#2271b1] text-white" : "hover:bg-[#2c3338] hover:text-[#72aee6]"}`}>
                <ImageIcon className="w-4 h-4" />
                <span>Media</span>
            </Link>
           )}

           <div className="h-[1px] bg-white/5 my-2 mx-3" />

           {/* Products Flyout */}
           <FlyoutMenu title="Products" icon={Box} permission="products.view" activePath="/admin/products">
                <NavLink href="/admin/products" exact isSubmenu>All Products</NavLink>
                <NavLink href="/admin/products/new" isSubmenu>Add New</NavLink>
                <NavLink href="/admin/categories" isSubmenu>Categories</NavLink>
           </FlyoutMenu>

           {/* Store Flyout */}
           <FlyoutMenu title="Store" icon={ShoppingCart} permission="orders.view" activePath="/admin/orders">
                <NavLink href="/admin/orders" isSubmenu>Orders</NavLink>
                <NavLink href="/admin/customers" isSubmenu>Customers</NavLink>
                <NavLink href="/admin/reviews" isSubmenu permission="reviews.view">Product Reviews</NavLink>
                <NavLink href="/admin/promotions" isSubmenu>Promotions</NavLink>
                <NavLink href="/admin/analytics" isSubmenu>Analytics</NavLink>
           </FlyoutMenu>

           {/* User Management Flyout */}
           <FlyoutMenu title="Users & RBAC" icon={Shield} permission="staff.view" activePath="/admin/settings/team">
                <NavLink href="/admin/settings/team" exact isSubmenu>All Staff</NavLink>
                <NavLink href="/admin/settings/team/new" isSubmenu>Invite User</NavLink>
                <NavLink href="/admin/settings/roles" isSubmenu>Roles & Access</NavLink>
           </FlyoutMenu>

           {/* Script Management Standalone */}
           {can("scripts.view") && (
              <Link href="/admin/settings/scripts" className={`flex items-center gap-2 px-3 py-2 text-[14px] transition-all ${pathname.startsWith("/admin/settings/scripts") ? "bg-[#2271b1] text-white" : "hover:bg-[#2c3338] hover:text-[#72aee6]"}`}>
                 <Code2 className="w-4 h-4" />
                 <span>Tracking & Scripts</span>
              </Link>
           )}

           {/* Audit Logs Standalone */}
           {can("settings.view") && (
              <Link href="/admin/settings/logs" className={`flex items-center gap-2 px-3 py-2 text-[14px] transition-all ${pathname === "/admin/settings/logs" ? "bg-[#2271b1] text-white" : "hover:bg-[#2c3338] hover:text-[#72aee6]"}`}>
                 <History className="w-4 h-4" />
                 <span>Audit Logs</span>
              </Link>
           )}

           <div className="h-[1px] bg-white/5 my-2 mx-3" />

           {/* Submissions */}
           <Link href="/admin/contact" className={`flex items-center gap-2 px-3 py-2 text-[14px] transition-all ${pathname === "/admin/contact" ? "bg-[#2271b1] text-white" : "hover:bg-[#2c3338] hover:text-[#72aee6]"}`}>
              <Mail className="w-4 h-4" />
              <span>Submissions</span>
           </Link>

        </div>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/5">
        <button 
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-2 text-[#72aee6] hover:text-white transition-colors text-[13px] font-medium"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>
    </aside>
  );
}

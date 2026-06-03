"use client";

import React, { useState, useEffect } from "react";
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
  Palette,
  MessageSquare,
  Wrench
} from "lucide-react";
import { signOut } from "next-auth/react";

const NavLink = ({ href, icon: Icon, children, exact = false, isSubmenu = false }) => {
  const pathname = usePathname();
  
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  return (
     <Link 
       href={href}
       className={`flex items-center gap-2 px-3 py-1.5 text-[13px] leading-[1.3] transition-all group ${
         isActive 
           ? "text-white font-medium bg-[#2271b1]" 
           : isSubmenu ? "text-[#c3c4c7] hover:text-[#72aee6]" : "text-[#a7aaad] hover:text-[#72aee6]"
       } ${isSubmenu ? "py-1.5 px-8 hover:bg-[#353c42]" : ""}`}
     >
       {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-[#a7aaad] group-hover:text-[#72aee6]"}`} />}
       <span>{children}</span>
     </Link>
  );
};

const AccordionMenu = ({ title, icon: Icon, children, activePath, isOpen, onToggle }) => {
  const pathname = usePathname();
  // Check if any child route is active
  const isActive = pathname.includes(activePath);

  return (
      <div className="mb-0">
          <button 
              onClick={onToggle}
              className={`w-full flex items-center justify-between px-3 py-2 text-[13px] transition-all ${isActive && !isOpen ? "bg-[#2271b1] text-white font-medium" : isActive && isOpen ? "bg-[#2271b1] text-white font-medium" : "hover:bg-[#2c3338] hover:text-[#72aee6] text-[#a7aaad]"}`}
          >
              <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : ""}`} />
                  <span>{title}</span>
              </div>
              <ChevronRight className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : ""} opacity-50`} />
          </button>
          
          {/* Accordion Submenu */}
          <div className={`bg-[#32373c] py-1 overflow-hidden transition-all duration-200 ${isOpen ? "block" : "hidden"}`}>
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
    if (pathname.includes("/admin/products")) setOpenAccordion("products");
    else if (pathname.includes("/admin/orders") || pathname.includes("/admin/customers") || pathname.includes("/admin/promotions") || pathname.includes("/admin/discounts") || pathname.includes("/admin/reviews")) setOpenAccordion("commerce");
    else if (pathname.includes("/admin/blogs")) setOpenAccordion("posts");
    else if (pathname.includes("/admin/pages")) setOpenAccordion("pages");
    else if (pathname.includes("/admin/settings/team") || pathname.includes("/admin/settings/roles")) setOpenAccordion("users");
    else if (pathname.includes("/admin/appearance")) setOpenAccordion("appearance");
    else if (pathname.includes("/admin/contact") || pathname.includes("/admin/settings/logs") || pathname.includes("/admin/settings/scripts")) setOpenAccordion("tools");
    else if (pathname.includes("/admin/settings/site")) setOpenAccordion("settings");
    else setOpenAccordion("");
  }, [pathname]);

  const handleToggle = (id) => {
    setOpenAccordion(prev => prev === id ? "" : id);
  };

  return (
    <aside className="w-[160px] bg-[#1d2327] text-[#f0f0f1] h-screen flex flex-col fixed left-0 top-0 z-50 font-sans border-r border-white/5 select-none shrink-0">
      {/* Scrollable Nav */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        <nav className="py-2">
           
           {/* Dashboard Accordion (simulated as standalone link but matches style) */}
           <div className="mb-0">
             <Link href="/admin" className={`flex items-center justify-between px-3 py-2 text-[13px] transition-all ${pathname === "/admin" || pathname === "/admin/analytics" ? "bg-[#2271b1] text-white font-medium" : "text-[#a7aaad] hover:bg-[#2c3338] hover:text-[#72aee6]"}`}>
                <div className="flex items-center gap-2">
                   <LayoutDashboard className="w-4 h-4" />
                   <span>Dashboard</span>
                </div>
             </Link>
             {(pathname === "/admin" || pathname === "/admin/analytics") && (
                <div className="bg-[#32373c] py-1">
                   <NavLink href="/admin" exact isSubmenu>Home</NavLink>
                   <NavLink href="/admin/analytics" isSubmenu>Analytics</NavLink>
                </div>
             )}
           </div>

           <div className="my-2 bg-[#ffffff1a] h-[1px] w-full" />

           {/* Posts (Blogs) */}
           <AccordionMenu 
              title="Posts" icon={FileText} activePath="/admin/blogs"
              isOpen={openAccordion === "posts"} onToggle={() => handleToggle("posts")}
           >
                <NavLink href="/admin/blogs" exact isSubmenu>All Posts</NavLink>
                <NavLink href="/admin/blogs/new" isSubmenu>Add New</NavLink>
                <NavLink href="/admin/blogs/categories" isSubmenu>Categories</NavLink>
           </AccordionMenu>

           {/* Media Standalone */}
            <div className="mb-0">
              <Link href="/admin/media" className={`flex items-center gap-2 px-3 py-2 text-[13px] transition-all ${pathname === "/admin/media" ? "bg-[#2271b1] text-white font-medium" : "text-[#a7aaad] hover:bg-[#2c3338] hover:text-[#72aee6]"}`}>
                  <ImageIcon className="w-4 h-4" />
                  <span>Media</span>
              </Link>
            </div>

           {/* Pages Accordion */}
           <AccordionMenu 
              title="Pages" icon={Layers} activePath="/admin/pages"
              isOpen={openAccordion === "pages"} onToggle={() => handleToggle("pages")}
           >
                <NavLink href="/admin/pages" exact isSubmenu>All Pages</NavLink>
                <NavLink href="/admin/pages/new" isSubmenu>Add New</NavLink>
           </AccordionMenu>

           {/* Comments / Reviews Standalone */}
           <div className="mb-0">
             <Link href="/admin/reviews" className={`flex items-center gap-2 px-3 py-2 text-[13px] transition-all ${pathname === "/admin/reviews" ? "bg-[#2271b1] text-white font-medium" : "text-[#a7aaad] hover:bg-[#2c3338] hover:text-[#72aee6]"}`}>
                <MessageSquare className="w-4 h-4" />
                <span>Reviews</span>
             </Link>
           </div>

           <div className="my-2 bg-[#ffffff1a] h-[1px] w-full" />

           {/* Commerce (WooCommerce eq) */}
           <AccordionMenu 
              title="Commerce" icon={ShoppingCart} activePath="/admin/orders"
              isOpen={openAccordion === "commerce"} onToggle={() => handleToggle("commerce")}
           >
                <NavLink href="/admin/orders" isSubmenu>Orders</NavLink>
                <NavLink href="/admin/customers" isSubmenu>Customers</NavLink>
                <NavLink href="/admin/promotions" isSubmenu>Promotions</NavLink>
                <NavLink href="/admin/discounts" isSubmenu>Coupons</NavLink>
           </AccordionMenu>

           {/* Products Accordion */}
           <AccordionMenu 
              title="Products" icon={Box} activePath="/admin/products"
              isOpen={openAccordion === "products"} onToggle={() => handleToggle("products")}
           >
                <NavLink href="/admin/products" exact isSubmenu>All Products</NavLink>
                <NavLink href="/admin/products/new" isSubmenu>Add New</NavLink>
                <NavLink href="/admin/categories" isSubmenu>Categories</NavLink>
           </AccordionMenu>

           <div className="my-2 bg-[#ffffff1a] h-[1px] w-full" />

           {/* Appearance Accordion */}
           <AccordionMenu 
              title="Appearance" icon={Palette} activePath="/admin/appearance"
              isOpen={openAccordion === "appearance"} onToggle={() => handleToggle("appearance")}
           >
                <NavLink href="/admin/appearance" exact isSubmenu>Themes</NavLink>
                <NavLink href="/admin/appearance/menus" isSubmenu>Menus</NavLink>
           </AccordionMenu>

           {/* Users Accordion */}
           <AccordionMenu 
              title="Users" icon={Users} activePath="/admin/settings/team"
              isOpen={openAccordion === "users"} onToggle={() => handleToggle("users")}
           >
                <NavLink href="/admin/settings/team" exact isSubmenu>All Users</NavLink>
                <NavLink href="/admin/settings/team/new" isSubmenu>Add New</NavLink>
                <NavLink href="/admin/settings/roles" isSubmenu>Roles</NavLink>
           </AccordionMenu>

           {/* Tools Accordion */}
           <AccordionMenu 
              title="Tools" icon={Wrench} activePath="/admin/contact"
              isOpen={openAccordion === "tools"} onToggle={() => handleToggle("tools")}
           >
                <NavLink href="/admin/contact" isSubmenu>Contact Forms</NavLink>
                <NavLink href="/admin/settings/logs" isSubmenu>Audit Logs</NavLink>
                <NavLink href="/admin/settings/scripts" isSubmenu>Custom Scripts</NavLink>
           </AccordionMenu>

           {/* Settings Accordion */}
           <AccordionMenu 
              title="Settings" icon={Settings} activePath="/admin/settings/site"
              isOpen={openAccordion === "settings"} onToggle={() => handleToggle("settings")}
           >
                <NavLink href="/admin/settings/site" isSubmenu>General</NavLink>
           </AccordionMenu>

        </nav>
      </div>

      {/* Logout Footer (Like WP Collapse Menu but we do logout here) */}
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
        .custom-scrollbar::-webkit-scrollbar-thumb {
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

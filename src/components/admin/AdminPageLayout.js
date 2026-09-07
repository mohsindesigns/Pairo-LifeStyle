"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export default function AdminPageLayout({
  title,
  subtitle,
  addNewLink,
  addNewLabel = "Add New",
  breadcrumbs = [],
  children
}) {
  return (
    <div className="bg-[#f0f2f1] min-h-screen p-3 sm:p-4 md:p-6 font-sans text-[#2c3338] min-w-0">
      <div className="w-full min-w-0 space-y-4 md:space-y-6">

        {/* Breadcrumbs */}
        <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#646970] mb-2">
           <Link href="/admin" className="hover:text-[#2271b1] flex items-center gap-1">
              <Home className="w-3 h-3" />
              Dashboard
           </Link>
           {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                 <ChevronRight className="w-3 h-3 text-[#c3c4c7]" />
                 {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-[#2271b1]">{crumb.label}</Link>
                 ) : (
                    <span className="text-[#1d2327] font-medium">{crumb.label}</span>
                 )}
              </React.Fragment>
           ))}
        </nav>

        {/* Page Header */}
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 border-b border-[#ccd0d4] pb-3 md:pb-4">
           <div className="flex flex-col xs:flex-row xs:items-baseline gap-1 xs:gap-3 min-w-0">
              <h1 className="text-[23px] font-normal text-[#1d2327] break-words">{title}</h1>
              {subtitle && <span className="text-[13px] text-[#646970]">{subtitle}</span>}
           </div>
            {addNewLink && (
               typeof addNewLink === "function" ? (
                 <button
                   type="button"
                   onClick={addNewLink}
                   className="self-start xs:self-auto shrink-0 bg-white border border-[#2271b1] text-[#2271b1] px-3 py-1.5 xs:py-1 rounded-[3px] text-[13px] font-bold hover:bg-[#f0f6fb] transition-all shadow-sm cursor-pointer"
                 >
                   {addNewLabel}
                 </button>
               ) : (
                 <Link
                   href={addNewLink}
                   className="self-start xs:self-auto shrink-0 bg-white border border-[#2271b1] text-[#2271b1] px-3 py-1.5 xs:py-1 rounded-[3px] text-[13px] font-bold hover:bg-[#f0f6fb] transition-all shadow-sm"
                 >
                   {addNewLabel}
                 </Link>
               )
            )}
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in duration-500 min-w-0">
           {children}
        </div>
      </div>
    </div>
  );
}

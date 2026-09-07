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
    <div className="bg-[#f0f2f1] min-h-screen p-2 xs:p-3 sm:p-4 md:p-6 font-sans text-[#2c3338] min-w-0 max-w-full overflow-x-clip">
      <div className="w-full min-w-0 space-y-3 sm:space-y-4 md:space-y-6">

        {/* Breadcrumbs */}
        <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] sm:text-[12px] text-[#646970] mb-1 sm:mb-2">
           <Link href="/admin" className="hover:text-[#2271b1] flex items-center gap-1 shrink-0">
              <Home className="w-3 h-3" />
              Dashboard
           </Link>
           {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                 <ChevronRight className="w-2.5 h-2.5 text-[#c3c4c7] shrink-0" />
                 {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-[#2271b1] truncate max-w-[120px] xs:max-w-none">{crumb.label}</Link>
                 ) : (
                    <span className="text-[#1d2327] font-medium truncate max-w-[120px] xs:max-w-none">{crumb.label}</span>
                 )}
              </React.Fragment>
           ))}
        </nav>

        {/* Page Header */}
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 xs:gap-3 border-b border-[#ccd0d4] pb-2.5 xs:pb-3 md:pb-4 min-w-0">
           <div className="flex flex-col xs:flex-row xs:items-baseline gap-1 xs:gap-3 min-w-0">
              <h1 className="text-[17px] xs:text-[20px] sm:text-[23px] font-normal text-[#1d2327] break-words leading-tight">{title}</h1>
              {subtitle && <span className="text-[11px] sm:text-[13px] text-[#646970] break-words">{subtitle}</span>}
           </div>
            {addNewLink && (
               typeof addNewLink === "function" ? (
                 <button
                   type="button"
                   onClick={addNewLink}
                   className="self-start xs:self-auto shrink-0 bg-white border border-[#2271b1] text-[#2271b1] px-2.5 py-1 rounded-[3px] text-[12px] font-bold hover:bg-[#f0f6fb] transition-all shadow-sm cursor-pointer"
                 >
                   {addNewLabel}
                 </button>
               ) : (
                 <Link
                   href={addNewLink}
                   className="self-start xs:self-auto shrink-0 bg-white border border-[#2271b1] text-[#2271b1] px-2.5 py-1 rounded-[3px] text-[12px] font-bold hover:bg-[#f0f6fb] transition-all shadow-sm"
                 >
                   {addNewLabel}
                 </Link>
               )
            )}
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in duration-300 min-w-0 max-w-full">
           {children}
        </div>
      </div>
    </div>
  );
}

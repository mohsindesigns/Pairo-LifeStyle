"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function AdminPageLayout({
  title,
  subtitle,
  addNewLink,
  addNewLabel = "Add New",
  breadcrumbs = [],
  children
}) {
  return (
    <div className="wp-page min-w-0 max-w-full overflow-x-clip">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1 gap-y-1 pt-2 text-[13px] text-[#646970]">
        <Link href="/admin" className="wp-link shrink-0">
          Dashboard
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            <ChevronRight className="w-3 h-3 text-[#8c8f94] shrink-0" aria-hidden="true" />
            {crumb.href ? (
              <Link href={crumb.href} className="wp-link truncate max-w-[160px] sm:max-w-none">{crumb.label}</Link>
            ) : (
              <span aria-current="page" className="text-[#3c434a] truncate max-w-[160px] sm:max-w-none">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Page Header */}
      <div className="wp-page-head min-w-0">
        <h1 className="break-words">{title}</h1>
        {addNewLink && (
          typeof addNewLink === "function" ? (
            <button type="button" onClick={addNewLink} className="wp-btn">
              {addNewLabel}
            </button>
          ) : (
            <Link href={addNewLink} className="wp-btn">
              {addNewLabel}
            </Link>
          )
        )}
        {subtitle && <p className="w-full m-0 text-[13px] text-[#646970] break-words">{subtitle}</p>}
      </div>

      {/* Content Area */}
      <div className="min-w-0 max-w-full">
        {children}
      </div>
    </div>
  );
}

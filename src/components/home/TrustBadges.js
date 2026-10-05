"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import * as LucideIcons from "lucide-react";
import { ChevronLeft, ChevronRight, Shield, Truck, Package, Globe, UserCheck, Star } from "lucide-react";

export default function TrustBadges({
  items: propItems,
}) {
  const scrollContainerRef = useRef(null);

  const defaultItems = [
    {
      title: "Real Lambskin",
      description: "Leather",
      icon: "Shield"
    },
    {
      title: "Free Shipping",
      description: "World Wide",
      icon: "Truck"
    },
    {
      title: "30 Days",
      description: "Easy Returns",
      icon: "Package"
    },
    {
      title: "35+ Countries",
      description: "Covered",
      icon: "Globe"
    },
    {
      title: "25k+ Customer",
      description: "Served",
      icon: "UserCheck"
    },
    {
      title: "2k+ Customer",
      description: "Reviews",
      icon: "Star"
    }
  ];

  const items = Array.isArray(propItems) && propItems.length > 0 ? propItems : defaultItems;
  const isOverflowing = items.length > 6;

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -260, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 260, behavior: "smooth" });
    }
  };

  return (
    <section className="container mx-auto px-2 sm:px-4 md:px-8 my-4 md:my-6 select-none">
      <div className="bg-white border border-black/[0.07] rounded-[24px] md:rounded-[32px] shadow-sm py-6 md:py-8 px-4 sm:px-6 md:px-8 relative overflow-hidden">
        {/* Navigation buttons for overflowing items on desktop */}
        {isOverflowing && (
          <>
            <button
              type="button"
              onClick={scrollLeft}
              aria-label="Previous"
              className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-black hover:scale-105 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={scrollRight}
              aria-label="Next"
              className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-black hover:scale-105 active:scale-95 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Badges Container */}
        <div
          ref={scrollContainerRef}
          className={`flex items-center no-scrollbar scroll-smooth ${
            isOverflowing
              ? "overflow-x-auto justify-start gap-4 md:gap-8 snap-x snap-mandatory px-4"
              : "overflow-x-auto sm:overflow-visible justify-between w-full"
          }`}
        >
          {items.map((item, index) => {
            if (!item) return null;

            const title = typeof item.title === "string" ? item.title.trim() : "";
            const description = typeof item.description === "string" ? item.description.trim() : "";
            const hasCustomIcon = Boolean(item.customIcon && typeof item.customIcon === "string" && item.customIcon.trim().length > 0);
            const iconName = item.icon && typeof item.icon === "string" ? item.icon.trim() : null;
            const IconComponent = (iconName && LucideIcons[iconName]) ? LucideIcons[iconName] : Shield;
            const linkHref = item.link && typeof item.link === "string" && item.link.trim().length > 0 ? item.link.trim() : null;
            const hasDivider = index !== items.length - 1;

            const badgeContent = (
              <div className="flex flex-col items-center text-center px-2 sm:px-4 py-2 group flex-1 min-w-[125px] sm:min-w-0 transition-transform duration-300 hover:-translate-y-0.5">
                {/* Icon wrapper */}
                <div className="w-12 h-12 mb-2 flex items-center justify-center text-neutral-800 transition-colors duration-300 group-hover:text-black">
                  {hasCustomIcon ? (
                    <div className="relative w-9 h-9 sm:w-10 sm:h-10">
                      <Image
                        src={item.customIcon.trim()}
                        alt={title || "Badge icon"}
                        fill
                        className="object-contain"
                        sizes="40px"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <IconComponent className="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.25] text-neutral-800 group-hover:stroke-[1.5] transition-all" />
                  )}
                </div>

                {/* Title */}
                {title ? (
                  <h4 className="text-[13px] sm:text-[14px] font-bold text-neutral-900 tracking-tight leading-tight uppercase">
                    {title}
                  </h4>
                ) : (
                  <span className="text-[12px] text-neutral-400 italic">No Title</span>
                )}

                {/* Description / Subtitle */}
                {description && (
                  <p className="text-[11px] sm:text-[12px] text-neutral-500 font-normal tracking-normal mt-0.5">
                    {description}
                  </p>
                )}
              </div>
            );

            return (
              <React.Fragment key={index}>
                {linkHref ? (
                  <Link href={linkHref} className="flex-1 block focus:outline-none focus:ring-1 focus:ring-black">
                    {badgeContent}
                  </Link>
                ) : (
                  badgeContent
                )}

                {/* Vertical Divider */}
                {hasDivider && (
                  <div className="hidden sm:block h-10 w-[1px] bg-black/[0.08] flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

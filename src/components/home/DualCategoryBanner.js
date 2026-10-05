"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function DualCategoryBanner({
  banners: propBanners
}) {
  const defaultBanners = [
    {
      image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&auto=format&fit=crop",
      heading: "TV SERIES OUTFITS",
      buttonText: "SHOP NOW",
      link: "/shop"
    },
    {
      image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200&auto=format&fit=crop",
      heading: "MOVIES OUTFIT",
      buttonText: "SHOP NOW",
      link: "/shop"
    }
  ];

  const banners = (Array.isArray(propBanners) && propBanners.length > 0)
    ? propBanners
    : defaultBanners;

  if (!banners || banners.length === 0) return null;

  return (
    <section className="w-full py-4 md:py-6 bg-white">
      <div className="container mx-auto px-4 md:px-8">
        <div className={`grid grid-cols-1 ${banners.length > 1 ? "md:grid-cols-2" : ""} gap-4 md:gap-6`}>
          {banners.map((banner, index) => {
            if (!banner) return null;

            const headingText = (typeof banner.heading === "string") ? banner.heading.trim() : "";
            const buttonText = (typeof banner.buttonText === "string") ? banner.buttonText.trim() : "";
            const hasHeading = headingText.length > 0;
            const hasButton = buttonText.length > 0;
            const hasOverlayContent = hasHeading || hasButton;
            const hasImage = Boolean(banner.image && typeof banner.image === "string" && banner.image.trim().length > 0);
            const linkHref = (banner.link && typeof banner.link === "string" && banner.link.trim().length > 0)
              ? banner.link.trim()
              : null;

            const cardInner = (
              <div className="relative w-full h-[300px] sm:h-[380px] md:h-[440px] lg:h-[500px] overflow-hidden rounded-md group bg-neutral-900 shadow-sm">
                {/* Banner Image */}
                {hasImage ? (
                  <Image
                    src={banner.image.trim()}
                    alt={hasHeading ? headingText : `Category banner ${index + 1}`}
                    fill
                    className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority={index === 0}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-800 text-neutral-400 text-xs uppercase tracking-widest gap-2">
                    <span>No Image Uploaded</span>
                    <span className="text-[10px] text-neutral-500 lowercase">(Upload via page builder)</span>
                  </div>
                )}

                {/* Bottom Shadow Gradient (Only rendered if heading OR button is provided) */}
                {hasOverlayContent && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none transition-opacity duration-300" />
                )}

                {/* Bottom Center Content (Strictly hidden if neither heading nor button is provided) */}
                {hasOverlayContent && (
                  <div className="absolute inset-x-0 bottom-6 sm:bottom-8 md:bottom-10 flex flex-col items-center justify-center text-center px-4 z-10 pointer-events-auto">
                    {/* Heading - strictly conditional */}
                    {hasHeading && (
                      <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white uppercase tracking-wider mb-3 md:mb-4 drop-shadow-md leading-tight max-w-[90%]">
                        {headingText}
                      </h3>
                    )}

                    {/* Button - strictly conditional */}
                    {hasButton && (
                      <span className="inline-block border border-[#c5a880] text-[#c5a880] hover:bg-[#c5a880] hover:text-black transition-all duration-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] px-5 sm:px-7 py-2 sm:py-2.5 rounded-none shadow-sm group-hover:border-white group-hover:text-white">
                        {buttonText}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );

            if (linkHref) {
              return (
                <Link
                  key={index}
                  href={linkHref}
                  className="block w-full focus:outline-none focus:ring-2 focus:ring-[#c5a880] rounded-md"
                >
                  {cardInner}
                </Link>
              );
            }

            return <div key={index} className="w-full">{cardInner}</div>;
          })}
        </div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";

export default function MarqueeSection({ items: propItems, speed = 35, className = "" }) {
  const defaultItems = [
    { text: "ELITE SHEARLING COLLECTION", icon: "Star" },
    { text: "HANDCRAFTED LUXURY", icon: "Star" },
    { text: "PAIRO EST. 2024", icon: "Star" },
    { text: "GENUINE SHEEPSKIN", icon: "Star" },
    { text: "GLOBAL SHIPPING", icon: "Star" },
    { text: "LIMITED EDITION", icon: "Star" }
  ];

  // Map to support legacy array-of-strings fallback as well as new array-of-objects structure
  const rawItems = propItems && propItems.length > 0 ? propItems : defaultItems;
  const items = rawItems.map(item => {
    if (typeof item === "string") {
      return { text: item, icon: "Star" };
    }
    return {
      text: item?.text || "",
      icon: item?.icon || "Star"
    };
  });

  return (
    <div className={`absolute bottom-0 left-0 w-full z-30 pointer-events-none ${className}`}>
      <div className="bg-white/90 backdrop-blur-md border-t border-black/5 py-3.5 overflow-hidden flex items-center">
        <motion.div 
          animate={{ x: [0, -1000] }}
          transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
          className="flex whitespace-nowrap"
        >
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex">
              {items.map((item, idx) => {
                const IconComponent = LucideIcons[item.icon] || LucideIcons.Star;
                return (
                  <div key={idx} className="flex items-center gap-8 px-12">
                    <span className="text-[10px] md:text-xs font-bold heading-font text-black uppercase tracking-[0.4em]">
                      {item.text}
                    </span>
                    <IconComponent className="w-3 h-3 md:w-4 md:h-4 text-black fill-black opacity-20" />
                  </div>
                );
              })}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

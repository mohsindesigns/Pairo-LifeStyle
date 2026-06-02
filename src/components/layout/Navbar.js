"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingCart, User, Menu, X, ChevronDown, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import logo from '../../assets/png-file.png';
import SearchModal from "./SearchModal";
import { useCart } from "@/context/CartContext";
import { useSiteData } from "@/context/SiteContext";

/**
 * Resolves a nav item href based on its type and value.
 */
function resolveNavHref(item, dbPages, dbCategories, dbProducts) {
  switch (item.type) {
    case 'product': {
      const product = dbProducts?.find(p => p._id?.toString() === item.value || p.slug === item.value);
      return product ? `/product/${product.slug}` : (item.href || item.value || '#');
    }
    case 'page': {
      // Value is a page slug or _id; find the actual slug
      const page = dbPages?.find(p => p._id?.toString() === item.value || p.slug === item.value);
      return page ? `/${page.slug}` : (item.href || item.value || '#');
    }
    case 'product_category': {
      return `/shop?category=${item.value}`;
    }
    case 'external_url':
    case 'custom_url':
    case 'mega_menu':
    case 'dropdown_category':
    case 'dropdown_product':
    default:
      return item.value || item.href || '#';
  }
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeOffer, setActiveOffer] = useState(0);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [mobileDropdowns, setMobileDropdowns] = useState({});
  const [mounted, setMounted] = useState(false);

  const siteData = useSiteData();
  const { data: session } = useSession();
  const { cartCount } = useCart();

  // --- Resolve dynamic data ---
  const dbCategories = siteData?._dbCategories || [];
  const dbPages = siteData?._dbPages || [];
  const dbProducts = siteData?._dbProducts || [];

  // Top offer bar - prefer new headerConfig, fallback to legacy
  const offers = useMemo(() => {
    const newOffers = siteData?.headerConfig?.topOffers;
    const legacyOffers = siteData?.navigation?.offers;
    return (newOffers?.length > 0 ? newOffers : legacyOffers) || ["Welcome to Pairo Store"];
  }, [siteData]);

  // Navigation menu items - prefer new headerConfig.navItems, fallback to legacy links
  const navItems = useMemo(() => {
    const newItems = siteData?.headerConfig?.navItems;
    if (newItems && newItems.length > 0) {
      return newItems
        .filter(item => item.enabled !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(item => {
          const isMega = item.type === 'mega_menu';
          
          let itemMegaCategories = [];
          if (isMega) {
            const itemMegaCategoryIds = item.megaCategoryIds || [];
            if (itemMegaCategoryIds.length > 0) {
              itemMegaCategories = itemMegaCategoryIds.map(slug => dbCategories.find(c => c.slug === slug)).filter(Boolean);
            } else {
              itemMegaCategories = siteData?.categories?.items || dbCategories.slice(0, 3);
            }
          }

          let itemDropdownCategories = [];
          if (item.type === 'dropdown_category') {
             const dropdownCategoryIds = item.dropdownCategoryIds || [];
             itemDropdownCategories = dropdownCategoryIds.map(slug => dbCategories.find(c => c.slug === slug)).filter(Boolean);
          }

          let itemDropdownProducts = [];
          if (item.type === 'dropdown_product') {
             const dropdownProductIds = item.dropdownProductIds || [];
             itemDropdownProducts = dropdownProductIds.map(id => dbProducts.find(p => p._id === id)).filter(Boolean);
          }

          return {
            ...item,
            name: item.label,
            href: resolveNavHref(item, dbPages, dbCategories, dbProducts),
            openInNewTab: item.type === 'external_url' ? true : (item.openInNewTab || false),
            itemMegaCategories,
            itemDropdownCategories,
            itemDropdownProducts,
            subItems: (item.subItems || [])
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map(sub => ({
                ...sub,
                name: sub.label,
                href: resolveNavHref(sub, dbPages, dbCategories, dbProducts),
                openInNewTab: sub.type === 'external_url' ? true : (sub.openInNewTab || false),
              }))
          };
        });
    }
    // Legacy fallback
    return (siteData?.navigation?.links || []).map(l => ({
      ...l,
      name: l.name,
      href: l.href,
      dropdownType: l.hasMegaMenu ? 'mega' : 'none',
      subItems: [],
      itemMegaCategories: siteData?.categories?.items || dbCategories.slice(0, 3),
      openInNewTab: false,
    }));
  }, [siteData, dbPages, dbCategories]);

  // Header logo
  const headerLogoUrl = siteData?.headerConfig?.logoUrl;

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });

    if (offers.length > 0) {
      const offerInterval = setInterval(() => {
        setActiveOffer(prev => (prev + 1) % offers.length);
      }, 4000);
      return () => {
        window.removeEventListener("scroll", handleScroll);
        clearInterval(offerInterval);
      };
    }
    return () => window.removeEventListener("scroll", handleScroll);
  }, [offers]);

  return (
    <>
      {/* Top Carousel Banner */}
      <div className="bg-black text-white text-center py-2 text-xs md:text-sm font-medium relative overflow-hidden h-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeOffer}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center font-sans tracking-wide px-4"
          >
            {offers[activeOffer]}
          </motion.div>
        </AnimatePresence>
      </div>

      <header
        className={`sticky top-0 z-50 w-full transition-all duration-500 border-b border-black/5 h-20 md:h-24 flex items-center ${
          scrolled ? "bg-white/90 backdrop-blur-xl shadow-sm" : "bg-white"
        }`}
      >
        <div className="container mx-auto px-6 md:px-16">
          <nav className="flex items-center justify-between">
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center">
                {headerLogoUrl ? (
                  <img src={headerLogoUrl} alt="Logo" width={110} height={40} className="object-contain h-10 w-auto" />
                ) : (
                  <Image src={logo} alt="Pairo Logo" width={110} height={40} className="object-contain" priority />
                )}
              </Link>
            </div>

            <div className="hidden lg:flex flex-1 justify-center items-center space-x-12">
              {navItems.map((item) => {
                const hasDropdown = ['mega_menu', 'dropdown_category', 'dropdown_product', 'dropdown_custom'].includes(item.type) || item.dropdownType === 'simple' || item.dropdownType === 'mega';
                const isDropdownActive = activeDropdownId === (item.id || item.name);
                return (
                  <div
                    key={item.id || item.name}
                    className="relative group h-24 flex items-center"
                    onMouseEnter={() => hasDropdown && setActiveDropdownId(item.id || item.name)}
                    onMouseLeave={() => hasDropdown && setActiveDropdownId(null)}
                  >
                    <Link
                      href={item.href}
                      target={item.openInNewTab ? '_blank' : undefined}
                      rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                      className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/60 hover:text-black transition-colors flex items-center gap-2"
                    >
                      {item.name}
                      {hasDropdown && <ChevronDown className="w-3 h-3" />}
                    </Link>

                    {/* Simple Sub Items */}
                    {(item.type === 'dropdown_custom' || item.dropdownType === 'simple') && item.subItems?.length > 0 && (
                      <AnimatePresence>
                        {isDropdownActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 pt-0 min-w-[220px]"
                          >
                            <div className="bg-white border border-black/5 shadow-2xl rounded-b-[20px] py-4">
                              {item.subItems.map((sub) => (
                                <Link
                                  key={sub.id || sub.name}
                                  href={sub.href}
                                  target={sub.openInNewTab ? '_blank' : undefined}
                                  rel={sub.openInNewTab ? 'noopener noreferrer' : undefined}
                                  className="block px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-black/60 hover:text-black hover:bg-black/[0.02] transition-colors"
                                >
                                  {sub.name}
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}

                    {/* Category List */}
                    {item.type === 'dropdown_category' && item.itemDropdownCategories?.length > 0 && (
                      <AnimatePresence>
                        {isDropdownActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 pt-0 min-w-[220px]"
                          >
                            <div className="bg-white border border-black/5 shadow-2xl rounded-b-[20px] py-4">
                              {item.itemDropdownCategories.map((cat) => (
                                <Link
                                  key={cat.slug}
                                  href={`/shop?category=${cat.slug}`}
                                  className="block px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-black/60 hover:text-black hover:bg-black/[0.02] transition-colors"
                                >
                                  {cat.name}
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}

                    {/* Product List */}
                    {item.type === 'dropdown_product' && item.itemDropdownProducts?.length > 0 && (
                      <AnimatePresence>
                        {isDropdownActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 pt-0 min-w-[220px]"
                          >
                            <div className="bg-white border border-black/5 shadow-2xl rounded-b-[20px] py-4">
                              {item.itemDropdownProducts.map((prod) => (
                                <Link
                                  key={prod._id}
                                  href={`/product/${prod.slug}`}
                                  className="block px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-black/60 hover:text-black hover:bg-black/[0.02] transition-colors truncate"
                                >
                                  {prod.name || prod.title}
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}

                    {/* Mega Menu */}
                    {(item.type === 'mega_menu' || item.dropdownType === 'mega') && (
                      <AnimatePresence>
                        {isDropdownActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-1/2 -translate-x-1/2 pt-0 w-max max-w-[95vw] xl:max-w-[1200px]"
                          >
                            <div className="bg-white border border-black/5 shadow-2xl rounded-b-[40px] p-10 flex flex-wrap justify-center gap-10 max-h-[80vh] overflow-y-auto">
                              {(item.itemMegaCategories || []).map((cat) => (
                                <Link key={cat.slug || cat.name} href={`/shop?category=${cat.slug}`} className="group/item flex-1 min-w-[200px] max-w-[280px]">
                                  <div className="relative aspect-[4/5] rounded-[24px] overflow-hidden mb-5 bg-[#F9F9F9]">
                                    <Image src={cat.image || '/placeholder.jpg'} alt={cat.name} fill className="object-cover transition-transform duration-1000 group-hover/item:scale-110" />
                                  </div>
                                  <h4 className="font-bold uppercase tracking-[0.2em] text-[10px] text-center">{cat.name}</h4>
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center space-x-2 md:space-x-4">
              <button onClick={() => setSearchOpen(true)} className="p-3 hover:bg-black/5 rounded-full transition-all">
                <Search className="w-5 h-5" />
              </button>

              <Link href="/cart" className="p-3 relative hover:bg-black/5 rounded-full transition-all">
                <ShoppingCart className="w-5 h-5" />
                {mounted && cartCount > 0 && (
                  <span className="absolute top-2 right-2 bg-black text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </Link>

              <Link
                href={mounted && session ? "/profile" : "/login"}
                className="hidden lg:flex items-center gap-3 p-2 pr-4 hover:bg-black/5 rounded-full transition-all group"
              >
                <div className="w-9 h-9 bg-black text-white rounded-full flex items-center justify-center">
                  {mounted && session ? (
                    <span className="text-xs font-bold uppercase">{session.user.name?.charAt(0) || 'U'}</span>
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                {mounted && !session && <span className="text-[10px] font-bold uppercase tracking-widest text-black/60 group-hover:text-black">Login</span>}
              </Link>

              <button className="lg:hidden p-3 hover:bg-black/5 rounded-full" onClick={() => setIsOpen(true)}>
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed inset-0 z-[100] bg-white flex flex-col h-full lg:hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-black/5">
              <Link href="/" onClick={() => setIsOpen(false)}>
                {headerLogoUrl ? (
                  <img src={headerLogoUrl} alt="Logo" width={100} height={35} className="object-contain h-9 w-auto" />
                ) : (
                  <Image src={logo} alt="Logo" width={100} height={35} />
                )}
              </Link>
              <button onClick={() => setIsOpen(false)} className="p-3 bg-black/5 rounded-full"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto pt-8 pb-4 scrollbar-hide">
              <nav className="flex flex-col">
                {navItems.map((item) => {
                  const isMobileActive = !!mobileDropdowns[item.id || item.name];
                  const hasDropdown = ['mega_menu', 'dropdown_category', 'dropdown_product', 'dropdown_custom'].includes(item.type) || item.dropdownType === 'simple' || item.dropdownType === 'mega';
                  return (
                    <div key={item.id || item.name} className="px-6 mb-8">
                      {hasDropdown ? (
                        <div>
                          <button
                            onClick={() => toggleMobileDropdown(item.id || item.name)}
                            className="w-full text-xl font-bold uppercase tracking-tighter flex items-center justify-between"
                          >
                            {item.name}
                            <ChevronDown className={`w-5 h-5 transition-transform ${isMobileActive ? "rotate-180" : ""}`} />
                          </button>
                          
                          <AnimatePresence>
                            {isMobileActive && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden mt-4 pl-4"
                              >
                                {item.dropdownType === 'simple' && (
                                  <div className="flex flex-col gap-4 py-2 border-l border-black/5">
                                    {item.subItems.map((sub) => (
                                      <Link
                                        key={sub.id || sub.name}
                                        href={sub.href}
                                        target={sub.openInNewTab ? '_blank' : undefined}
                                        onClick={() => setIsOpen(false)}
                                        className="text-lg font-bold text-black/60 hover:text-black uppercase tracking-wide block"
                                      >
                                        {sub.name}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                                
                                {item.dropdownType === 'mega' && (
                                  <div className="grid grid-cols-2 gap-4 mt-4">
                                    {item.itemMegaCategories.map((cat) => (
                                      <Link key={cat.slug || cat.name} href={`/shop?category=${cat.slug}`} onClick={() => setIsOpen(false)}>
                                        <div className="relative aspect-square rounded-[20px] overflow-hidden bg-black/5">
                                          <Image src={cat.image || '/placeholder.jpg'} alt={cat.name} fill className="object-cover" />
                                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-2">
                                            <p className="text-white font-bold text-[8px] uppercase tracking-widest text-center">{cat.name}</p>
                                          </div>
                                        </div>
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          target={item.openInNewTab ? '_blank' : undefined}
                          onClick={() => setIsOpen(false)}
                          className="text-xl font-bold uppercase tracking-tighter block"
                        >
                          {item.name}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            <div className="p-8 bg-white border-t border-black/5">
              <Link
                href={mounted && session ? "/profile" : "/login"}
                onClick={() => setIsOpen(false)}
                className="w-full bg-black text-white flex items-center justify-center gap-4 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px]"
              >
                {mounted && session ? (
                  <><User className="w-4 h-4" /> Profile</>
                ) : (
                  <><LogIn className="w-4 h-4" /> Sign In</>
                )}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

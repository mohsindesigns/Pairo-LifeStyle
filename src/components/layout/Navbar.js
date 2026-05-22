"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingCart, User, Menu, X, ChevronDown, LogIn, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import logo from '../../assets/png-file.png';
import SearchModal from "./SearchModal";
import { useCart } from "@/context/CartContext";
import { useSiteData } from "@/context/SiteContext";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeOffer, setActiveOffer] = useState(0);
  const [showMegaMenu, setShowMegaMenu] = useState(false);
  const [mobileShopOpen, setMobileShopOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const siteData = useSiteData();
  const { data: session } = useSession();
  const { cartCount, setIsCartOpen } = useCart();

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    if (siteData?.navigation?.offers?.length > 0) {
      const offerInterval = setInterval(() => {
        setActiveOffer((prev) => (prev + 1) % siteData.navigation.offers.length);
      }, 4000);
      return () => {
        window.removeEventListener("scroll", handleScroll);
        clearInterval(offerInterval);
      };
    }
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, [siteData]);

  // Provide a stable structure even during loading to prevent layout shift
  const navLinks = siteData?.navigation?.links || [];
  const offers = siteData?.navigation?.offers || ["Welcome to Pairo Store"];
  const categoriesItems = siteData?.categories?.items || [];

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
                <Image src={logo} alt="Pairo Logo" width={110} height={40} className="object-contain" priority />
              </Link>
            </div>

            <div className="hidden lg:flex flex-1 justify-center items-center space-x-12">
              {navLinks.map((link) => (
                <div
                  key={link.name}
                  className="relative group h-24 flex items-center"
                  onMouseEnter={() => link.hasMegaMenu && setShowMegaMenu(true)}
                  onMouseLeave={() => link.hasMegaMenu && setShowMegaMenu(false)}
                >
                  <Link
                    href={link.href}
                    className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/60 hover:text-black transition-colors flex items-center gap-2"
                  >
                    {link.name}
                    {link.hasMegaMenu && <ChevronDown className="w-3 h-3" />}
                  </Link>

                  {link.hasMegaMenu && (
                    <AnimatePresence>
                      {showMegaMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute top-full left-1/2 -translate-x-1/2 pt-0 w-[800px]"
                        >
                          <div className="bg-white border border-black/5 shadow-2xl rounded-b-[40px] p-10 grid grid-cols-3 gap-10">
                            {categoriesItems.map((cat) => (
                              <Link key={cat.name} href={`/shop?category=${cat.slug}`} className="group/item">
                                <div className="relative aspect-[4/5] rounded-[24px] overflow-hidden mb-5 bg-[#F9F9F9]">
                                  <Image src={cat.image} alt={cat.name} fill className="object-cover transition-transform duration-1000 group-hover/item:scale-110" />
                                </div>
                                <h4 className="font-bold uppercase tracking-[0.2em] text-[10px]">{cat.name} Collection</h4>
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              ))}
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
                    <span className="text-xs font-bold uppercase">{session.user.name.charAt(0)}</span>
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
                <Image src={logo} alt="Logo" width={100} height={35} />
              </Link>
              <button onClick={() => setIsOpen(false)} className="p-3 bg-black/5 rounded-full"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto pt-8 pb-4 scrollbar-hide">
              <nav className="flex flex-col">
                {navLinks.map((link) => (
                  <div key={link.name} className="px-6 mb-8">
                    {link.hasMegaMenu ? (
                      <div>
                        <button onClick={() => setMobileShopOpen(!mobileShopOpen)} className="w-full text-xl font-bold uppercase tracking-tighter flex items-center justify-between">
                          {link.name}
                          <ChevronDown className={`w-5 h-5 transition-transform ${mobileShopOpen ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                          {mobileShopOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="overflow-hidden mt-8 grid grid-cols-2 gap-4">
                              {categoriesItems.map((cat) => (
                                <Link key={cat.name} href={`/shop?category=${cat.slug}`} onClick={() => setIsOpen(false)}>
                                  <div className="relative aspect-square rounded-[20px] overflow-hidden bg-black/5">
                                    <Image src={cat.image} alt={cat.name} fill className="object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-2">
                                      <p className="text-white font-bold text-[8px] uppercase tracking-widest text-center">{cat.name}</p>
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <Link href={link.href} onClick={() => setIsOpen(false)} className="text-xl font-bold uppercase tracking-tighter block">{link.name}</Link>
                    )}
                  </div>
                ))}
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

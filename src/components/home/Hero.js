"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import MarqueeSection from "./MarqueeSection";
import { useSiteData } from "@/context/SiteContext";

export default function Hero({
  slides: propSlides,
  brand: propBrand,
  labels: propLabels,
  marqueeItems: propMarqueeItems
}) {
  const siteData = useSiteData();

  // Use props if available (Page Builder mode), otherwise fallback to SiteContext (Legacy mode)
  const heroData = {
    hero: {
      slides: propSlides || siteData?.hero?.slides || [],
      labels: propLabels || siteData?.hero?.labels || { viewCollection: "View Collection" },
      marqueeItems: propMarqueeItems || siteData?.hero?.marqueeItems || []
    },
    brand: propBrand || siteData?.brand || { tagline: "Premium Shearling" }
  };

  const { hero, brand } = heroData;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const nextSlide = () => {
    if (!hero.slides.length) return;
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % hero.slides.length);
  };

  const prevSlide = () => {
    if (!hero.slides.length) return;
    setDirection(-1);
    setCurrentSlide((prev) => (prev === 0 ? hero.slides.length - 1 : prev - 1));
  };

  useEffect(() => {
    if (!hero.slides.length) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentSlide((prev) => (prev + 1) % hero.slides.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [hero.slides.length]);

  if (!siteData && !propSlides) return <div className="h-[650px] bg-black/5 rounded-[40px] m-8 animate-pulse" />;

  const slideVariants = {
    initial: (direction) => ({ x: direction > 0 ? "20%" : "-20%", opacity: 0 }),
    animate: { x: 0, opacity: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
    exit: (direction) => ({ x: direction > 0 ? "-20%" : "20%", opacity: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }),
  };

  return (
    <section className="relative h-[550px] md:h-[650px] lg:h-[750px] overflow-hidden mx-4 md:mx-8 my-6 rounded-[32px] md:rounded-[40px] shadow-2xl bg-black">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div key={currentSlide} custom={direction} variants={slideVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0">
          <div className="absolute inset-0">
            <Image src={hero.slides[currentSlide].image} alt={hero.slides[currentSlide].title} fill className="object-cover object-right md:object-center brightness-[0.9]" priority />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent md:from-black/70 md:via-black/20" />
          <div className="container mx-auto px-6 md:px-16 h-full flex items-center relative z-10">
            <div className="max-w-2xl">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }} className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-3"><div className="h-[1.5px] w-8 bg-white/30" /><span className="text-white/90 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase">{brand.tagline}</span></div>
                <p className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white heading-font leading-[1.05] tracking-tight max-w-[15ch] md:max-w-none">{hero.slides[currentSlide].title}</p>
                <p className="text-white/90 text-xs md:text-base lg:text-lg max-w-md leading-relaxed font-sans">{hero.slides[currentSlide].subtitle}</p>
                <div className="flex flex-wrap items-center gap-4 pt-4 md:pt-6">
                  {hero.slides[currentSlide].link ? (
                    <Link
                      href={hero.slides[currentSlide].link}
                      className="group flex items-center justify-center gap-2 bg-white text-black px-8 md:px-10 py-3.5 md:py-4 rounded-full font-bold text-xs md:text-sm tracking-widest uppercase transition-all duration-300 hover:bg-neutral-100 hover:scale-[1.03] active:scale-95 inline-flex shadow-xl"
                    >
                      <span>{hero.slides[currentSlide].buttonText}</span>
                      <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  ) : (
                    <button className="group flex items-center justify-center gap-2 bg-white text-black px-8 md:px-10 py-3.5 md:py-4 rounded-full font-bold text-xs md:text-sm tracking-widest uppercase transition-all duration-300 hover:bg-neutral-100 hover:scale-[1.03] active:scale-95 inline-flex shadow-xl">
                      <span>{hero.slides[currentSlide].buttonText}</span>
                      <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                  )}
                  {hero.labels.viewCollectionLink ? (
                    <Link
                      href={hero.labels.viewCollectionLink}
                      className="group flex items-center justify-center border border-white/30 bg-transparent text-white px-8 md:px-10 py-3.5 md:py-4 rounded-full font-bold text-xs md:text-sm tracking-widest uppercase transition-all duration-300 hover:bg-white hover:text-black hover:border-white hover:scale-[1.03] active:scale-95 inline-flex"
                    >
                      <span>{hero.labels.viewCollection}</span>
                    </Link>
                  ) : (
                    <button className="group flex items-center justify-center border border-white/30 bg-transparent text-white px-8 md:px-10 py-3.5 md:py-4 rounded-full font-bold text-xs md:text-sm tracking-widest uppercase transition-all duration-300 hover:bg-white hover:text-black hover:border-white hover:scale-[1.03] active:scale-95 inline-flex">
                      <span>{hero.labels.viewCollection}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-10 right-10 md:bottom-16 md:right-16 flex items-center gap-4 md:gap-8 z-30">
        <div className="hidden md:flex items-center gap-3 text-white font-bold heading-font"><span className="text-xl">0{currentSlide + 1}</span><div className="w-8 h-[1px] bg-white/20" /><span className="text-white/30 text-sm text-center">0{hero.slides.length}</span></div>
        <div className="flex gap-2">
          <button onClick={prevSlide} className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all bg-black/20 backdrop-blur-sm active:scale-90"><ChevronLeft className="w-4 h-4 md:w-5 md:h-5" /></button>
          <button onClick={nextSlide} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-black hover:text-white transition-all active:scale-90"><ChevronRight className="w-4 h-4 md:w-5 md:h-5" /></button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-[3px] bg-black/10 w-full z-40 overflow-hidden">
        <motion.div className="h-full bg-black" initial={{ width: 0 }} animate={{ width: "100%" }} key={currentSlide} transition={{ duration: 7, ease: "linear" }} />
      </div>
      <MarqueeSection items={hero.marqueeItems} />
    </section>
  );
}
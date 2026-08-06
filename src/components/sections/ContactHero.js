"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import MarqueeSection from "@/components/home/MarqueeSection";

export default function ContactHero({
  slides,
  label = "Get In Touch",
  title = "CONTACT PAIRO",
  subtitle = "Our team is here to assist you with any inquiries regarding our collections, orders, or artisanal process.",
  buttonText = "SCROLL TO FORM",
  link = "#contact-form",
  image = "/images/contact-hero.jpg",
  mobileImage = "",
  marqueeEnabled = "true",
  marqueeItems,
  headingLevel = "h1"
}) {
  const activeSlides = slides && slides.length > 0 ? slides : [
    { title, subtitle, label, image, mobileImage, buttonText, link }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const nextSlide = () => {
    if (!activeSlides.length) return;
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
  };

  const prevSlide = () => {
    if (!activeSlides.length) return;
    setDirection(-1);
    setCurrentSlide((prev) => (prev === 0 ? activeSlides.length - 1 : prev - 1));
  };

  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(timer);
  }, [activeSlides.length]);

  const slideVariants = {
    initial: (direction) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0
    }),
    animate: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 }
      }
    },
    exit: (direction) => ({
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 }
      }
    })
  };

  const current = activeSlides[currentSlide] || {};
  const items = marqueeItems?.length > 0 ? marqueeItems : undefined;

  const handleScrollClick = (e, slideLink) => {
    const targetLink = slideLink || link;
    if (targetLink && targetLink.startsWith("#")) {
      e.preventDefault();
      document
        .getElementById(targetLink.substring(1))
        ?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="container mx-auto px-2 sm:px-4 md:px-8 my-6 relative">
      <div className="relative h-[550px] md:h-[650px] lg:h-[750px] rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden bg-white [transform:translateZ(0)]">
        <div className="relative h-[calc(100%-48px)] md:h-[calc(100%-56px)] overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 bg-black"
            >
              <div className="absolute inset-0">
                {current.mobileImage ? (
                  <>
                    <div className="block md:hidden absolute inset-0">
                      <Image
                        src={current.mobileImage}
                        alt={current.title || ""}
                        fill
                        className="object-cover brightness-75"
                        priority
                      />
                    </div>
                    <div className="hidden md:block absolute inset-0">
                      <Image
                        src={current.image || image}
                        alt={current.title || ""}
                        fill
                        className="object-cover brightness-75"
                        priority
                      />
                    </div>
                  </>
                ) : (
                  <Image
                    src={current.image || image}
                    alt={current.title || ""}
                    fill
                    className="object-cover brightness-75"
                    priority
                  />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent md:from-black/70 md:via-black/20" />
              <div className="container mx-auto px-6 md:px-16 h-full flex items-center relative z-10">
                <div className="max-w-2xl">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                    className="space-y-4 md:space-y-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-[1.5px] w-8 bg-white/30" />
                      <span className="text-white/90 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase">
                        {current.label || label}
                      </span>
                    </div>
                    {React.createElement(
                      headingLevel,
                      { className: "text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white heading-font leading-[1.05] tracking-tight max-w-[15ch] md:max-w-none" },
                      current.title || title
                    )}
                    <p className="text-white/90 text-xs md:text-base lg:text-lg max-w-md leading-relaxed font-sans">
                      {current.subtitle || subtitle}
                    </p>
                    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4 pt-4 md:pt-6">
                      <a
                        href={current.link || link}
                        onClick={(e) => handleScrollClick(e, current.link)}
                        className="group flex items-center justify-center gap-2 bg-white text-black px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 rounded-full font-bold text-[10px] sm:text-xs md:text-sm tracking-widest uppercase transition-all duration-300 hover:bg-neutral-100 hover:scale-[1.03] active:scale-95 inline-flex shadow-xl"
                      >
                        <span>{current.buttonText || buttonText}</span>
                        <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </a>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {activeSlides.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all backdrop-blur-sm"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all backdrop-blur-sm"
                aria-label="Next slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {activeSlides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setDirection(idx > currentSlide ? 1 : -1);
                      setCurrentSlide(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${idx === currentSlide ? "bg-white w-6" : "bg-white/40 hover:bg-white/60"}`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {marqueeEnabled === "true" && <MarqueeSection items={items} />}
      </div>
    </section>
  );
}

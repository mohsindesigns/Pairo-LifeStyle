"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, ChevronLeft, ChevronRight, CheckCircle2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useSiteData } from "@/context/SiteContext";

const TestimonialCard = ({ review, isActive, position, onSwipe, labels, multiplier = 220 }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-200, 200], [10, -10]);
  const rotateY = useTransform(mouseX, [-200, 200], [-10, 10]);

  const handleMouseMove = (e) => {
    if (!isActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      drag={isActive ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(e, { offset, velocity }) => {
        if (Math.abs(offset.x) > 80 || Math.abs(velocity.x) > 400) {
          onSwipe(offset.x > 0 ? "prev" : "next");
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={false}
      animate={{
        scale: isActive ? 1 : 0.75,
        x: position * multiplier,
        zIndex: isActive ? 30 : 20 - Math.abs(position),
        opacity: isActive ? 1 : 0.5,
        rotateY: position * -35,
        y: isActive ? 0 : 20,
        filter: isActive ? "blur(0px)" : "blur(4px)",
      }}
      style={{
        rotateX: isActive ? rotateX : 0,
        rotateY: isActive ? rotateY : (position * -35),
        transformStyle: "preserve-3d",
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
      className={`absolute w-[82vw] sm:w-[350px] md:w-[460px] bg-white rounded-[24px] md:rounded-[40px] p-5 sm:p-8 md:p-12 shadow-2xl shadow-black/[0.04] border border-black/[0.05] flex flex-col gap-4 sm:gap-6 group cursor-grab active:cursor-grabbing select-none`}
    >
      <div style={{ transform: "translateZ(50px)" }} className="flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-black text-white flex items-center justify-center font-bold text-base md:text-xl shadow-xl overflow-hidden relative">
            {review.name[0]}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-black font-bold text-[12px] sm:text-[14px] md:text-[18px] heading-font tracking-tighter leading-none uppercase">{review.name}</h3>
            <span className="text-black/30 text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em] mt-1.5">{labels.verifiedLabel}</span>
          </div>
        </div>
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`w-3 h-3 md:w-4 md:h-4 ${i < review.rating ? 'fill-primary text-primary' : 'text-black/10'}`} />
          ))}
        </div>
      </div>
      <div className="w-full h-px bg-black/[0.05]" />
      <div style={{ transform: "translateZ(30px)" }} className="relative">
        <p className="text-black text-[11px] sm:text-sm md:text-lg font-medium leading-[1.5] heading-font tracking-tight italic">&quot;{review.text}&quot;</p>
      </div>
      <div style={{ transform: "translateZ(40px)" }} className="flex items-center gap-2 pt-1 sm:pt-2">
        <div className="w-4 h-4 md:w-6 md:h-6 rounded-full bg-black flex items-center justify-center"><CheckCircle2 className="w-2.5 h-2.5 md:w-4 md:h-4 text-white" /></div>
        <span className="text-black/30 text-[7px] md:text-[9px] font-bold uppercase tracking-[0.2em]">{labels.verifiedLabel} Account</span>
      </div>
    </motion.div>
  );
};

export default function Testimonials({
  title,
  label,
  buttonText,
  verifiedLabel,
  reviews: propReviews
}) {
  const siteData = useSiteData();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [multiplier, setMultiplier] = useState(220);

  useEffect(() => {
    const handleResize = () => {
      setMultiplier(window.innerWidth < 640 ? 120 : (window.innerWidth < 768 ? 160 : 220));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const testimonialsConfig = {
    title: title || siteData?.testimonials?.title || "CUSTOMER LOVE",
    label: label || siteData?.testimonials?.label || "REVIEWS",
    buttonText: buttonText || siteData?.testimonials?.buttonText || "WRITE A REVIEW",
    verifiedLabel: verifiedLabel || siteData?.testimonials?.verifiedLabel || "Verified Account",
    reviews: propReviews || siteData?.testimonials?.reviews || []
  };

  const reviews = testimonialsConfig.reviews;

  const handleSwipe = (direction) => {
    if (!reviews.length) return;
    if (direction === "next") {
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
    }
  };

  const getPosition = (index) => {
    if (!reviews.length) return 0;
    let diff = index - currentIndex;
    if (diff > reviews.length / 2) diff -= reviews.length;
    if (diff < -reviews.length / 2) diff += reviews.length;
    return diff;
  };

  return (
    <section className="container mx-auto px-2 sm:px-4 md:px-8 py-2 md:py-4 overflow-hidden relative">
      <div className="bg-white border border-black/5 rounded-[32px] md:rounded-[40px] shadow-sm overflow-hidden py-16 md:py-20 px-6 md:px-16 relative z-10">
        <div className="flex items-end justify-between mb-8 md:mb-12 gap-6">
          <div className="space-y-3 md:space-y-4 flex-1 min-w-0">
            <div className="inline-flex items-center bg-black text-white px-3 py-1 rounded-md">
              <p className="text-[9px] md:text-[11px] font-bold tracking-[0.2em] uppercase">{testimonialsConfig.label}</p>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold heading-font tracking-tighter text-[#000000] uppercase leading-none truncate">{testimonialsConfig.title}</h2>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => handleSwipe("prev")} className="w-10 h-10 md:w-16 md:h-16 rounded-full border border-black/10 flex items-center justify-center hover:bg-black hover:text-white transition-all duration-500 active:scale-90 group"><ChevronLeft className="w-5 h-5 md:w-8 md:h-8 transition-transform duration-500 group-hover:-translate-x-1" /></button>
            <button onClick={() => handleSwipe("next")} className="w-10 h-10 md:w-16 md:h-16 rounded-full border border-black/10 flex items-center justify-center hover:bg-black hover:text-white transition-all duration-500 active:scale-90 group"><ChevronRight className="w-5 h-5 md:w-8 md:h-8 transition-transform duration-500 group-hover:translate-x-1" /></button>
          </div>
        </div>

        <div className="relative h-[350px] md:h-[500px] flex items-center justify-center perspective-[2000px]">
          {reviews.map((review, index) => {
            const position = getPosition(index);
            if (Math.abs(position) > 1) return null;
            return <TestimonialCard key={index} review={review} isActive={position === 0} position={position} onSwipe={handleSwipe} labels={testimonialsConfig} multiplier={multiplier} />;
          })}
        </div>

        <div className="flex flex-col items-center">
          <Link href="/profile" className="group relative overflow-hidden bg-black text-white px-8 md:px-12 py-3.5 md:py-4.5 rounded-full font-bold text-[9px] md:text-xs uppercase tracking-[0.3em] shadow-xl transition-all active:scale-95 inline-flex items-center">
            <span className="relative z-10 flex items-center gap-3 transition-colors duration-500">{testimonialsConfig.buttonText}<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
          <div className="mt-10 md:mt-14 flex gap-3">
            {reviews.map((_, i) => (
              <button key={i} onClick={() => setCurrentIndex(i)} className={`h-1 transition-all duration-700 rounded-full ${i === currentIndex ? 'w-14 bg-black' : 'w-3 bg-black/5'}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

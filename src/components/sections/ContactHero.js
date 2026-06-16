"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import MarqueeSection from "@/components/home/MarqueeSection";

export default function ContactHero({ 
  label = "Get In Touch", 
  title = "CONTACT PAIRO", 
  subtitle = "Our team is here to assist you with any inquiries regarding our collections, orders, or artisanal process.", 
  buttonText = "SCROLL TO FORM", 
  link = "#contact-form",
  image = "/images/contact-hero.jpg",
  marqueeEnabled = "true",
  marqueeItems
}) {
  return (
    <section className="relative h-[550px] md:h-[650px] lg:h-[750px] overflow-hidden mx-4 md:mx-8 my-6 rounded-[32px] md:rounded-[40px] shadow-2xl bg-black">
      <div className="absolute inset-0">
        {image && <Image src={image} alt={title} fill className="object-cover brightness-75" priority />}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
      <div className="container mx-auto px-6 md:px-16 h-full flex items-center relative z-10">
        <div className="max-w-3xl">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6 md:space-y-8"
          >
            <div className="flex items-center gap-3">
              <div className="h-[1.5px] w-8 bg-white/30" />
              <span className="text-white/50 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase heading-font">{label}</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-8xl font-bold text-white heading-font leading-[0.95] tracking-tighter uppercase">{title}</h1>
            <p className="text-white/50 text-sm md:text-xl max-w-xl leading-relaxed font-sans">{subtitle}</p>
            <div className="flex flex-wrap items-center gap-6 pt-4">
              <a 
                href={link}
                onClick={(e) => {
                  if (link && link.startsWith("#")) {
                    e.preventDefault();
                    document.getElementById(link.substring(1))?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="group relative overflow-hidden bg-white text-black px-10 md:px-12 py-4 md:py-5 rounded-full font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] transition-all duration-500 shadow-xl active:scale-95 block w-fit"
              >
                <span className="relative z-10 flex items-center gap-3 group-hover:text-white transition-colors duration-500">
                  {buttonText}
                  <ArrowRight className="w-5 h-5 transition-transform duration-500 group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.22, 1, 0.36, 1]" />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
      {marqueeEnabled === "true" && <MarqueeSection items={marqueeItems?.length > 0 ? marqueeItems : undefined} />}
    </section>
  );
}

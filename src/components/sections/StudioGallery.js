"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function StudioGallery({
  label = "THE ATELIER",
  title = "WHERE IDEAS TAKE SHAPE",
  images = [
     { url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80" },
     { url: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80" },
     { url: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&q=80" },
     { url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80" }
  ]
}) {

  return (
    <section className="py-12 md:py-16">
      <div className="mx-4 md:mx-8 bg-black rounded-[32px] md:rounded-[40px] shadow-sm overflow-hidden py-16 md:py-24 px-6 md:px-16 text-white">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
          <div className="space-y-4">
             <span className="text-[10px] font-bold tracking-[0.3em] text-white/70 uppercase">{label}</span>
             <p className="text-2xl md:text-4xl font-bold heading-font tracking-tighter uppercase leading-none">
               {title}
             </p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
          {images.map((img, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative aspect-[3/4] rounded-2xl md:rounded-3xl overflow-hidden group"
            >
              <Image 
                src={img.url} 
                alt="Studio Gallery" 
                fill 
                className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-110" 
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function StorySection({
  label = "THE JOURNEY",
  title = "DEFINING A NEW STANDARDS OF QUALITY",
  description = "Pairo was born from a simple observation: the world didn't need more products; it needed better ones. We focus on the intersection of intentional design and uncompromising quality.",
  image = "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80",
  features = [
    { title: "Pure Materials", desc: "We source only the finest sustainable materials from certified global partners." },
    { title: "Master Craft", desc: "Every piece is overseen by master artisans with decades of experience." }
  ]
}) {

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
    }
  };

  return (
    <section className="py-12 md:py-16">
      <div className="mx-4 md:mx-8 bg-background border border-border rounded-[32px] md:rounded-[40px] shadow-sm overflow-hidden py-16 md:py-24 px-6 md:px-16">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="space-y-10"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
                 <span className="text-[9px] md:text-[11px] font-bold tracking-[0.3em] text-foreground/80 uppercase">{label}</span>
              </div>
              <p className="text-2xl md:text-4xl lg:text-5xl font-bold heading-font tracking-tighter text-foreground uppercase leading-[0.9]">
                {title}
              </p>
            </motion.div>
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-foreground/85 leading-relaxed max-w-xl">
              {description}
            </motion.p>
            <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-8 pt-6">
              {features.map((feature, i) => (
                <div key={i} className="p-8 rounded-3xl bg-secondary border border-border space-y-4 hover:bg-primary transition-all duration-500 group">
                  <p className="text-lg font-bold uppercase tracking-tight text-primary group-hover:text-white transition-colors duration-500">{feature.title}</p>
                  <p className="text-sm text-foreground group-hover:text-white/95 leading-relaxed transition-colors duration-500">{feature.desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative aspect-square rounded-[40px] overflow-hidden shadow-2xl"
          >
            <Image src={image} alt={title} fill className="object-cover" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

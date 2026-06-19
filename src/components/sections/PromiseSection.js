"use client";

import Image from "next/image";

export default function PromiseSection({
  label = "OUR PROMISE",
  title = "UNCOMPROMISING QUALITY, ETHICAL SOURCING",
  description = "We believe that luxury should not come at the cost of our planet or its people. Every decision we make is guided by a commitment to longevity and responsibility.",
  image = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80",
  items = [
    { title: "Longevity First", desc: "Designed to endure seasons and trends, built with materials that age with grace." },
    { title: "Ethical Craft", desc: "Fair wages and safe conditions for every hand that touches our products." }
  ],
  stats = [
    { label: "ESTABLISHED", value: "2024" },
    { label: "PARTNERS", value: "12+" }
  ]
}) {

  return (
    <section className="py-12 md:py-16">
      <div className="mx-4 md:mx-8">
        <div className="bg-black rounded-[40px] md:rounded-[60px] overflow-hidden relative min-h-[500px] md:min-h-[700px] flex items-center shadow-2xl">
          <div className="absolute inset-0">
             <Image src={image} alt={title} fill className="object-cover opacity-50" />
             <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
          </div>
          <div className="relative z-10 w-full p-8 md:p-20">
             <div className="max-w-2xl space-y-12">
                <div className="space-y-4">
                   <span className="text-[9px] md:text-[11px] font-bold tracking-[0.4em] text-white/80 uppercase">{label}</span>
                   <p className="text-2xl md:text-4xl lg:text-5xl font-bold heading-font text-white uppercase leading-[0.9] tracking-tighter">
                      {title}
                   </p>
                </div>
                <p className="text-lg md:text-2xl text-white/85 leading-relaxed font-light">
                  {description}
                </p>
                <div className="grid sm:grid-cols-2 gap-12 pt-12 border-t border-white/20">
                   {items.map((item, i) => (
                     <div key={i} className="space-y-4">
                        <p className="text-xl font-bold uppercase tracking-tight text-white">{item.title}</p>
                        <p className="text-sm text-white/80 leading-relaxed">{item.desc}</p>
                     </div>
                   ))}
                </div>
                <div className="flex gap-16 pt-8">
                   {stats.map((stat, i) => (
                     <div key={i}>
                        <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-2">{stat.label}</p>
                        <p className="text-3xl md:text-4xl font-bold heading-font text-white">{stat.value}</p>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </section>
  );
}

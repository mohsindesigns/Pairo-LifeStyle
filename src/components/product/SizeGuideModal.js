"use client";

import { useState, useEffect } from "react";
import { X, Play } from "lucide-react";

const SIZES_CM = [
  { size: "XS", us: "34", eu: "44", chest: "86 - 89", sleeves: "63.5" },
  { size: "S", us: "36 - 38", eu: "46 - 48", chest: "91 - 97", sleeves: "64.5" },
  { size: "M", us: "40", eu: "50", chest: "99 - 104", sleeves: "66" },
  { size: "L", us: "42 - 44", eu: "52 - 54", chest: "106 - 112", sleeves: "67" },
  { size: "XL", us: "46", eu: "56", chest: "114 - 119", sleeves: "68.5" },
  { size: "2XL", us: "48 - 50", eu: "58 - 60", chest: "122 - 127", sleeves: "70" },
  { size: "3XL", us: "52", eu: "62", chest: "129 - 135", sleeves: "71" },
  { size: "4XL", us: "54 - 56", eu: "64 - 66", chest: "137 - 142", sleeves: "72" },
];

const SIZES_IN = [
  { size: "XS", us: "34", eu: "44", chest: "34 - 35", sleeves: "25" },
  { size: "S", us: "36 - 38", eu: "46 - 48", chest: "36 - 38", sleeves: "25.4" },
  { size: "M", us: "40", eu: "50", chest: "39 - 41", sleeves: "26" },
  { size: "L", us: "42 - 44", eu: "52 - 54", chest: "42 - 44", sleeves: "26.4" },
  { size: "XL", us: "46", eu: "56", chest: "45 - 47", sleeves: "27" },
  { size: "2XL", us: "48 - 50", eu: "58 - 60", chest: "48 - 50", sleeves: "27.6" },
  { size: "3XL", us: "52", eu: "62", chest: "51 - 53", sleeves: "28" },
  { size: "4XL", us: "54 - 56", eu: "64 - 66", chest: "54 - 56", sleeves: "28.3" },
];

export default function SizeGuideModal({ isOpen, onClose }) {
  const [unit, setUnit] = useState("cm"); // cm or in
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const data = unit === "cm" ? SIZES_CM : SIZES_IN;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl max-h-[92dvh] bg-white flex flex-col overflow-hidden shadow-2xl border border-black animate-sg-up rounded-[var(--radius,0px)]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black shrink-0">
          <p className="text-[13px] sm:text-[15px] font-bold uppercase tracking-widest text-black">
            Size Guide
          </p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-black rounded-[var(--radius,0px)] hover:bg-black hover:text-white transition-all duration-300 active:scale-[0.98] text-black"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8 min-h-0">

          {/* Table Area */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.2em] text-black">
                Pairo
              </h3>
              {/* Unit Toggle */}
              <div className="flex border border-black rounded-[var(--radius,0px)] overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setUnit("cm")}
                  className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${unit === "cm" ? "bg-black text-white" : "bg-white text-black hover:bg-black/5"
                    }`}
                >
                  CM
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("in")}
                  className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all border-l border-black ${unit === "in" ? "bg-black text-white" : "bg-white text-black hover:bg-black/5"
                    }`}
                >
                  IN
                </button>
              </div>
            </div>

            {/* Table wrapper */}
            <div className="w-full overflow-x-auto border border-black rounded-[var(--radius,0px)]">
              <table className="w-full text-left border-collapse text-[11px] sm:text-[12px]">
                <thead>
                  <tr className="bg-black/5 border-b border-black">
                    <th className="px-3 py-2.5 font-bold uppercase text-black">Jacket Size</th>
                    <th className="px-3 py-2.5 font-bold uppercase text-black">US Size</th>
                    <th className="px-3 py-2.5 font-bold uppercase text-black">EU Size</th>
                    <th className="px-3 py-2.5 font-bold uppercase text-black">Chest</th>
                    <th className="px-3 py-2.5 font-bold uppercase text-black">Sleeves</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {data.map((row) => (
                    <tr key={row.size} className="hover:bg-black/[0.02] text-black">
                      <td className="px-3 py-2.5 font-bold">{row.size}</td>
                      <td className="px-3 py-2.5">{row.us}</td>
                      <td className="px-3 py-2.5">{row.eu}</td>
                      <td className="px-3 py-2.5">{row.chest}</td>
                      <td className="px-3 py-2.5">{row.sleeves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* How to Measure Section */}
          <div className="space-y-4">
            <h3 className="text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.2em] text-black text-center">
              How To Measure
            </h3>

            {/* Responsive Video Container */}
            <div className="w-full aspect-video border border-black rounded-[var(--radius,0px)] bg-black overflow-hidden relative group">
              {!showVideo ? (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 cursor-pointer bg-neutral-900 transition-opacity hover:opacity-95"
                  onClick={() => setShowVideo(true)}
                >
                  <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 duration-300">
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  </div>
                  <span className="mt-3 text-[10px] sm:text-[11px] font-semibold text-white uppercase tracking-widest">
                    Watch Measurement Video Guide
                  </span>
                </div>
              ) : (
                <iframe
                  src="https://www.youtube.com/embed/ipyhV51zUWk?autoplay=1"
                  title="Measurement Guide Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-none"
                />
              )}
            </div>

            {/* Measurement Guide Image & Explanations */}
            <div className="space-y-6 pt-2">
              {/* Image Placeholder (for user to add their own image path later) */}
              <div className="w-full flex justify-center border border-black/10 rounded-[var(--radius,0px)] bg-black/[0.02] p-4">
                <img
                  src="/images/size-guide-diagram.png"
                  alt="Size Guide Diagram Placeholder"
                  className="max-w-full h-auto object-contain"
                  onError={(e) => {
                    // Gracefully hide the image frame if they haven't uploaded the file yet
                    e.target.parentNode.style.display = "none";
                  }}
                />
              </div>

              {/* Descriptions */}
              <div className="space-y-4 text-black">
                {[
                  { title: "Shoulder", desc: "Measure from the tip of one shoulder, across your back to the tip of your other shoulder." },
                  { title: "Chest", desc: "Measure the circumference around the fullest area of chest, keeping the tape level." },
                  { title: "Natural Waist", desc: "Measure the circumference around the narrowest area of waist, above the navel." },
                  { title: "Lower Waist", desc: "Measure the circumference around the fullest area of waist, below the navel." },
                  { title: "Hips", desc: "Measure around the fullest part of your body, above the top of your legs." },
                  { title: "Sleeves Outseam", desc: "Measure from your shoulder seam, with your arm slightly bent, to the tip of your wrist." },
                  { title: "Pants Inseam", desc: "Measure from your crotch point down to your ankle." }
                ].map((item) => (
                  <div key={item.title} className="text-[11px] sm:text-[12px] leading-relaxed">
                    <p className="font-bold uppercase tracking-wider">{item.title}</p>
                    <p className="text-black/80">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

      <style>{`
        @keyframes sgUp {
          from { opacity: 0; scale: 0.96; transform: translateY(12px); }
          to   { opacity: 1; scale: 1; transform: translateY(0); }
        }
        .animate-sg-up { animation: sgUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}

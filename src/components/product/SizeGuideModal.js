"use client";

import { useState, useEffect } from "react";
import { X, Play } from "lucide-react";

import { SIZES_CM, SIZES_IN } from "@/lib/sizeChartDefaults";

const DEFAULT_INSTRUCTIONS = [
  { title: "Shoulder", desc: "Measure from the tip of one shoulder, across your back to the tip of your other shoulder." },
  { title: "Chest", desc: "Measure the circumference around the fullest area of chest, keeping the tape level." },
  { title: "Natural Waist", desc: "Measure the circumference around the narrowest area of waist, above the navel." },
  { title: "Lower Waist", desc: "Measure the circumference around the fullest area of waist, below the navel." },
  { title: "Hips", desc: "Measure around the fullest part of your body, above the top of your legs." },
  { title: "Sleeves Outseam", desc: "Measure from your shoulder seam, with your arm slightly bent, to the tip of your wrist." },
  { title: "Pants Inseam", desc: "Measure from your crotch point down to your ankle." }
];

function getYoutubeEmbedUrl(url) {
  if (!url) return "https://www.youtube.com/embed/ipyhV51zUWk?autoplay=1";
  let videoId = "";
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    videoId = match[2];
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
}

export default function SizeGuideModal({ isOpen, onClose, resolvedSizeChart }) {
  const [unit, setUnit] = useState("cm");
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setShowVideo(false);
  }, [isOpen]);

  if (!isOpen || !resolvedSizeChart) return null;

  const isReusable = resolvedSizeChart.type === "reusable";

  if (isReusable) {
    const chart = resolvedSizeChart.chart;
    const columns = chart.columns || [];
    const rows = chart.rows || [];
    const heading = chart.publicHeading || chart.label || "Size Guide";
    const description = chart.description || "";

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        {/* Centered Panel */}
        <div className="relative w-full max-w-2xl max-h-[90vh] bg-white flex flex-col overflow-hidden shadow-2xl border border-black rounded-[var(--radius,0px)] animate-sg-in">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-black shrink-0">
            <p className="text-[13px] sm:text-[15px] font-bold uppercase tracking-widest text-black">
              {heading}
            </p>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center border border-black rounded-[var(--radius,0px)] hover:bg-black hover:text-white transition-all duration-300 active:scale-[0.98] text-black"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 min-h-0">
            {description && (
              <p className="text-[12px] text-gray-500 leading-relaxed">
                {description}
              </p>
            )}

            {/* Dynamic Table */}
            <div className="w-full overflow-x-auto border border-black rounded-[var(--radius,0px)]">
              <table className="w-full text-left border-collapse text-[11px] sm:text-[12px]">
                <thead>
                  <tr className="bg-black/5 border-b border-black">
                    {columns.map((col, idx) => (
                      <th key={idx} className="px-3 py-2.5 font-bold uppercase text-black whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-black/[0.02] text-black">
                      {columns.map((_, cIdx) => (
                        <td key={cIdx} className={`px-3 py-2.5 ${cIdx === 0 ? "font-bold" : ""}`}>
                          {row[cIdx] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Default Instructions */}
            <div className="space-y-4 pt-4 border-t border-black/10">
              <h3 className="text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.2em] text-black text-center">
                How To Measure
              </h3>
              
              <div className="space-y-4 text-black">
                {DEFAULT_INSTRUCTIONS.map((item, idx) => (
                  <div key={item.title || idx} className="text-[11px] sm:text-[12px] leading-relaxed">
                    <p className="font-bold uppercase tracking-wider">{item.title}</p>
                    <p className="text-black/80">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <style>{`
          @keyframes sgIn {
            from { opacity: 0; transform: scale(0.96) translateY(10px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          .animate-sg-in { animation: sgIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
        `}</style>
      </div>
    );
  }

  // Legacy/Product-Custom mode
  const sizeGuide = resolvedSizeChart.sizeGuide;
  const isCustomEnabled = true;

  const tableData = unit === "cm"
    ? (sizeGuide?.sizesCm?.length > 0 ? sizeGuide.sizesCm : SIZES_CM)
    : (sizeGuide?.sizesIn?.length > 0 ? sizeGuide.sizesIn : SIZES_IN);

  const instructions = sizeGuide?.instructions?.length > 0
    ? sizeGuide.instructions
    : DEFAULT_INSTRUCTIONS;

  const sizeColumnLabel = sizeGuide?.sizeName?.trim() || "Size";

  const rawVideoUrl = sizeGuide?.videoUrl || "https://www.youtube.com/embed/ipyhV51zUWk?autoplay=1";
  const embedVideoUrl = getYoutubeEmbedUrl(rawVideoUrl);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Centered Panel */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white flex flex-col overflow-hidden shadow-2xl border border-black rounded-[var(--radius,0px)] animate-sg-in">

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

          {/* Size Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.2em] text-black">
                Size Chart
              </h3>
              {/* Unit Toggle */}
              <div className="flex border border-black rounded-[var(--radius,0px)] overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setUnit("cm")}
                  className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${unit === "cm" ? "bg-black text-white" : "bg-white text-black hover:bg-black/5"}`}
                >
                  CM
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("in")}
                  className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all border-l border-black ${unit === "in" ? "bg-black text-white" : "bg-white text-black hover:bg-black/5"}`}
                >
                  IN
                </button>
              </div>
            </div>

            <div className="w-full overflow-x-auto border border-black rounded-[var(--radius,0px)]">
              <table className="w-full text-left border-collapse text-[11px] sm:text-[12px]">
                <thead>
                  <tr className="bg-black/5 border-b border-black">
                    <th className="px-3 py-2.5 font-bold uppercase text-black whitespace-nowrap">{sizeColumnLabel}</th>
                    <th className="px-3 py-2.5 font-bold uppercase text-black">US Size</th>
                    <th className="px-3 py-2.5 font-bold uppercase text-black">EU Size</th>
                    <th className="px-3 py-2.5 font-bold uppercase text-black">Chest</th>
                    <th className="px-3 py-2.5 font-bold uppercase text-black">Sleeves</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {tableData.map((row, idx) => (
                    <tr key={row.size || idx} className="hover:bg-black/[0.02] text-black">
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

          {/* How to Measure */}
          <div className="space-y-4">
            <h3 className="text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.2em] text-black text-center">
              How To Measure
            </h3>

            {/* Video */}
            <div className="w-full aspect-video border border-black rounded-[var(--radius,0px)] bg-black overflow-hidden relative group">
              {!showVideo ? (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 cursor-pointer bg-neutral-900 hover:opacity-95 transition-opacity"
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
                  src={embedVideoUrl}
                  title="Measurement Guide Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-none"
                />
              )}
            </div>

            {/* Measurement Instructions */}
            <div className="space-y-4 text-black pt-2">
              {instructions.map((item, idx) => (
                <div key={item.title || idx} className="text-[11px] sm:text-[12px] leading-relaxed">
                  <p className="font-bold uppercase tracking-wider">{item.title}</p>
                  <p className="text-black/80">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes sgIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-sg-in { animation: sgIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}
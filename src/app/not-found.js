import Link from "next/link";
import { ArrowRight, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center bg-white px-4 text-center">
      <div className="mb-6 p-5 bg-neutral-50 rounded-full text-black border border-black/5">
        <FileQuestion className="w-16 h-16 stroke-[1.2]" />
      </div>
      
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-2">
        Error 404
      </p>
      
      <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-widest text-black mb-4 heading-font">
        PAGE NOT FOUND
      </h1>
      
      <p className="text-xs md:text-sm text-neutral-500 max-w-md mb-8 leading-relaxed font-medium">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      
      <Link
        href="/"
        className="group relative overflow-hidden bg-black text-white px-8 md:px-12 py-3.5 md:py-4 rounded-full font-bold text-[9px] md:text-xs uppercase tracking-[0.3em] shadow-xl transition-all active:scale-95 inline-flex items-center gap-3"
      >
        <span>Return to Home</span>
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, ChevronDown, MessageSquareText } from "lucide-react";

import dynamic from "next/dynamic";

const ProductReviews = dynamic(() => import("./ProductReviews"), {
  ssr: false,
  loading: () => (
    <div className="py-20 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-black/30 animate-pulse">Loading Reviews Engine...</span>
    </div>
  )
});

const ProductQuestionsAnswers = dynamic(() => import("./ProductQuestionsAnswers"), {
  ssr: false,
  loading: () => (
    <div className="py-20 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-black/30 animate-pulse">Loading Q&A Engine...</span>
    </div>
  )
});

export default function ClientTabSystem({ product }) {
  const [activeTab, setActiveTab] = useState("Product Details");
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  return (
    <div className="mt-6 md:mt-10 border-t border-black/5">
      <div className="flex border-b border-black/5 overflow-x-auto scrollbar-hide snap-x">
         {["Product Details", "Rating & Reviews", "Questions & Answers"].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[120px] md:min-w-[200px] py-5 md:py-6 text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] transition-all relative snap-center ${activeTab === tab ? "text-accent border-b-2 border-accent" : "text-primary/65 hover:text-primary"}`}
            >
              {tab}
            </button>
         ))}
      </div>
      
      <div className="py-4 md:py-8">
         <AnimatePresence mode="wait">
            {activeTab === "Product Details" && (
               <motion.div key="details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full space-y-12">
                  <div>
                     <div 
                         className="editorial-content-rich w-full max-w-none"
                         dangerouslySetInnerHTML={{ __html: product.description || "Detailed overview coming soon..." }}
                       />
                  </div>
               </motion.div>
            )}

            {activeTab === "Rating & Reviews" && (
               <motion.div key="reviews" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ProductReviews productId={product._id} productName={product.name} />
               </motion.div>
            )}

            {activeTab === "Questions & Answers" && (
               <motion.div key="qnas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                 <ProductQuestionsAnswers productId={product._id} productName={product.name} />
               </motion.div>
            )}
         </AnimatePresence>
      </div>
    </div>
  );
}

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

export default function ClientTabSystem({ product }) {
  const [activeTab, setActiveTab] = useState("Product Details");
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  return (
    <div className="mt-6 md:mt-10 border-t border-black/5">
      <div className="flex border-b border-black/5 overflow-x-auto scrollbar-hide snap-x">
         {["Product Details", "Rating & Reviews", "FAQs"].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[120px] md:min-w-[200px] py-5 md:py-6 text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] transition-all relative snap-center ${activeTab === tab ? "text-primary border-b-2 border-primary" : "text-primary/65 hover:text-primary"}`}
            >
              {tab}
            </button>
         ))}
      </div>
      
      <div className="py-4 md:py-8">
         <AnimatePresence mode="wait">
            {activeTab === "Product Details" && (
               <motion.div key="details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-4xl space-y-12">
                  <div>
                     <div 
                         className="text-primary/85 text-base md:text-lg leading-loose font-normal prose-custom max-w-none"
                         dangerouslySetInnerHTML={{ __html: product.description || "Detailed overview coming soon..." }}
                       />
                  </div>

                  {/* Technical Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 pt-8 border-t border-black/5">
                     {[
                        { l: "SKU Identifier", v: product.sku || "N/A" },
                        { l: "Department", v: product.categories?.[0]?.name || product.category || "General" },
                        { l: "Stock Status", v: product.status || "Published" },
                        { l: "Logistics", v: product.shippingType || "Express" }
                     ].map((s, i) => (
                        <div key={i} className="space-y-1.5">
                           <p className="text-[9px] font-semibold text-primary/60 uppercase tracking-widest">{s.l}</p>
                           <p className="text-xs font-semibold uppercase text-primary tracking-wider">{s.v}</p>
                        </div>
                     ))}
                  </div>
               </motion.div>
            )}

            {activeTab === "Rating & Reviews" && (
               <motion.div key="reviews" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                 <ProductReviews productId={product._id} productName={product.name} />
               </motion.div>
            )}

            {activeTab === "FAQs" && (
               <motion.div key="faqs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-3xl mx-auto space-y-3">
                   {(product.faqs && product.faqs.length > 0) ? (
                     product.faqs.map((faq, index) => {
                       const isOpen = openFaqIndex === index;
                       return (
                         <div 
                           key={index} 
                           className={`rounded-[var(--radius,0px)] border transition-all duration-300 overflow-hidden ${isOpen ? 'bg-white border-primary/45' : 'bg-transparent border-border hover:border-primary/35'}`}
                         >
                            <button 
                              onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                              className="w-full px-5 py-5 md:px-6 md:py-6 flex items-center justify-between text-left group"
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-[var(--radius,0px)] flex items-center justify-center transition-colors ${isOpen ? 'bg-primary' : 'bg-white border border-border'}`}>
                                  <HelpCircle className={`w-3.5 h-3.5 ${isOpen ? 'text-white' : 'text-primary/70'}`} />
                                </div>
                                <h4 className="text-xs md:text-sm font-medium uppercase tracking-wider text-primary">
                                  {faq.question}
                                </h4>
                              </div>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'text-primary rotate-180' : 'text-primary/40'}`} />
                            </button>
                            
                            <AnimatePresence>
                              {isOpen && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease: "easeInOut" }}
                                >
                                  <div className="px-5 pb-6 pl-17 md:px-6 md:pb-8 md:pl-18 border-t border-border/30 pt-4">
                                     <p className="text-primary/85 font-normal text-sm md:text-base leading-loose tracking-normal max-w-2xl">
                                       {faq.answer}
                                     </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                         </div>
                       );
                     })
                   ) : (
                     <div className="text-center py-16 bg-white rounded-[var(--radius,0px)] border border-dashed border-border">
                        <MessageSquareText className="w-8 h-8 text-primary/20 mx-auto mb-4" />
                        <p className="text-primary/60 font-medium uppercase tracking-widest text-[9px] mb-1">No specific FAQs for this piece</p>
                        <p className="text-[11px] text-primary/40 font-light">Contact our concierge for specific inquiries.</p>
                     </div>
                   )}
               </motion.div>
            )}
         </AnimatePresence>
      </div>

      <style jsx global>{`
        .prose-custom > * { margin-top: 0; margin-bottom: 1.5rem; }
        .prose-custom > *:last-child { margin-bottom: 0; }
        .prose-custom h1 { font-size: 1.6rem; font-weight: 700; line-height: 1.25; margin-top: 2.5rem; color: var(--primary); opacity: 1; }
        .prose-custom h2 { font-size: 1.3rem; font-weight: 700; line-height: 1.3; margin-top: 2rem; color: var(--primary); opacity: 1; }
        .prose-custom h3 { font-size: 1.1rem; font-weight: 600; line-height: 1.4; margin-top: 1.5rem; color: var(--primary); opacity: 0.9; }
        .prose-custom p { font-size: 1rem; margin-bottom: 1.25rem; line-height: 1.9; color: var(--primary); opacity: 0.85; }
        .prose-custom ul { list-style-type: disc; padding-left: 1.75rem; margin-top: 0.75rem; margin-bottom: 1.25rem; }
        .prose-custom ol { list-style-type: decimal; padding-left: 1.75rem; margin-top: 0.75rem; margin-bottom: 1.25rem; }
        .prose-custom li { margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.8; color: var(--primary); opacity: 0.85; }
        .prose-custom li p { margin-bottom: 0 !important; margin-top: 0 !important; }
        .prose-custom blockquote { border-left: 3px solid var(--primary); padding: 0.75rem 1.5rem; font-style: italic; color: var(--primary); opacity: 0.8; margin: 2rem 0; background: rgba(0,0,0,0.02); border-radius: 0 4px 4px 0; }
        .prose-custom strong { font-weight: 700; color: var(--primary); opacity: 1; }
        .prose-custom em { font-style: italic; color: var(--primary); opacity: 0.85; }
        .prose-custom *:first-child { margin-top: 0 !important; }
      `}</style>
    </div>
  );
}

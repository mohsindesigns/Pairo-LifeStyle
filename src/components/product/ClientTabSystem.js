"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Star, User, Check, HelpCircle, ChevronDown, MessageSquareText } from "lucide-react";

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
    <div className="mt-12 md:mt-20 border-t border-black/5">
      <div className="flex border-b border-black/5 overflow-x-auto scrollbar-hide snap-x">
         {["Product Details", "Rating & Reviews", "FAQs"].map((tab) => (
           <button 
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`flex-1 min-w-[120px] md:min-w-[200px] py-6 md:py-8 text-xs md:text-xl font-medium transition-all relative snap-center ${activeTab === tab ? "text-black border-b-2 border-black" : "text-black/40"}`}
           >
             {tab}
           </button>
         ))}
      </div>
      
      <div className="py-8 md:py-16 min-h-[300px] md:min-h-[400px]">
         <AnimatePresence mode="wait">
            {activeTab === "Product Details" && (
              <motion.div key="details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-4xl space-y-12">
                <div className="space-y-8">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-black/5 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-black/40" />
                      </div>
                      <h3 className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-black/40">Product Technical Overview</h3>
                   </div>
                   <div 
                      className="text-black/70 text-sm md:text-lg leading-relaxed font-medium prose-custom max-w-none"
                      dangerouslySetInnerHTML={{ __html: product.description || "Detailed overview coming soon..." }}
                    />
                </div>

                {/* Technical Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 pt-12 border-t border-black/5">
                   {[
                      { l: "SKU Identifier", v: product.sku || "N/A" },
                      { l: "Department", v: product.categories?.[0]?.name || product.category || "General" },
                      { l: "Stock Status", v: product.status || "Published" },
                      { l: "Logistics", v: product.shippingType || "Express" }
                   ].map((s, i) => (
                      <div key={i} className="space-y-1.5">
                         <p className="text-[8px] font-bold text-black/20 uppercase tracking-widest">{s.l}</p>
                         <p className="text-[11px] font-bold uppercase text-black tracking-wider">{s.v}</p>
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
                          className={`rounded-3xl border transition-all duration-300 overflow-hidden ${isOpen ? 'bg-black border-black shadow-2xl shadow-black/20' : 'bg-[#F9F9F9] border-black/5 hover:border-black/20'}`}
                        >
                           <button 
                             onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                             className="w-full px-6 py-6 md:px-8 md:py-8 flex items-center justify-between text-left group"
                           >
                             <div className="flex items-center gap-4">
                               <div className={`p-2 rounded-xl transition-colors ${isOpen ? 'bg-white/10' : 'bg-black/5 group-hover:bg-black/10'}`}>
                                 <HelpCircle className={`w-4 h-4 ${isOpen ? 'text-white' : 'text-black/30'}`} />
                               </div>
                               <h4 className={`text-xs md:text-sm font-bold uppercase tracking-widest transition-colors ${isOpen ? 'text-white' : 'text-black/60'}`}>
                                 {faq.question}
                               </h4>
                             </div>
                             <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'text-white rotate-180' : 'text-black/20'}`} />
                           </button>
                           
                           <AnimatePresence>
                             {isOpen && (
                               <motion.div 
                                 initial={{ height: 0, opacity: 0 }}
                                 animate={{ height: "auto", opacity: 1 }}
                                 exit={{ height: 0, opacity: 0 }}
                                 transition={{ duration: 0.3, ease: "easeInOut" }}
                               >
                                 <div className="px-6 pb-8 md:px-8 md:pb-10 pl-16 md:pl-20 border-t border-white/10 pt-6">
                                    <p className="text-white/60 font-medium text-xs md:text-base leading-relaxed tracking-tight max-w-2xl">
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
                    <div className="text-center py-20 bg-[#F9F9F9] rounded-[40px] border border-dashed border-black/10">
                       <MessageSquareText className="w-10 h-10 text-black/10 mx-auto mb-4" />
                       <p className="text-black/30 font-bold uppercase tracking-widest text-[9px] mb-2">No specific FAQs for this piece</p>
                       <p className="text-[11px] text-black/20">Contact our concierge for specific inquiries.</p>
                    </div>
                 )}
              </motion.div>
            )}
         </AnimatePresence>
      </div>

      <style jsx global>{`
        .prose-custom > * { margin-top: 0; margin-bottom: 1.25rem; }
        .prose-custom > *:last-child { margin-bottom: 0; }
        .prose-custom h1 { font-size: 1.75rem; font-weight: 800; line-height: 1.2; margin-top: 2rem; color: black; }
        .prose-custom h2 { font-size: 1.4rem; font-weight: 700; line-height: 1.3; margin-top: 1.5rem; color: black; }
        .prose-custom p { margin-bottom: 1rem; line-height: 1.7; color: rgba(0,0,0,0.7); }
        .prose-custom ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 1rem; }
        .prose-custom ol { list-style-type: decimal; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 1rem; }
        .prose-custom li { margin-bottom: 0.25rem; color: rgba(0,0,0,0.7); }
        .prose-custom li p { margin-bottom: 0 !important; margin-top: 0 !important; }
        .prose-custom blockquote { border-left: 3px solid #000; padding-left: 1.5rem; font-style: italic; color: #444; margin: 2rem 0; }
        .prose-custom strong { font-weight: 700; color: black; }
        .prose-custom *:first-child { margin-top: 0 !important; }
      `}</style>
    </div>
  );
}

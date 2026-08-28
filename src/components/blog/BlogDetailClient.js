"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Share2, ArrowUpRight, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { motion, useScroll, useSpring, AnimatePresence } from "framer-motion";
import { getProductUrl } from "@/lib/routes";

function makeInternalLinksDofollow(html) {
  if (!html) return "";
  return html.replace(/<a\s+([^>]*href=["']([^"']*)["'][^>]*)>/gi, (match, body, href) => {
    if (/rel=["']([^"']*)["']/i.test(body)) {
      return match.replace(/rel=["']([^"']*)["']/gi, (relMatch, relValue) => {
        const cleanRel = relValue
          .replace(/\bnofollow\b/gi, '')
          .replace(/\bnoindex\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        return cleanRel ? `rel="${cleanRel}"` : '';
      });
    }
    return match;
  });
}

const SectionHeader = ({ number, title }) => (
   <div className="flex items-end gap-3 mb-6 border-b border-black/10 pb-2">
      <span className="text-[10px] font-mono font-bold text-neutral-400">
         {number} //
      </span>
      <h2 className="text-xs sm:text-sm font-black heading-font uppercase tracking-wider text-black leading-none">
         {title}
      </h2>
   </div>
);

const BlogCard = ({ post }) => (
  <Link href={`/blog/${post.slug}`} className="group block h-full">
    <article className="h-full flex flex-col bg-white border border-neutral-100 overflow-hidden hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-shadow duration-300">
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100 shrink-0">
        {post.image ? (
          <img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {post.category && post.category.trim() && post.category.toLowerCase() !== "uncategorized" && (
            <>
              <span className="text-[9px] font-black tracking-[0.22em] uppercase text-neutral-400">
                {post.category}
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-200 shrink-0" />
            </>
          )}
          <span className="text-[9px] font-semibold tracking-wider text-neutral-400">
            {post.date}
          </span>
        </div>

        {/* Title */}
        <h3
          style={{ fontFamily: "var(--brand-font)" }}
          className="text-[15px] font-bold uppercase tracking-tight text-black leading-snug group-hover:text-neutral-600 transition-colors"
        >
          {post.title}
        </h3>

        {/* Spacer + Read more */}
        <div className="mt-auto pt-4 border-t border-neutral-100 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-[0.15em] text-black uppercase">
            Read More
          </span>
          <ArrowUpRight className="w-4 h-4 text-black/30 group-hover:text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
        </div>
      </div>
    </article>
  </Link>
);

import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";

export default function BlogDetailClient({ post, posts, featuredProduct, postDate }) {
   const { addToCart } = useCart();
   const router = useRouter();

   const handleAddToCart = (e) => {
      e.preventDefault();
      addToCart({
         ...featuredProduct,
         quantity: 1,
         selectedSize: featuredProduct.sizes?.[0] || "Standard",
         selectedColor: featuredProduct.colors?.[0]?.name || "Original"
      });
   };

   const handleBuyNow = (e) => {
      e.preventDefault();
      addToCart({
         ...featuredProduct,
         quantity: 1,
         selectedSize: featuredProduct.sizes?.[0] || "Standard",
         selectedColor: featuredProduct.colors?.[0]?.name || "Original"
      });
      router.push("/checkout");
   };

   const carouselRef = useRef(null);
   const [canScrollLeft, setCanScrollLeft] = useState(false);
   const [canScrollRight, setCanScrollRight] = useState(true);

   const scroll = (direction) => {
      if (carouselRef.current) {
         const { scrollLeft, clientWidth } = carouselRef.current;
         const scrollTo = direction === "left" ? scrollLeft - clientWidth : scrollLeft + clientWidth;
         carouselRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
      }
   };

   const checkScroll = () => {
      if (carouselRef.current) {
         const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
         setCanScrollLeft(scrollLeft > 20);
         setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 20);
      }
   };

   useEffect(() => {
      const current = carouselRef.current;
      if (current) {
         current.addEventListener("scroll", checkScroll);
         checkScroll();
      }
      return () => current?.removeEventListener("scroll", checkScroll);
   }, []);

   const { scrollYProgress } = useScroll();
   const scaleX = useSpring(scrollYProgress, {
      stiffness: 100,
      damping: 30,
      restDelta: 0.001
   });

    // FAQ State
    const [openFaqIdx, setOpenFaqIdx] = useState(null);
    const [shared, setShared] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);

    const handleWebShare = async () => {
       const shareData = {
          title: post.title,
          text: post.excerpt || post.title,
          url: window.location.href
       };
       if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          try {
             await navigator.share(shareData);
             return;
          } catch (err) {
             if (err.name !== "AbortError") {
                console.error(err);
             } else {
                return;
             }
          }
       }
       setShowShareMenu(!showShareMenu);
    };

    // Dynamically extract H1, H2, H3 headings from all post content for the sidebar TOC
    const [tocSections, setTocSections] = useState([]);

    useEffect(() => {
       const allContent = post.content || "";

       if (!allContent) {
          setTocSections([]);
          return;
       }

       try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(allContent, "text/html");
          const headings = Array.from(doc.querySelectorAll("h1, h2, h3"));
          const extracted = headings.map((el, i) => {
             const text = el.textContent.trim();
             const id = `toc-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${i}`;
             return { id, title: text };
          });
          setTocSections(extracted);
       } catch (e) {
          setTocSections([]);
       }
    }, [post]);

    // Add IDs to elements in the rendered blog content after mount with safety delay
    useEffect(() => {
       if (tocSections.length === 0) return;
       
       const assignIds = () => {
          const contentEl = document.querySelector(".blog-content");
          if (!contentEl) return;
          const headings = contentEl.querySelectorAll("h1, h2, h3");
          headings.forEach((el, i) => {
             if (tocSections[i]) {
                el.id = tocSections[i].id;
             }
          });
       };

       assignIds();
       const timer = setTimeout(assignIds, 100);
       return () => clearTimeout(timer);
    }, [tocSections, post.content]);

     const scrollToSection = (id, title) => {
        let element = document.getElementById(id);
        if (!element && title) {
           // Fallback: search headings in .blog-content for matching text
           const contentEl = document.querySelector(".blog-content");
           if (contentEl) {
              const headings = Array.from(contentEl.querySelectorAll("h1, h2, h3"));
              element = headings.find(h => h.textContent.trim() === title);
           }
        }
        if (!element) return;
        const navbarHeight = 90;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = element.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - navbarHeight;
        window.scrollTo({
           top: offsetPosition,
           behavior: "smooth"
        });
     };

   return (
      <main className="bg-white min-h-screen selection:bg-black selection:text-white">
         <style dangerouslySetInnerHTML={{
            __html: `
         .blog-content {
           font-family: var(--body-font), sans-serif !important;
           font-size: 14px !important;
           line-height: 1.8 !important;
         }
         .blog-content p, .blog-content li {
           color: #4a4a4a !important;
           font-weight: 400 !important;
         }
         .blog-content p {
           margin-bottom: 1.25rem !important;
         }
        .blog-content h1, .blog-content h2, .blog-content h3, .blog-content h4 {
          font-family: var(--brand-font), sans-serif !important;
          text-transform: uppercase !important;
          margin-top: 2rem !important;
          margin-bottom: 1rem !important;
          color: black !important;
          font-weight: 800 !important;
          letter-spacing: -0.01em !important;
        }
        .blog-content h1 { font-size: 22px !important; }
        .blog-content h2 { font-size: 18px !important; }
        .blog-content h3 { font-size: 16px !important; }
        .blog-content h4 { font-size: 14px !important; }
        .blog-content a {
          color: #1a1a1a !important;
          text-decoration: underline !important;
          font-weight: 600 !important;
          transition: all 0.2s ease-in-out !important;
        }
        .blog-content a:hover {
          opacity: 0.7 !important;
        }
        .blog-content img {
          border-radius: 8px;
          max-width: 100%;
          height: auto;
        }
        .blog-content img[data-align="center"], .blog-content img:not([data-align]) {
          margin: 1.5rem auto;
          display: block;
        }
        .blog-content img[data-align="left"] {
          margin: 1.5rem auto 1.5rem 0;
          display: block;
        }
        .blog-content img[data-align="right"] {
          margin: 1.5rem 0 1.5rem auto;
          display: block;
        }
        .blog-content img[data-align="float-left"] {
          float: left;
          margin: 0.5rem 1.5rem 1rem 0;
          display: inline-block;
        }
        .blog-content img[data-align="float-right"] {
          float: right;
          margin: 0.5rem 0 1rem 1.5rem;
          display: inline-block;
        }
      `}} />
         <motion.div className="fixed top-0 left-0 right-0 h-0.5 bg-black origin-left z-[100]" style={{ scaleX }} />

          <div className="container mx-auto px-2 sm:px-4 md:px-8 pt-5 pb-2 border-b border-b-black/5">
             <div className="flex justify-between items-center">
                <Link href="/blog" className="flex items-center gap-2 text-black font-bold text-[9px] uppercase tracking-[0.2em] hover:opacity-50 transition-all">
                   <ArrowLeft className="w-3.5 h-3.5" />
                   blog
                </Link>
                <div className="relative">
                   <button 
                      onClick={handleWebShare}
                      className="flex items-center gap-2 text-black hover:opacity-75 transition-all font-bold text-[9px] uppercase tracking-[0.2em]"
                   >
                      <Share2 className="w-3.5 h-3.5" />
                      Share Story
                   </button>
                   <AnimatePresence>
                      {showShareMenu && (
                         <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                            <motion.div 
                               initial={{ opacity: 0, y: 10, scale: 0.95 }}
                               animate={{ opacity: 1, y: 0, scale: 1 }}
                               exit={{ opacity: 0, y: 10, scale: 0.95 }}
                               className="absolute right-0 mt-2 w-48 bg-white border border-black/10 rounded-[4px] shadow-lg p-1.5 z-50 flex flex-col gap-0.5"
                            >
                               <button 
                                  onClick={() => {
                                     navigator.clipboard.writeText(window.location.href);
                                     setShared(true);
                                     setShowShareMenu(false);
                                     setTimeout(() => setShared(false), 2000);
                                  }}
                                  className="w-full text-left px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-black hover:bg-neutral-50 rounded-[2px] transition-colors flex items-center justify-between"
                               >
                                  <span>{shared ? "Link Copied!" : "Copy Link"}</span>
                               </button>
                               <a 
                                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(post.title + " - " + window.location.href)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full text-left px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-black hover:bg-neutral-50 rounded-[2px] transition-colors"
                                  onClick={() => setShowShareMenu(false)}
                               >
                                  WhatsApp
                               </a>
                               <a 
                                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(post.title)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full text-left px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-black hover:bg-neutral-50 rounded-[2px] transition-colors"
                                  onClick={() => setShowShareMenu(false)}
                               >
                                  X / Twitter
                               </a>
                               <a 
                                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full text-left px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-black hover:bg-neutral-50 rounded-[2px] transition-colors"
                                  onClick={() => setShowShareMenu(false)}
                               >
                                  Facebook
                               </a>
                            </motion.div>
                         </>
                      )}
                   </AnimatePresence>
                </div>
             </div>
          </div>

          <header className="pt-6 pb-4 md:pt-8 md:pb-6 border-b border-black/5">
             <div className="container mx-auto px-2 sm:px-4 md:px-8">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold heading-font tracking-tight text-black leading-tight mb-2 max-w-4xl">
                   {post.title}
                </h1>
             </div>
          </header>

         <div className="container mx-auto px-2 sm:px-4 md:px-8 py-4 md:py-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-14">
               <div id="blog-main-content" className="lg:col-span-8">
                  <div className="aspect-[16/9] rounded-[4px] overflow-hidden border border-black/5 shadow-sm mb-6">
                     <img src={post.image} alt={post.imageAlts?.[post.image] || post.title || "Blog Image"} className="w-full h-full object-cover" />
                  </div>

                  <div className="block lg:hidden bg-[#FAF9F6] border border-black/[0.04] rounded-[4px] p-5 mb-6 space-y-6">
                     {/* Article Overview */}
                     <div className="space-y-3">
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400">Article Overview</span>
                        {post.excerpt && (
                           <div className="space-y-1">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-black">Synopsis</h4>
                              <p className="text-xs text-neutral-700 leading-relaxed font-medium">
                                 {post.excerpt}
                              </p>
                           </div>
                        )}
                        <div className={`${post.excerpt ? 'pt-3.5 border-t border-black/5' : ''} flex flex-col gap-2.5`}>
                           <div className="flex justify-between items-center text-xs text-black">
                              <span className="font-medium text-neutral-500">Author</span>
                              <span className="font-semibold">{post.author || "Pairo Studio"}</span>
                           </div>
                           <div className="flex justify-between items-center text-xs text-black">
                              <span className="font-medium text-neutral-500">Published</span>
                              <span className="font-semibold">{postDate}</span>
                           </div>
                           {post.category && post.category.trim() !== "" && post.category.toLowerCase() !== "uncategorized" && (
                              <div className="flex justify-between items-center text-xs text-black">
                                 <span className="font-medium text-neutral-500">Category</span>
                                 <span className="font-semibold">{post.category}</span>
                              </div>
                           )}
                        </div>
                     </div>

                     {/* Table of Contents (only if enabled) */}
                     {post.showSidebarIndex !== false && (
                        <div className="pt-5 border-t border-black/5 space-y-3">
                           <span className="text-xs font-bold uppercase tracking-wider text-black block mb-2">Table of Contents</span>
                           <div className="flex flex-col gap-2">
                              {tocSections.length > 0 ? (
                                 tocSections.map((section) => (
                                    <button
                                       key={section.id}
                                       onClick={() => scrollToSection(section.id, section.title)}
                                       className="group flex items-center justify-between text-left py-1 hover:opacity-75 transition-all"
                                    >
                                       <span className="text-sm font-normal text-black group-hover:underline transition-all text-left leading-relaxed">
                                          {section.title}
                                       </span>
                                       <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-black transition-colors shrink-0 ml-3" />
                                    </button>
                                 ))
                              ) : (
                                 <p className="text-[10px] text-neutral-400 italic">No sections found</p>
                              )}
                           </div>
                        </div>
                     )}
                  </div>

                  <div className="w-full space-y-8 md:space-y-12">
                     {/* General Content */}
                     {post.content && (() => {
                        let sanitizedContent = (post.content || "")
                           .replace(/<h1([^>]*)>/gi, "<h2$1>")
                           .replace(/<\/h1>/gi, "</h2>");
                        sanitizedContent = makeInternalLinksDofollow(sanitizedContent);
                        return (
                           <section id="general" className="scroll-mt-32">
                              <div
                                 className="text-sm md:text-base leading-relaxed space-y-4 blog-content"
                                 dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                              />
                           </section>
                        );
                     })()}

                       {/* FAQ Section */}
                       {post.faqs && post.faqs.length > 0 && (
                          <section id="faq" className="pt-12 border-t border-black/5 space-y-6">
                             <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-4 border-b border-black/[0.06]">
                                <div className="space-y-1">
                                   <span className="text-[10px] font-bold tracking-[0.25em] text-neutral-400 uppercase">INQUIRIES</span>
                                   <h2 className="text-xl font-extrabold heading-font text-black uppercase tracking-tight">Frequently Asked Questions</h2>
                                </div>
                             </div>
                             
                             <div className="space-y-3">
                                {post.faqs.map((faq, idx) => {
                                   const isOpen = openFaqIdx === idx;
                                   return (
                                      <div 
                                         key={idx} 
                                         className={`border border-black/5 rounded-[4px] transition-all duration-300 overflow-hidden ${
                                            isOpen ? "bg-[#FAF9F6] border-black/10 shadow-sm" : "bg-white hover:bg-neutral-50/50"
                                         }`}
                                      >
                                         <button
                                            type="button"
                                            onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                                            className="w-full flex justify-between items-center text-left p-5 group focus:outline-none"
                                         >
                                            <div className="flex items-center">
                                               <span className="font-mono text-[9px] font-bold text-neutral-400 mr-4 tracking-wider">
                                                  {String(idx + 1).padStart(2, '0')} //
                                               </span>
                                               <h3 className="text-sm font-bold uppercase tracking-wide text-black group-hover:opacity-75 transition-opacity pr-4 leading-snug">
                                                  {faq.question}
                                               </h3>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border border-black/5 flex items-center justify-center transition-all duration-300 ${
                                               isOpen ? "bg-black border-black text-white rotate-180" : "bg-white text-black group-hover:border-black/20"
                                            }`}>
                                               <ChevronDown className="w-3.5 h-3.5" />
                                            </div>
                                         </button>
                                         
                                         <AnimatePresence initial={false}>
                                            {isOpen && (
                                               <motion.div
                                                  initial={{ height: 0, opacity: 0 }}
                                                  animate={{ height: "auto", opacity: 1 }}
                                                  exit={{ height: 0, opacity: 0 }}
                                                  transition={{ duration: 0.25, ease: "easeInOut" }}
                                               >
                                                  <div className="px-5 pb-5 pl-[45px] border-t border-black/[0.03] pt-4">
                                                     <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed font-medium">
                                                        {faq.answer}
                                                     </p>
                                                  </div>
                                               </motion.div>
                                            )}
                                         </AnimatePresence>
                                      </div>
                                   );
                                })}
                             </div>
                          </section>
                       )}

                   </div>
               </div>

                <div className="lg:col-span-4 relative">
                   <aside className="sticky top-24 space-y-8 lg:pl-6 lg:border-l lg:border-black/5 border-t border-t-black/5 lg:border-t-0 pt-8 lg:pt-0 mt-8 lg:mt-0">
                      {/* Article Overview Widget */}
                      <div className="hidden lg:block space-y-3">
                         <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400">Article Overview</span>
                         <div className="p-5 bg-[#FAF9F6] border border-black/[0.04] rounded-[4px] space-y-4">
                            {post.excerpt && (
                               <div className="space-y-1">
                                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-black">Synopsis</h3>
                                  <p className="text-xs text-neutral-700 leading-relaxed font-medium">
                                     {post.excerpt}
                                  </p>
                               </div>
                            )}
                             <div className={`${post.excerpt ? 'pt-3.5 border-t border-black/5' : ''} flex flex-col gap-2.5`}>
                                <div className="flex justify-between items-center text-xs text-black">
                                   <span className="font-medium text-neutral-500">Author</span>
                                   <span className="font-semibold">{post.author || "Pairo Studio"}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-black">
                                   <span className="font-medium text-neutral-500">Published</span>
                                   <span className="font-semibold">{postDate}</span>
                                </div>
                                {post.category && post.category.trim() !== "" && post.category.toLowerCase() !== "uncategorized" && (
                                   <div className="flex justify-between items-center text-xs text-black">
                                      <span className="font-medium text-neutral-500">Category</span>
                                      <span className="font-semibold">{post.category}</span>
                                   </div>
                                )}
                             </div>
                          </div>
                       </div>

                        {post.showSidebarIndex !== false && (
                           <div className="hidden lg:block space-y-3 pt-6 border-t border-black/5">
                              <h2 className="text-xs font-bold uppercase tracking-wider text-black block mb-2">Table of Contents</h2>
                              <div className="flex flex-col gap-2">
                                 {tocSections.length > 0 ? (
                                    tocSections.map((section) => (
                                       <button
                                          key={section.id}
                                          onClick={() => scrollToSection(section.id, section.title)}
                                          className="group flex items-center justify-between text-left py-1 hover:opacity-75 transition-all"
                                       >
                                          <span className="text-sm font-normal text-black group-hover:underline transition-all text-left leading-relaxed">
                                             {section.title}
                                          </span>
                                          <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-black transition-colors shrink-0 ml-3" />
                                       </button>
                                    ))
                                 ) : (
                                    <p className="text-[10px] text-neutral-400 italic">No sections found</p>
                                 )}
                              </div>
                           </div>
                        )}

                      {post.showFeaturedProduct !== false && featuredProduct && featuredProduct.id !== "default" && (
                         <div id="archive" className="space-y-4 pt-6 border-t border-black/5">
                            <span className="text-xs font-bold uppercase tracking-wider text-black block mb-2">SHOP PIECE</span>
                           <Link href={getProductUrl(featuredProduct)} className="block aspect-square rounded-[4px] overflow-hidden border border-black/5 group cursor-pointer relative">
                              <img src={featuredProduct.images?.[0] || featuredProduct.image} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                           </Link>
                           <div className="space-y-1">
                              <h4 className="text-xs font-bold heading-font text-black uppercase">{featuredProduct.name}</h4>
                              {featuredProduct.price && (
                                 <p className="text-[10px] font-bold text-black">${featuredProduct.price}</p>
                              )}
                           </div>

                           <div className="space-y-2.5">
                              <Link
                                 href={getProductUrl(featuredProduct)}
                                 className="flex items-center justify-center gap-2 w-full bg-black text-white py-3.5 rounded-[4px] font-bold text-[9px] uppercase tracking-[0.2em] hover:bg-neutral-900 transition-all shadow-lg active:scale-[0.98]"
                              >
                                 Go to product
                                 <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                              <div className="grid grid-cols-2 gap-2">
                                 <button
                                    onClick={handleAddToCart}
                                    className="flex items-center justify-center gap-2 w-full border border-black text-black py-3.5 rounded-[4px] font-bold text-[9px] uppercase tracking-[0.1em] hover:bg-black hover:text-white transition-all active:scale-[0.98]"
                                 >
                                    Add to cart
                                 </button>
                                 <button
                                    onClick={handleBuyNow}
                                    className="flex items-center justify-center gap-2 w-full bg-[#111] text-white py-3.5 rounded-[4px] font-bold text-[9px] uppercase tracking-[0.1em] hover:bg-black transition-all shadow-md active:scale-[0.98]"
                                 >
                                    Buy now
                                 </button>
                              </div>
                           </div>
                        </div>
                     )}

                  </aside>
               </div>
            </div>
         </div>

         <section className="bg-[#FBFBFB] py-12 md:py-16 border-y border-black/5 overflow-hidden">
            <div className="container mx-auto px-2 sm:px-4 md:px-8">
               <div className="flex items-end justify-between mb-8">
                  <div className="space-y-1">
                     <span className="text-[8px] font-black tracking-[0.25em] text-black uppercase">DISCOVER MORE</span>
                     <h2 className="text-lg md:text-xl font-bold heading-font text-black uppercase">RELATED STORIES</h2>
                  </div>
                  <div className="flex items-center gap-2">
                     <button onClick={() => scroll("left")} className={`w-8 h-8 rounded-full border border-black/10 flex items-center justify-center transition-all ${canScrollLeft ? "text-black hover:bg-black hover:text-white" : "text-black/30 cursor-default"}`}><ChevronLeft className="w-4 h-4" /></button>
                     <button onClick={() => scroll("right")} className={`w-8 h-8 rounded-full border border-black/10 flex items-center justify-center transition-all ${canScrollRight ? "text-black hover:bg-black hover:text-white" : "text-black/30 cursor-default"}`}><ChevronRight className="w-4 h-4" /></button>
                  </div>
               </div>
               <div className="relative -mx-4 md:-mx-0">
                  <div ref={carouselRef} className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 md:px-0">
                     {posts.map((rPost) => (
                        <div key={rPost.id} className="w-[70vw] sm:w-[35vw] md:w-[25vw] lg:w-[20vw] shrink-0 snap-start">
                           <BlogCard post={rPost} />
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </section>

      </main>
   );
}

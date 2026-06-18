"use client";

import { useSiteData } from "@/context/SiteContext";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import logo from "../../assets/pairo.webp";

const FacebookIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
);

const InstagramIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
);

const TwitterIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
);

const LinkedinIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
);

const YoutubeIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
);

const TiktokIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
);

const GlobeIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
);

const SOCIAL_ICONS = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  twitter: TwitterIcon,
  linkedin: LinkedinIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
};

export default function Footer() {
  const siteData = useSiteData();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!siteData) return null;

  const { footer, categories, footerConfig, socialLinks, brand, _dbCategories, _dbBlogs } = siteData;
  const fc = footerConfig || {};

  // ── Column 1 - Newsletter ──
  const newsletterHeading = fc.newsletterHeading || 'Elite List';
  const newsletterPlaceholder = fc.newsletterPlaceholder || 'JOIN THE LIST';

  // ── Column 2 - Categories ──
  const footerCategories = (() => {
    if (fc.footerCategoryIds && fc.footerCategoryIds.length > 0 && _dbCategories?.length > 0) {
      return fc.footerCategoryIds
        .map(slug => _dbCategories.find(c => c.slug === slug))
        .filter(Boolean);
    }
    // Legacy fallback
    return categories?.items || _dbCategories || [];
  })();

  // ── Column 3 - Blog Posts ──
  const footerBlogHeading = fc.footerBlogHeading || 'Journal';
  const footerBlogs = (() => {
    if (fc.footerBlogIds && fc.footerBlogIds.length > 0 && _dbBlogs?.length > 0) {
      return fc.footerBlogIds
        .map(id => _dbBlogs.find(b => b._id?.toString() === id))
        .filter(Boolean);
    }
    return [];
  })();

  // ── Column 4 - Custom Links ──
  const footerCustomLinksHeading = fc.footerCustomLinksHeading || 'Information';
  const footerCustomLinks = (fc.footerCustomLinks || []).sort((a, b) => (a.order || 0) - (b.order || 0));

  // Legacy fallback for column 4 (information links)
  const legacyInfoLinks = footer?.sections?.[1]?.links || [];

  // ── Social Links ──
  const activeSocialLinks = (socialLinks || []).filter(s => s.enabled && s.url);

  // ── Brand section ──
  const footerBrandName = brand?.footerBrandName || 'PAIRO';
  const copyrightText = brand?.copyrightText || 'PAIRO — ALL RIGHTS RESERVED © 2026.';
  const privacyUrl = brand?.privacyUrl || '#';
  const termsUrl = brand?.termsUrl || '#';

  // ── Footer Logo ──
  const footerLogoUrl = fc.logoUrl;

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "You're on the list!");
        setEmail('');
      } else {
        toast.error(data.error || "Something went wrong.");
      }
    } catch {
      toast.error("Failed to subscribe. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: [0.215, 0.61, 0.355, 1] } }
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: i => ({
      opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.8, ease: [0.215, 0.61, 0.355, 1] }
    })
  };

  return (
    <footer className="bg-black text-white pt-16 md:pt-24 pb-12 overflow-hidden relative z-10 border-t border-white/10">
      <div className="container mx-auto px-6 md:px-16 relative z-20">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: false }} variants={containerVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 pb-12 border-b border-white/10">
          <motion.div variants={itemVariants}>
            <Link href="/" className="flex-shrink-0">



              <Image src={logo} alt="Pairo Logo" width={110} height={40} className="object-contain h-10 w-auto" />

            </Link>
          </motion.div>
          <motion.div variants={itemVariants} className="flex items-center gap-8">
            {activeSocialLinks.length > 0 ? (
              activeSocialLinks.map(sl => {
                const Icon = SOCIAL_ICONS[sl.platform.toLowerCase()] || GlobeIcon;
                return (
                  <Link key={sl.platform} href={sl.url} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </Link>
                );
              })
            ) : (
              // Legacy fallback icons (placeholder)
              <>
                <Link href="#" className="text-white/60 hover:text-white transition-colors"><FacebookIcon className="w-5 h-5" /></Link>
                <Link href="#" className="text-white/60 hover:text-white transition-colors"><InstagramIcon className="w-5 h-5" /></Link>
                <Link href="#" className="text-white/60 hover:text-white transition-colors"><TwitterIcon className="w-5 h-5" /></Link>
              </>
            )}
          </motion.div>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: false }} variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 py-16">
          {/* Column 1 — Newsletter */}
          <motion.div variants={itemVariants} className="space-y-6">
            <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-[0.4em]">{newsletterHeading}</h3>
            <form onSubmit={handleNewsletterSubmit} className="relative group max-w-sm">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={newsletterPlaceholder}
                disabled={submitting}
                className="w-full bg-transparent border-b border-white/20 py-3 px-0 text-[10px] font-bold tracking-[0.2em] focus:outline-none focus:border-white transition-colors uppercase disabled:opacity-50"
              />
              <button type="submit" disabled={submitting} className="absolute right-0 top-1/2 -translate-y-1/2 text-white/40 group-hover:text-white transition-colors disabled:opacity-50">
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>

          {/* Column 2 — Product Categories */}
          <motion.div variants={itemVariants} className="space-y-6">
            <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-[0.4em]">Collections</h3>
            <ul className="space-y-3">
              {footerCategories.map((cat) => (
                <li key={cat.slug || cat.name}>
                  <Link href={`/shop/${cat.slug}`} className="text-white/70 hover:text-white font-bold text-[9px] uppercase tracking-widest transition-colors block">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Column 3 — Blog Posts */}
          {footerBlogs.length > 0 ? (
            <motion.div variants={itemVariants} className="space-y-6">
              <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-[0.4em]">{footerBlogHeading}</h3>
              <ul className="space-y-3">
                {footerBlogs.map((blog) => (
                  <li key={blog._id?.toString()}>
                    <Link href={`/blog/${blog.slug}`} className="text-white/70 hover:text-white font-bold text-[9px] uppercase tracking-widest transition-colors block">
                      {blog.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : (
            // Render Column 3 as custom links heading if no blog selected (legacy: was blank)
            <motion.div variants={itemVariants} className="space-y-6" />
          )}

          {/* Column 4 — Custom Links */}
          <motion.div variants={itemVariants} className="space-y-6">
            <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-[0.4em]">{footerCustomLinksHeading}</h3>
            <ul className="space-y-3">
              {footerCustomLinks.length > 0 ? (
                footerCustomLinks.map((link) => (
                  <li key={link.id || link.label}>
                    <Link href={link.url || '#'} className="text-white/70 hover:text-white font-bold text-[9px] uppercase tracking-widest transition-colors block">
                      {link.label}
                    </Link>
                  </li>
                ))
              ) : (
                // Legacy fallback
                legacyInfoLinks.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-white/70 hover:text-white font-bold text-[9px] uppercase tracking-widest transition-colors block">
                      {link.name}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        </motion.div>
      </div>

      {/* Animated Brand Name Section */}
      <div className="relative my-8 md:my-12">
        <div className="text-center px-4">
          <div className="text-[25vw] font-bold heading-font leading-[0.75] uppercase tracking-tighter text-white inline-flex justify-center flex-wrap">
            {footerBrandName.split("").map((letter, i) => (
              <motion.span key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.1 }} variants={letterVariants} className="inline-block">{letter}</motion.span>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 md:px-16 relative z-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-white/10">
          <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest">{copyrightText}</p>
          <div className="flex gap-10">
            <Link href={privacyUrl} className="text-white/50 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors">Privacy</Link>
            <Link href={termsUrl} className="text-white/50 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

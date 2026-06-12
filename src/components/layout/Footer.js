"use client";

import { useSiteData } from "@/context/SiteContext";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Camera, MessageSquare, Globe, Share2, Link2, Users } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import logo from "../../assets/png-file.png";

const SOCIAL_ICONS = {
  facebook: Users,
  instagram: Camera,
  twitter: MessageSquare,
  linkedin: Link2,
  youtube: Share2,
  tiktok: Globe,
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
    <footer className="bg-black text-[#E6E2D3] pt-16 md:pt-24 pb-12 overflow-hidden relative z-10 border-t border-white/5">
      <div className="container mx-auto px-6 md:px-16 relative z-20">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: false }} variants={containerVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 pb-12 border-b border-white/5">
          <motion.div variants={itemVariants}>
            <Link href="/" className="flex-shrink-0">
              {footerLogoUrl ? (
                <Image src={footerLogoUrl} alt="Logo" width={110} height={40} className="object-contain h-10 w-auto" />
              ) : (
                <Image src={logo} alt="Pairo Logo" width={110} height={40} className="object-contain h-10 w-auto" />
              )}
            </Link>
          </motion.div>
          <motion.div variants={itemVariants} className="flex items-center gap-8">
            {activeSocialLinks.length > 0 ? (
              activeSocialLinks.map(sl => {
                const Icon = SOCIAL_ICONS[sl.platform] || Globe;
                return (
                  <Link key={sl.platform} href={sl.url} target="_blank" rel="noopener noreferrer" className="text-[#E6E2D3]/30 hover:text-[#E6E2D3] transition-colors">
                    <Icon className="w-5 h-5" />
                  </Link>
                );
              })
            ) : (
              // Legacy fallback icons (placeholder)
              <>
                <Link href="#" className="text-[#E6E2D3]/30 hover:text-[#E6E2D3] transition-colors"><Camera className="w-5 h-5" /></Link>
                <Link href="#" className="text-[#E6E2D3]/30 hover:text-[#E6E2D3] transition-colors"><MessageSquare className="w-5 h-5" /></Link>
                <Link href="#" className="text-[#E6E2D3]/30 hover:text-[#E6E2D3] transition-colors"><Globe className="w-5 h-5" /></Link>
              </>
            )}
          </motion.div>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: false }} variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 py-16">
          {/* Column 1 — Newsletter */}
          <motion.div variants={itemVariants} className="space-y-6">
            <h3 className="text-[10px] font-bold text-[#E6E2D3]/30 uppercase tracking-[0.4em]">{newsletterHeading}</h3>
            <form onSubmit={handleNewsletterSubmit} className="relative group max-w-sm">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={newsletterPlaceholder}
                disabled={submitting}
                className="w-full bg-transparent border-b border-white/10 py-3 px-0 text-[10px] font-bold tracking-[0.2em] focus:outline-none focus:border-[#E6E2D3] transition-colors uppercase disabled:opacity-50"
              />
              <button type="submit" disabled={submitting} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#E6E2D3]/20 group-hover:text-[#E6E2D3] transition-colors disabled:opacity-50">
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>

          {/* Column 2 — Product Categories */}
          <motion.div variants={itemVariants} className="space-y-6">
            <h3 className="text-[10px] font-bold text-[#E6E2D3]/30 uppercase tracking-[0.4em]">Collections</h3>
            <ul className="space-y-3">
              {footerCategories.map((cat) => (
                <li key={cat.slug || cat.name}>
                  <Link href={`/shop?category=${cat.slug}`} className="text-[#E6E2D3]/40 hover:text-[#E6E2D3] font-bold text-[9px] uppercase tracking-widest transition-colors block">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Column 3 — Blog Posts */}
          {footerBlogs.length > 0 ? (
            <motion.div variants={itemVariants} className="space-y-6">
              <h3 className="text-[10px] font-bold text-[#E6E2D3]/30 uppercase tracking-[0.4em]">{footerBlogHeading}</h3>
              <ul className="space-y-3">
                {footerBlogs.map((blog) => (
                  <li key={blog._id?.toString()}>
                    <Link href={`/blog/${blog.slug}`} className="text-[#E6E2D3]/40 hover:text-[#E6E2D3] font-bold text-[9px] uppercase tracking-widest transition-colors block">
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
            <h3 className="text-[10px] font-bold text-[#E6E2D3]/30 uppercase tracking-[0.4em]">{footerCustomLinksHeading}</h3>
            <ul className="space-y-3">
              {footerCustomLinks.length > 0 ? (
                footerCustomLinks.map((link) => (
                  <li key={link.id || link.label}>
                    <Link href={link.url || '#'} className="text-[#E6E2D3]/40 hover:text-[#E6E2D3] font-bold text-[9px] uppercase tracking-widest transition-colors block">
                      {link.label}
                    </Link>
                  </li>
                ))
              ) : (
                // Legacy fallback
                legacyInfoLinks.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-[#E6E2D3]/40 hover:text-[#E6E2D3] font-bold text-[9px] uppercase tracking-widest transition-colors block">
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
          <div className="text-[25vw] font-bold heading-font leading-[0.75] uppercase tracking-tighter text-[#E6E2D3] inline-flex justify-center flex-wrap">
            {footerBrandName.split("").map((letter, i) => (
              <motion.span key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.1 }} variants={letterVariants} className="inline-block">{letter}</motion.span>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 md:px-16 relative z-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-white/5">
          <p className="text-[#E6E2D3]/20 text-[9px] font-bold uppercase tracking-widest">{copyrightText}</p>
          <div className="flex gap-10">
            <Link href={privacyUrl} className="text-[#E6E2D3]/20 hover:text-[#E6E2D3] text-[9px] font-bold uppercase tracking-widest transition-colors">Privacy</Link>
            <Link href={termsUrl} className="text-[#E6E2D3]/20 hover:text-[#E6E2D3] text-[9px] font-bold uppercase tracking-widest transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

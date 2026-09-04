"use client";

import { useSiteData } from "@/context/SiteContext";
import { getCategoryUrl } from "@/lib/routes";
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

const WhatsappIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
  </svg>
);

const SOCIAL_ICONS = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  twitter: TwitterIcon,
  linkedin: LinkedinIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  whatsapp: WhatsappIcon,
};

// ── Dynamic Column Renderer ────────────────────────────────────────────────────
function FooterColumn({ col, siteData, handleNewsletterSubmit, email, setEmail, submitting, itemVariants }) {
  const { _dbCategories, _dbBlogs, _dbPages } = siteData;

  const heading = col.heading || '';

  // ── Newsletter ──
  if (col.type === 'newsletter') {
    return (
      <motion.div variants={itemVariants} className="space-y-6">
        <p className="text-[13px] font-bold text-white/90 uppercase tracking-[0.2em]">{heading}</p>
        <form onSubmit={handleNewsletterSubmit} className="relative group max-w-sm">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="JOIN THE LIST"
            disabled={submitting}
            className="w-full bg-transparent border-b border-white/20 py-3 px-0 text-[12px] font-bold tracking-[0.15em] focus:outline-none focus:border-white transition-colors uppercase disabled:opacity-50"
          />
          <button type="submit" disabled={submitting} className="absolute right-0 top-1/2 -translate-y-1/2 text-white/40 group-hover:text-white transition-colors disabled:opacity-50">
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </form>
      </motion.div>
    );
  }

  // ── Collections ──
  if (col.type === 'collections') {
    const cats = (col.categoryIds || [])
      .map(slug => (_dbCategories || []).find(c => c.slug === slug))
      .filter(Boolean);
    return (
      <motion.div variants={itemVariants} className="space-y-6">
        <p className="text-[13px] font-bold text-white/90 uppercase tracking-[0.2em]">{heading}</p>
        <ul className="space-y-3">
          {cats.map(cat => (
            <li key={cat.slug || cat.name}>
              <Link href={getCategoryUrl(cat)} className="text-white/80 hover:text-white font-bold text-[12px] uppercase tracking-wider transition-colors block">
                {cat.name}
              </Link>
            </li>
          ))}
        </ul>
      </motion.div>
    );
  }

  // ── Blog Posts ──
  if (col.type === 'blog_posts') {
    const blogs = (col.blogIds || [])
      .map(id => (_dbBlogs || []).find(b => b._id?.toString() === id))
      .filter(Boolean);
    return (
      <motion.div variants={itemVariants} className="space-y-6">
        <p className="text-[13px] font-bold text-white/90 uppercase tracking-[0.2em]">{heading}</p>
        <ul className="space-y-3">
          {blogs.map(blog => (
            <li key={blog._id?.toString()}>
              <Link href={`/blog/${blog.slug}`} className="text-white/80 hover:text-white font-bold text-[12px] uppercase tracking-wider transition-colors block">
                {blog.title}
              </Link>
            </li>
          ))}
        </ul>
      </motion.div>
    );
  }

  // ── Pages ──
  if (col.type === 'pages') {
    const pages = (col.pageIds || [])
      .map(id => (_dbPages || []).find(p => p._id?.toString() === id))
      .filter(Boolean);
    return (
      <motion.div variants={itemVariants} className="space-y-6">
        <p className="text-[13px] font-bold text-white/90 uppercase tracking-[0.2em]">{heading}</p>
        <ul className="space-y-3">
          {pages.map(page => {
            const href = page.slug ? `/${page.slug}` : '#';
            return (
              <li key={page._id?.toString()}>
                <Link href={href} className="text-white/80 hover:text-white font-bold text-[12px] uppercase tracking-wider transition-colors block">
                  {page.title || page.slug}
                </Link>
              </li>
            );
          })}
        </ul>
      </motion.div>
    );
  }

  // ── Custom Links (default) ──
  const links = (col.customLinks || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  return (
    <motion.div variants={itemVariants} className="space-y-6">
      <p className="text-[13px] font-bold text-white/90 uppercase tracking-[0.2em]">{heading}</p>
      <ul className="space-y-3">
        {links.map(link => {
          const href = link.url || '#';
          const resolved = href === '/home' || href === 'home' ? '/' : href;
          return (
            <li key={link.id || link.label}>
              <Link href={resolved} className="text-white/80 hover:text-white font-bold text-[12px] uppercase tracking-wider transition-colors block">
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

export default function Footer() {
  const siteData = useSiteData();
  const [email, setEmail] = useState('');
  const [hpField, setHpField] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!siteData) return null;

  const { footer, categories, footerConfig, socialLinks, brand, _dbCategories, _dbBlogs } = siteData;
  const fc = footerConfig || {};

  // ── Dynamic columns (new system) ──
  const footerColumns = (fc.footerColumns || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const useDynamicColumns = footerColumns.length > 0;

  // ── Legacy: Column 1 - Newsletter ──
  const newsletterHeading = fc.newsletterHeading || 'Elite List';
  const newsletterPlaceholder = fc.newsletterPlaceholder || 'JOIN THE LIST';

  // ── Legacy: Column 2 - Categories ──
  const footerCategories = (() => {
    if (fc.footerCategoryIds?.length > 0 && _dbCategories?.length > 0) {
      return fc.footerCategoryIds.map(slug => _dbCategories.find(c => c.slug === slug)).filter(Boolean);
    }
    return categories?.items || _dbCategories || [];
  })();

  // ── Legacy: Column 3 - Blog Posts ──
  const footerBlogHeading = fc.footerBlogHeading || 'Journal';
  const footerBlogs = (() => {
    if (fc.footerBlogIds?.length > 0 && _dbBlogs?.length > 0) {
      return fc.footerBlogIds.map(id => _dbBlogs.find(b => b._id?.toString() === id)).filter(Boolean);
    }
    return [];
  })();

  // ── Legacy: Column 4 - Custom Links ──
  const footerCustomLinksHeading = fc.footerCustomLinksHeading || 'Information';
  const footerCustomLinks = (fc.footerCustomLinks || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  const legacyInfoLinks = footer?.sections?.[1]?.links || [];

  // ── Social Links ──
  const activeSocialLinks = (socialLinks || []).filter(s => s.url);
  if (brand?.whatsappUrl && !activeSocialLinks.some(s => s.platform.toLowerCase() === 'whatsapp')) {
    activeSocialLinks.push({ platform: 'whatsapp', url: brand.whatsappUrl, enabled: true });
  }

  // ── Brand & Bottom Links section ──
  const rawBrandName = brand?.footerBrandName || 'PAiRO';
  const footerBrandName = rawBrandName.replace(/./g, char => char.toLowerCase() === 'i' ? 'i' : char.toUpperCase());
  const rawCopyright = brand?.copyrightText || fc?.copyrightText || 'PAiRO — ALL RIGHTS RESERVED © 2026.';
  const copyrightText = rawCopyright.replace(/pairo/gi, 'PAiRO');

  const privacyLabel = fc?.privacyLabel || 'Privacy';
  const privacyUrl = fc?.privacyUrl || (fc?.privacyPageSlug
    ? `/${fc.privacyPageSlug.replace(/^\/?pages\//, '').replace(/^\//, '')}`
    : (brand?.privacyUrl || ''));
  const showPrivacy = fc?.showPrivacyLink !== false && (!!privacyUrl && privacyUrl !== '#');

  const termsLabel = fc?.termsLabel || 'Terms';
  const termsUrl = fc?.termsUrl || (fc?.termsPageSlug
    ? `/${fc.termsPageSlug.replace(/^\/?pages\//, '').replace(/^\//, '')}`
    : (brand?.termsUrl || ''));
  const showTerms = fc?.showTermsLink !== false && (!!termsUrl && termsUrl !== '#');

  const sitemapLabel = fc?.sitemapLabel || 'Sitemap';
  const sitemapUrl = fc?.sitemapUrl || '/sitemap';
  const showSitemap = fc?.showSitemapLink !== false;

  // ── Footer Logo ──
  const footerLogoUrl = fc?.logoUrl || brand?.logoUrl || brand?.logo || null;

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    if (hpField) {
      toast.success("You're on the list!");
      setEmail('');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, hp_field: hpField, sourcePage: 'Footer' })
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

  // Grid class based on column count
  const gridColsClass = useDynamicColumns
    ? {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
      6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-6',
    }[Math.min(footerColumns.length, 6)] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <footer className="bg-black text-white pt-16 md:pt-24 pb-12 overflow-hidden relative z-10 border-t border-white/10">
      <div className="container mx-auto px-2 sm:px-4 md:px-8 relative z-20">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: false }} variants={containerVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 pb-12 border-b border-white/10">
          <motion.div variants={itemVariants}>
            <Link href="/" className="flex-shrink-0 block">
              {footerLogoUrl ? (
                <img
                  src={footerLogoUrl}
                  alt={brand?.name || "Pairo Logo"}
                  className="object-contain h-10 w-auto max-h-10"
                />
              ) : (
                <Image
                  src={logo}
                  alt={brand?.name || "Pairo Logo"}
                  width={110}
                  height={40}
                  className="object-contain h-10 w-auto"
                />
              )}
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
              <>
                <Link href="#" className="text-white/60 hover:text-white transition-colors"><FacebookIcon className="w-5 h-5" /></Link>
                <Link href="#" className="text-white/60 hover:text-white transition-colors"><InstagramIcon className="w-5 h-5" /></Link>
                <Link href="#" className="text-white/60 hover:text-white transition-colors"><TwitterIcon className="w-5 h-5" /></Link>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* ── Columns ── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false }}
          variants={containerVariants}
          className={`grid ${gridColsClass} gap-12 py-16`}
        >
          {useDynamicColumns ? (
            // ── NEW: Dynamic columns ──
            footerColumns.map((col, idx) => (
              <FooterColumn
                key={col.id || idx}
                col={col}
                siteData={siteData}
                handleNewsletterSubmit={handleNewsletterSubmit}
                email={email}
                setEmail={setEmail}
                submitting={submitting}
                itemVariants={itemVariants}
              />
            ))
          ) : (
            // ── LEGACY: Hardcoded 4 columns ──
            <>
              {/* Column 1 — Newsletter */}
              <motion.div variants={itemVariants} className="space-y-6">
                <p className="text-[13px] font-bold text-white/90 uppercase tracking-[0.2em]">{newsletterHeading}</p>
                <form onSubmit={handleNewsletterSubmit} className="relative group max-w-sm">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={newsletterPlaceholder}
                    disabled={submitting}
                    className="w-full bg-transparent border-b border-white/20 py-3 px-0 text-[12px] font-bold tracking-[0.15em] focus:outline-none focus:border-white transition-colors uppercase disabled:opacity-50"
                  />
                  <button type="submit" disabled={submitting} className="absolute right-0 top-1/2 -translate-y-1/2 text-white/40 group-hover:text-white transition-colors disabled:opacity-50">
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </form>
              </motion.div>

              {/* Column 2 — Product Categories */}
              <motion.div variants={itemVariants} className="space-y-6">
                <p className="text-[13px] font-bold text-white/90 uppercase tracking-[0.2em]">Collections</p>
                <ul className="space-y-3">
                  {footerCategories.map((cat) => (
                    <li key={cat.slug || cat.name}>
                      <Link href={getCategoryUrl(cat)} className="text-white/80 hover:text-white font-bold text-[12px] uppercase tracking-wider transition-colors block">
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Column 3 — Blog Posts */}
              {footerBlogs.length > 0 ? (
                <motion.div variants={itemVariants} className="space-y-6">
                  <p className="text-[13px] font-bold text-white/90 uppercase tracking-[0.2em]">{footerBlogHeading}</p>
                  <ul className="space-y-3">
                    {footerBlogs.map((blog) => (
                      <li key={blog._id?.toString()}>
                        <Link href={`/blog/${blog.slug}`} className="text-white/80 hover:text-white font-bold text-[13px] uppercase tracking-wider transition-colors block">
                          {blog.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : (
                <motion.div variants={itemVariants} className="space-y-6" />
              )}

              {/* Column 4 — Custom Links */}
              <motion.div variants={itemVariants} className="space-y-6">
                <p className="text-[13px] font-bold text-white/90 uppercase tracking-[0.2em]">{footerCustomLinksHeading}</p>
                <ul className="space-y-3">
                  {footerCustomLinks.length > 0 ? (
                    footerCustomLinks.map((link) => {
                      const href = link.url || '#';
                      const resolvedHref = href === '/home' || href === 'home' || href === '/pages/home' ? '/' : href;
                      return (
                        <li key={link.id || link.label}>
                          <Link href={resolvedHref} className="text-white/80 hover:text-white font-bold text-[13px] uppercase tracking-wider transition-colors block">
                            {link.label}
                          </Link>
                        </li>
                      );
                    })
                  ) : (
                    legacyInfoLinks.map((link) => {
                      const href = link.href;
                      const resolvedHref = href === '/home' || href === 'home' || href === '/pages/home' ? '/' : href;
                      return (
                        <li key={link.name}>
                          <Link href={resolvedHref} className="text-white/80 hover:text-white font-bold text-[13px] uppercase tracking-wider transition-colors block">
                            {link.name}
                          </Link>
                        </li>
                      );
                    })
                  )}
                </ul>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>

      {/* Animated Brand Name Section */}
      <div className="relative my-8 md:my-12">
        <div className="text-center px-4">
          <div className="text-[25vw] font-bold heading-font leading-[0.75] normal-case tracking-tighter text-white inline-flex justify-center flex-wrap select-none">
            {footerBrandName.split("").map((letter, i) => (
              <motion.span key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0.1 }} variants={letterVariants} className="inline-block">{letter}</motion.span>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 md:px-8 relative z-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-white/10">
          <p className="text-white/50 text-[9px] font-bold tracking-widest">
            <span className="normal-case">{copyrightText}</span> | Designed by <a href="https://mohsindesigns.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white underline transition-colors">Mohsin Designs</a>
          </p>
          <div className="flex flex-wrap items-center gap-6 sm:gap-10">
            {showPrivacy && (
              <Link href={privacyUrl} className="text-white/50 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors">
                {privacyLabel}
              </Link>
            )}
            {showTerms && (
              <Link href={termsUrl} className="text-white/50 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors">
                {termsLabel}
              </Link>
            )}
            {showSitemap && (
              <Link href={sitemapUrl} className="text-white/50 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors">
                {sitemapLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

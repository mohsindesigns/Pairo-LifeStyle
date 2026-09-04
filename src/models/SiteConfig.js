import mongoose from 'mongoose';

const SubNavItemSchema = new mongoose.Schema({
  id: { type: String, default: () => Math.random().toString(36).substring(2, 11) },
  label: { type: String, required: true },
  type: { type: String, enum: ['cms_page', 'product_category', 'custom_url', 'external_url'], default: 'custom_url' },
  value: { type: String, default: '' },
  openInNewTab: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
}, { _id: false });

const NavItemSchema = new mongoose.Schema({
  id: { type: String, default: () => Math.random().toString(36).substring(2, 11) },
  label: { type: String, required: true },
  type: { type: String, enum: ['cms_page', 'page', 'product', 'product_category', 'custom_url', 'external_url', 'mega_menu', 'dropdown_category', 'dropdown_product', 'dropdown_custom'], default: 'custom_url' },
  value: { type: String, default: '' },
  href: { type: String, default: '' },
  labelHref: { type: String, default: '' }, // optional link URL for mega menu / dropdown labels
  openInNewTab: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true },
  hasMegaMenu: { type: Boolean, default: false }, // legacy field
  dropdownType: { type: String, enum: ['none', 'simple', 'mega'], default: 'none' }, // legacy field
  subItems: [SubNavItemSchema],
  megaCategoryIds: [String],
  dropdownCategoryIds: [String],
  dropdownProductIds: [String],
  order: { type: Number, default: 0 }
}, { strict: false, _id: false });

const SocialLinkSchema = new mongoose.Schema({
  platform: { type: String },
  url: { type: String, default: '' },
  enabled: { type: Boolean, default: false }
}, { _id: false });

const FooterCustomLinkSchema = new mongoose.Schema({
  id: { type: String, default: () => Math.random().toString(36).substring(2, 11) },
  label: { type: String, default: '' },
  url: { type: String, default: '' },
  order: { type: Number, default: 0 }
}, { _id: false });

// Dynamic footer column — each column is independently typed
const FooterColumnSchema = new mongoose.Schema({
  id: { type: String, default: () => Math.random().toString(36).substring(2, 11) },
  type: { type: String, enum: ['newsletter', 'collections', 'blog_posts', 'pages', 'custom_links'], default: 'custom_links' },
  heading: { type: String, default: '' },
  order: { type: Number, default: 0 },
  // type=collections
  categoryIds: [String],
  // type=blog_posts
  blogIds: [String],
  // type=pages
  pageIds: [String],
  // type=custom_links
  customLinks: [FooterCustomLinkSchema],
}, { _id: false });

const SiteConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'main' },
  disableSearchEngineIndexing: { type: Boolean, default: false },

  // ─── General / Brand ──────────────────────────────────────
  brand: {
    name: String,
    tagline: String,
    description: String,
    footerBrandName: String,      // animated brand name in footer
    copyrightText: String,        // e.g. "PAIRO — ALL RIGHTS RESERVED © 2026"
    privacyUrl: String,
    termsUrl: String,
    whatsappNumber: String,
    whatsappUrl: String,
  },

  // ─── Header Configuration ──────────────────────────────────
  headerConfig: {
    logoUrl: { type: String, default: '' },       // dynamic logo from Media Library
    navItems: [NavItemSchema],                     // full navigation menu
    megaCategoryIds: [String],                     // selected category slugs for mega menu
    topOffers: [String],                           // rotating offer messages in top bar
  },

  // ─── Footer Configuration ──────────────────────────────────
  footerConfig: {
    logoUrl: { type: String, default: '' },        // dynamic footer logo
    // ── Dynamic columns (new system) ──────────────────────────
    footerColumns: [FooterColumnSchema],           // fully dynamic column array
    // ── Bottom Links (Privacy, Terms, Sitemap) ────────────────
    privacyLabel: { type: String, default: 'Privacy' },
    privacyUrl: { type: String, default: '' },
    privacyPageSlug: { type: String, default: '' },
    showPrivacyLink: { type: Boolean, default: true },
    termsLabel: { type: String, default: 'Terms' },
    termsUrl: { type: String, default: '' },
    termsPageSlug: { type: String, default: '' },
    showTermsLink: { type: Boolean, default: true },
    sitemapLabel: { type: String, default: 'Sitemap' },
    sitemapUrl: { type: String, default: '/sitemap' },
    showSitemapLink: { type: Boolean, default: true },
    // ── Legacy fields (backward compat — used when footerColumns is empty) ──
    newsletterHeading: { type: String, default: 'Elite List' },
    newsletterDescription: { type: String, default: '' },
    newsletterPlaceholder: { type: String, default: 'JOIN THE LIST' },
    newsletterButtonText: { type: String, default: 'Subscribe' },
    footerCategoryIds: [String],
    footerBlogIds: [String],
    footerBlogHeading: { type: String, default: 'Blog' },
    footerCustomLinks: [FooterCustomLinkSchema],
    footerCustomLinksHeading: { type: String, default: 'Information' },
  },

  // ─── Social Links ──────────────────────────────────────────
  socialLinks: [SocialLinkSchema],

  // ─── Store Commerce Settings ───────────────────────────────────────────────
  // Global defaults used by the shipping engine, tax service, and checkout
  commerce: {
    storeCurrency: { type: String, default: 'USD' },              // ISO 4217 currency code
    weightUnit:    { type: String, enum: ['kg', 'lb'], default: 'kg' },
    dimensionUnit: { type: String, enum: ['cm', 'in'], default: 'cm' }
  },

  // ─── Legacy fields kept for backward compatibility ─────────
  navigation: {
    offers: [String],
    links: [{ name: String, href: String, hasMegaMenu: Boolean }]
  },
  hero: {
    slides: [{ id: Number, title: String, subtitle: String, image: String, buttonText: String, link: String }],
    labels: Object,
    stats: [{ value: String, label: String }],
    brands: [String]
  },
  categories: {
    title: String,
    label: String,
    viewAll: String,
    items: [{ name: String, slug: String, image: String, className: String }]
  },
  footer: {
    newsletterTitle: String,
    sections: [{ title: String, links: [{ name: String, href: String }] }]
  },
  products: {
    labels: Object
  },
  testimonials: {
    title: String,
    label: String,
    buttonText: String,
    verifiedLabel: String,
    perspectiveLabel: String,
    reviews: [Object]
  },
  blogs: {
    title: String,
    label: String,
    readMore: String,
    featuredProduct: Object,
    posts: [Object]
  }
}, { timestamps: true, strict: false });

delete mongoose.models.SiteConfig;
export default mongoose.model('SiteConfig', SiteConfigSchema);

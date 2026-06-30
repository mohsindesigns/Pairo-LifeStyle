import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import AuthProvider from "@/components/providers/AuthProvider";
import dbConnect from "@/lib/db";
import SiteConfig from "@/models/SiteConfig";
import Category from "@/models/Category";
import Blog from "@/models/Blog";
import Page from "@/models/Page";
import Product from "@/models/Product";
import { SiteProvider } from "@/context/SiteContext";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import ScriptLoader from "@/components/common/ScriptLoader";
import ThemeStyle from "@/components/common/ThemeStyle";
import { Toaster } from "react-hot-toast";
import { cache, Suspense } from "react";
import CookieConsent from "@/components/common/CookieConsent";
import AffiliateTracker from "@/components/common/AffiliateTracker";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-poppins" });

export const revalidate = 60; // Enable ISR, cache public pages for 60 seconds

const getSiteConfig = cache(async () => {
  await dbConnect();
  return await SiteConfig.findOne({ key: 'main' }).maxTimeMS(4000).lean() || null;
});

export async function generateMetadata() {
  try {
    const config = await getSiteConfig();
    if (config?.brand) {
      const name = config.brand.name || "Pairo";
      const tagline = config.brand.tagline || "Premium Shearling Jackets";
      const title = tagline ? `${name} | ${tagline}` : name;
      const metadata = {
        title,
        description: config.brand.description || "Experience the ultimate warmth and luxury with Pairo's handcrafted shearling jackets.",
        metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://pairolifestyle.com"),
        robots: {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        },
      };

      if (config.brand.faviconUrl) {
        const bustUrl = `${config.brand.faviconUrl}?v=${Date.now()}`;
        metadata.icons = {
          icon: [
            { url: bustUrl, type: 'image/png' },
            { url: bustUrl, sizes: '192x192', type: 'image/png' },
            { url: bustUrl, sizes: '512x512', type: 'image/png' },
          ],
          shortcut: bustUrl,
          apple: bustUrl,
        };
      }

      return metadata;
    }
  } catch (error) {
    console.error("Failed to generate metadata", error);
  }

  return {
    title: "Pairo | Premium Shearling Jackets",
    description: "Experience the ultimate warmth and luxury with Pairo's handcrafted shearling jackets.",
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://pairolifestyle.com"),
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

const QUERY_TIMEOUT_MS = 4000;

export default async function RootLayout({ children }) {
  let sanitizedConfig = {
    brand: { name: "Pairo", tagline: "Premium Shearling", footerBrandName: "PAIRO", copyrightText: "PAIRO — ALL RIGHTS RESERVED © 2026", privacyUrl: "#", termsUrl: "#" },
    navigation: { links: [], offers: ["Welcome to Pairo Store"] },
    headerConfig: { logoUrl: '', navItems: [], megaCategoryIds: [], topOffers: ["Welcome to Pairo Store"] },
    footerConfig: { logoUrl: '', newsletterHeading: 'Elite List', newsletterPlaceholder: 'JOIN THE LIST', footerCategoryIds: [], footerBlogIds: [], footerCustomLinks: [], footerCustomLinksHeading: 'Information' },
    socialLinks: [],
    hero: { slides: [], labels: { viewCollection: "View Collection" } },
    footer: { sections: [{}, { links: [] }] },
    categories: { items: [] },
    _dbCategories: [],
    _dbPages: [],
    _dbBlogs: [],
  };

  try {
    await dbConnect();

    // 1. Fetch SiteConfig first to determine exactly which products are needed for the nav menu
    const config = await getSiteConfig();

    let productIdsToFetch = [];
    if (config?.headerConfig?.navItems) {
      config.headerConfig.navItems.forEach(item => {
        if (item.type === 'dropdown_product' && item.dropdownProductIds) {
          productIdsToFetch.push(...item.dropdownProductIds);
        }
      });
    }

    // Run remaining DB reads in parallel
    const [catsResult, pagesResult, blogsResult, prodsResult] = await Promise.allSettled([
      Category.find({ status: 'Published', isDeleted: { $in: [false, null] } })
        .select('name slug image banner description content type')
        .sort({ name: 1 })
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean(),
      Page.find({ status: 'Published' })
        .select('title slug template')
        .sort({ title: 1 })
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean(),
      Blog.find({ status: 'Published', isDeleted: { $ne: true } })
        .select('title slug')
        .sort({ createdAt: -1 })
        .limit(50)
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean(),
      productIdsToFetch.length > 0 ? Product.find({ 
        _id: { $in: productIdsToFetch }, 
        status: { $ne: 'Draft' }, 
        isDeleted: { $ne: true } 
      })
        .select('name slug price images primaryCategory categories')
        .populate('categories')
        .populate('primaryCategory')
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean() : Promise.resolve([])
    ]);

    const dbCategoriesRaw = catsResult.status === 'fulfilled' ? (catsResult.value || []) : [];
    const dbPages = pagesResult.status === 'fulfilled' ? (pagesResult.value || []) : [];
    const dbBlogs = blogsResult.status === 'fulfilled' ? (blogsResult.value || []) : [];
    const dbProducts = prodsResult.status === 'fulfilled' ? (prodsResult.value || []) : [];


    // Compute product counts in a single aggregation pipeline to avoid N+1 queries
    const categoryCounts = await Product.aggregate([
      { $match: { isDeleted: false, status: 'Published' } },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    categoryCounts.forEach(c => {
      if (c._id) {
        countMap[c._id.toString()] = c.count;
      }
    });

    const dbCategories = dbCategoriesRaw.map((cat) => {
      if (cat.type === 'product' || !cat.type) {
        return { ...cat, productCount: countMap[cat._id.toString()] || 0 };
      }
      return cat;
    });

    if (config) {
      sanitizedConfig = JSON.parse(JSON.stringify(config));
    }

    // Inject resolved DB data for Navbar/Footer dynamic rendering
    sanitizedConfig._dbCategories = JSON.parse(JSON.stringify(dbCategories));
    sanitizedConfig._dbPages = JSON.parse(JSON.stringify(dbPages));
    sanitizedConfig._dbBlogs = JSON.parse(JSON.stringify(dbBlogs));
    sanitizedConfig._dbProducts = JSON.parse(JSON.stringify(dbProducts));

  } catch (error) {
    // dbConnect() itself failed — all data remains at defaults, app still renders
    console.error("Layout DB connection failed:", error.message);
  }

  return (
    <html lang="en">
      <head>
        <ScriptLoader location="head" />
        <ThemeStyle />
      </head>
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased`}>
        <ScriptLoader location="body_top" />
        <AuthProvider>
          <Toaster position="top-right" />
          <CookieConsent />
          <Suspense fallback={null}>
            <AffiliateTracker />
          </Suspense>
          <SiteProvider initialData={sanitizedConfig}>
            <CartProvider>
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
            </CartProvider>
          </SiteProvider>
        </AuthProvider>
        <ScriptLoader location="body_bottom" />
      </body>
    </html>
  );
}

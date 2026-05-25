import { Inter, Space_Grotesk, Manrope } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import AuthProvider from "@/components/providers/AuthProvider";
import dbConnect from "@/lib/db";
import SiteConfig from "@/models/SiteConfig";
import { SiteProvider } from "@/context/SiteContext";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import ScriptLoader from "@/components/common/ScriptLoader";
import { Toaster } from "react-hot-toast";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const dynamic = 'force-dynamic';
// export const revalidate = 0;

import ThemeStyle from "@/components/common/ThemeStyle";

export const metadata = {
  title: "Pairo | Premium Shearling Jackets",
  description: "Experience the ultimate warmth and luxury with Pairo's handcrafted shearling jackets.",
};

export default async function RootLayout({ children }) {
  let config = null;
  
  try {
    await dbConnect();
    config = await SiteConfig.findOne({ key: 'main' }).lean();
  } catch (error) {
    console.error("Layout Data Fetch Error:", error);
  }

  const sanitizedConfig = config ? JSON.parse(JSON.stringify(config)) : { 
    brand: { name: "Pairo", tagline: "Premium Shearling" },
    navigation: { links: [], offers: ["Welcome to Pairo Store"] },
    hero: { slides: [{ title: "Pairo", subtitle: "Handcrafted Luxury", image: "/placeholder.jpg", buttonText: "Shop Now" }], labels: { viewCollection: "View Collection" } },
    footer: { sections: [{}, { links: [] }], categories: { items: [] } },
    categories: { items: [] }
  };

  // Using headers to detect admin route in server component
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const isAdminHeader = headerList.get("x-is-admin") === "true";
  const pathnameHeader = headerList.get("x-pathname") || "";
  const invokePath = headerList.get("x-invoke-path") || "";
  
  const isActuallyAdmin = isAdminHeader || 
                          pathnameHeader.startsWith("/admin") || 
                          invokePath.startsWith("/admin");

  return (
    <html lang="en">
      <head>
        <ScriptLoader location="head" />
        {!isActuallyAdmin && <ThemeStyle />}
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${manrope.variable} font-sans antialiased`}>
        <ScriptLoader location="body_top" />
        <AuthProvider>
          <Toaster position="top-right" />
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

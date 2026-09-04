"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import { toast } from "react-hot-toast";
import {
   ChevronDown,
   Image as ImageIcon,
   Plus,
   X,
   Package,
   Truck,
   Zap,
   Globe,
   Info,
   Layers,
   Settings,
   List,
   HelpCircle,
   Activity,
   Check,
   Pencil,
   Lock,
   Unlock,
   Loader2,
   Ruler
} from "lucide-react";

const DEFAULT_SIZES_CM = [
  { size: "XS", us: "34", eu: "44", chest: "86 - 89", sleeves: "63.5" },
  { size: "S", us: "36 - 38", eu: "46 - 48", chest: "91 - 97", sleeves: "64.5" },
  { size: "M", us: "40", eu: "50", chest: "99 - 104", sleeves: "66" },
  { size: "L", us: "42 - 44", eu: "52 - 54", chest: "106 - 112", sleeves: "67" },
  { size: "XL", us: "46", eu: "56", chest: "114 - 119", sleeves: "68.5" },
  { size: "2XL", us: "48 - 50", eu: "58 - 60", chest: "122 - 127", sleeves: "70" },
  { size: "3XL", us: "52", eu: "62", chest: "129 - 135", sleeves: "71" },
  { size: "4XL", us: "54 - 56", eu: "64 - 66", chest: "137 - 142", sleeves: "72" },
];

const DEFAULT_SIZES_IN = [
  { size: "XS", us: "34", eu: "44", chest: "34 - 35", sleeves: "25" },
  { size: "S", us: "36 - 38", eu: "46 - 48", chest: "36 - 38", sleeves: "25.4" },
  { size: "M", us: "40", eu: "50", chest: "39 - 41", sleeves: "26" },
  { size: "L", us: "42 - 44", eu: "52 - 54", chest: "42 - 44", sleeves: "26.4" },
  { size: "XL", us: "46", eu: "56", chest: "45 - 47", sleeves: "27" },
  { size: "2XL", us: "48 - 50", eu: "58 - 60", chest: "48 - 50", sleeves: "27.6" },
  { size: "3XL", us: "52", eu: "62", chest: "51 - 53", sleeves: "28" },
  { size: "4XL", us: "54 - 56", eu: "64 - 66", chest: "54 - 56", sleeves: "28.3" },
];

const DEFAULT_INSTRUCTIONS = [
  { title: "Shoulder", desc: "Measure from the tip of one shoulder, across your back to the tip of your other shoulder." },
  { title: "Chest", desc: "Measure the circumference around the fullest area of chest, keeping the tape level." },
  { title: "Natural Waist", desc: "Measure the circumference around the narrowest area of waist, above the navel." },
  { title: "Lower Waist", desc: "Measure the circumference around the fullest area of waist, below the navel." },
  { title: "Hips", desc: "Measure around the fullest part of your body, above the top of your legs." },
  { title: "Sleeves Outseam", desc: "Measure from your shoulder seam, with your arm slightly bent, to the tip of your wrist." },
  { title: "Pants Inseam", desc: "Measure from your crotch point down to your ankle." }
];

const TiptapEditor = dynamic(() => import('./TiptapEditor'), { ssr: false });
import MediaPicker from "./MediaPicker";
import SEOConfigPanel from "./SEOConfigPanel";
import MediaPickerModal from "./MediaPickerModal";
import GallerySorter from "./GallerySorter";
import AdminPageLayout from "./AdminPageLayout";
import { getSwatchBackground } from "@/lib/swatchRenderer";

// Tiny inline image button — opens MediaPickerModal without the full MediaPicker drop-zone UI
function InlinePick({ value, onChange, label = "+ Image", doneLabel = "✓ Change", title = "Pick image" }) {
   const [open, setOpen] = useState(false);
   return (
      <>
         <button
            type="button"
            onClick={() => setOpen(true)}
            className={`h-7 px-2.5 rounded text-[10px] font-bold border transition-colors whitespace-nowrap ${
               value
                  ? "border-[#2271b1] text-[#2271b1] bg-blue-50 hover:bg-blue-100"
                  : "border-gray-200 text-gray-400 bg-white hover:border-[#2271b1] hover:text-[#2271b1]"
            }`}
         >
            {value ? doneLabel : label}
         </button>
         <MediaPickerModal
            open={open}
            onClose={() => setOpen(false)}
            onSelect={(sel) => { onChange(sel.url); setOpen(false); }}
            title={title}
         />
      </>
   );
}

// Utility: convert a title to a URL-safe slug
function toSlug(str) {
   return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
}

export default function ProductForm({ productId = null }) {
   const router = useRouter();
   const [loading, setLoading] = useState(productId ? true : false);
   const [saving, setSaving] = useState(false);
   const [activeTab, setActiveTab] = useState("general");
   const [activeFormTab, setActiveFormTab] = useState("content");
   const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
   // slugLocked: true = read-only display; false = editable input active
   const [slugLocked, setSlugLocked] = useState(true);
   // slugCheckState: null | "checking" | "unique" | "taken"
   const [slugCheckState, setSlugCheckState] = useState(null);
   const [slugDraftValue, setSlugDraftValue] = useState("");
   const [categories, setCategories] = useState([]);
   const [sizeCharts, setSizeCharts] = useState([]);

   const getPreviewCategorySlug = () => {
      if (formData.primaryCategory) {
         const match = categories.find(c => c._id === formData.primaryCategory);
         if (match && match.slug) return match.slug;
      }
      if (formData.categories && formData.categories.length > 0) {
         const match = categories.find(c => c._id === formData.categories[0]);
         if (match && match.slug) return match.slug;
      }
      return "shop";
   };

   const [formData, setFormData] = useState({
      name: "",
      slug: "",
      shortDescription: "",
      description: "",
      status: "Draft",
      isFeatured: false,
      productType: "simple",
      price: "",
      compareAtPrice: "",
      sku: "",
      stock: "",
      manageStock: true,
      shippingType: "Express",
      color: "",
      gender: "unisex",
      ageGroup: "adult",
      images: [],
      seo: {
         title: "",
         description: "",
         keywords: [],
         focusKeyword: "",
         canonicalUrl: "",
         noIndex: false,
         noFollow: false,
         ogTitle: "",
         ogDescription: "",
         ogImage: "",
         twitterTitle: "",
         twitterDescription: "",
         twitterImage: "",
         structuredData: ""
      },
      categories: [],
      primaryCategory: "",
      attributes: [], // { name: "", type: "custom", values: [{ label: "", hex: "", image: "", value: "", variantImage: "" }] }
      variantCombinations: [], // { title: "", price: "", stock: "", sku: "", image: "" }
      stats: [],
      faqs: [],
      sizeChartSource: "category_default",
      sizeChart: "",
      sizeGuide: {
         enabled: false,
         chartImage: "",
         videoUrl: "https://www.youtube.com/watch?v=ipyhV51zUWk",
         sizesCm: DEFAULT_SIZES_CM,
         sizesIn: DEFAULT_SIZES_IN,
         instructions: DEFAULT_INSTRUCTIONS
      }
   });

   useEffect(() => {
      const fetchData = async () => {
         try {
            const catsRes = await fetch("/api/admin/categories?type=product");
            if (!catsRes.ok) {
               throw new Error("Failed to fetch product categories.");
            }
            const data = await catsRes.json();
            setCategories(Array.isArray(data) ? data : []);

            // Fetch size charts
            const scRes = await fetch("/api/admin/size-charts");
            if (scRes.ok) {
               const scData = await scRes.json();
               setSizeCharts(scData.filter(sc => sc.status === "Published" && !sc.isDeleted));
            }

            if (productId) {
               const prodRes = await fetch(`/api/admin/products?id=${productId}`);
               if (!prodRes.ok) {
                  throw new Error("Failed to fetch product details.");
               }
               const prodData = await prodRes.json();
               setSlugManuallyEdited(!!prodData.slugManuallyEdited);
               setFormData({
                  ...prodData,
                  productType: prodData.productType || "simple",
                  images: prodData.images || [],
                  categories: prodData.categories || [],
                  primaryCategory: prodData.primaryCategory || "",
                  sizeChartSource: prodData.sizeChartSource || "category_default",
                  sizeChart: prodData.sizeChart || "",
                  color: prodData.color || "",
                  gender: prodData.gender || "unisex",
                  ageGroup: prodData.ageGroup || "adult",
                  seo: {
                     title: "", description: "", keywords: [], focusKeyword: "",
                     canonicalUrl: "", noIndex: false, noFollow: false,
                     ogTitle: "", ogDescription: "", ogImage: "",
                     twitterTitle: "", twitterDescription: "", twitterImage: "",
                     structuredData: "",
                     ...(prodData.seo || {})
                   },
                  attributes: prodData.attributes || prodData.variants?.map(v => ({
                     name: v.name,
                     type: v.name.toLowerCase().includes("color") ? "color" : v.name.toLowerCase().includes("size") ? "size" : "custom",
                     values: v.values.map(val => ({
                        label: val.name || val,
                        value: val.name || val,
                        hex: val.hex || "",
                        image: val.image || "",
                        variantImage: ""
                     }))
                  })) || [],
                  variantCombinations: prodData.variantCombinations || [],
                  stats: prodData.stats || [],
                  faqs: prodData.faqs || [],
                  overview: prodData.overview || "",
                  shippingType: prodData.shippingType || "Express",
                  sizeGuide: {
                     enabled: prodData.sizeGuide?.enabled || false,
                     chartImage: prodData.sizeGuide?.chartImage || "",
                     videoUrl: prodData.sizeGuide?.videoUrl || "https://www.youtube.com/watch?v=ipyhV51zUWk",
                     sizesCm: prodData.sizeGuide?.sizesCm?.length > 0 ? prodData.sizeGuide.sizesCm : DEFAULT_SIZES_CM,
                     sizesIn: prodData.sizeGuide?.sizesIn?.length > 0 ? prodData.sizeGuide.sizesIn : DEFAULT_SIZES_IN,
                     instructions: prodData.sizeGuide?.instructions?.length > 0 ? prodData.sizeGuide.instructions : DEFAULT_INSTRUCTIONS
                  }
               });
            }
            setLoading(false);
         } catch (err) {
            console.error("Fetch failed", err);
            setLoading(false);
         }
      };
      fetchData();
    }, [productId]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
           const params = new URLSearchParams(window.location.search);
           const focus = params.get("focus");
           const tab = params.get("tab");
           
           if (focus === "seo" || tab === "seo") {
              setActiveFormTab("seo");
           } else if (focus === "content" || tab === "content") {
              setActiveFormTab("content");
           }

           if (focus === "pricing" || focus === "price" || tab === "general") {
              setActiveTab("general");
              setTimeout(() => {
                 const el = document.getElementById("sale-price-input");
                 if (el) {
                    el.focus();
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                 }
              }, 300);
           } else if (focus === "stock" || focus === "inventory" || tab === "inventory") {
              setActiveTab("inventory");
              setTimeout(() => {
                 const el = document.getElementById("stock-input");
                 if (el) {
                    el.focus();
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                 }
              }, 300);
           } else if (focus === "variants" || tab === "variants") {
              setActiveTab("variants");
           } else if (focus === "sizeguide" || focus === "size" || tab === "sizeguide") {
              setActiveTab("sizeguide");
           } else if (focus === "faqs" || tab === "faqs") {
              setActiveTab("faqs");
           } else if (focus === "stats" || tab === "stats") {
              setActiveTab("stats");
           }
        }
     }, [loading]);

   const handleSubmit = async (e) => {
      if (e) e.preventDefault();
      setSaving(true);
      // Auto-generate slug from name if still empty
      const finalSlug = formData.slug ? formData.slug : toSlug(formData.name);
      
       // Synchronize parent prices and stock to combinations for variable products only if not explicitly set
       let updatedCombinations = formData.variantCombinations || [];
       if (formData.productType === "variable") {
          updatedCombinations = updatedCombinations.map(comb => ({
             ...comb,
             price: comb.price !== "" && comb.price !== undefined && comb.price !== null 
                ? Number(comb.price) 
                : (formData.price !== "" && formData.price !== undefined && formData.price !== null ? Number(formData.price) : undefined),
             compareAtPrice: comb.compareAtPrice !== "" && comb.compareAtPrice !== undefined && comb.compareAtPrice !== null 
                ? Number(comb.compareAtPrice) 
                : (formData.compareAtPrice !== "" && formData.compareAtPrice !== undefined && formData.compareAtPrice !== null ? Number(formData.compareAtPrice) : undefined),
             stock: comb.stock !== "" && comb.stock !== undefined && comb.stock !== null 
                ? Number(comb.stock) 
                : (formData.stock !== "" && formData.stock !== undefined && formData.stock !== null ? Number(formData.stock) : 0)
          }));
       }

      const normalizedData = { 
         ...formData, 
         slug: finalSlug,
         slugManuallyEdited,
         variantCombinations: updatedCombinations,
         // Never send an empty string for ObjectId fields — Mongoose will reject it
         primaryCategory: formData.primaryCategory || undefined,
         categories: (formData.categories || []).filter(Boolean),
         images: (formData.images || []).filter(u => u && u.trim() !== ""),
      };
      try {
         const payload = productId ? { ...normalizedData, id: productId } : normalizedData;
         const res = await fetch("/api/admin/products", {
            method: productId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
         });
          if (res.ok) {
             const savedProduct = await res.json();
             toast.success(productId ? "Product updated successfully!" : "Product created successfully!");
             if (!productId && savedProduct._id) {
                router.push(`/admin/products/${savedProduct._id}`);
             }
          } else {
            const errData = await res.json().catch(() => ({}));
            toast.error(`Save failed: ${errData.error || res.statusText || "Unknown error"}`);
            console.error("[ProductForm] Save failed:", errData);
         }
      } catch (err) {
         toast.error(`Network error: ${err.message}`);
         console.error(err);
      } finally {
         setSaving(false);
      }
   };

   const addAttribute = () => {
      setFormData({
         ...formData,
         attributes: [...(formData.attributes || []), { name: "", type: "custom", values: [] }]
      });
   };

   const addAttributeValue = (aIdx, label) => {
      if (!label) return;
      const newAttrs = [...(formData.attributes || [])];
      const type = newAttrs[aIdx].type;
      newAttrs[aIdx].values.push({
         label,
         value: label,
         hex: type === "color" ? "#000000" : "",
         colorMode: "single",
         hex2: "",
         hex3: "",
         hex4: "",
         texture: "",
         image: "",
         swatchType: "color", // "color" | "image"
         variantImage: ""
      });
      setFormData({ ...formData, attributes: newAttrs });
   };

   const generateCombinations = () => {
      const attrs = (formData.attributes || []).filter(a => a.name && a.values.length > 0);
      if (attrs.length === 0) return;

      const combine = (arr) => {
         if (arr.length === 0) return [[]];
         const result = [];
         const rest = combine(arr.slice(1));
         for (const val of arr[0].values) {
            for (const r of rest) {
               result.push([val, ...r]);
            }
         }
         return result;
      };

      const combos = combine(attrs);
      const newCombos = combos.map(c => ({
         title: c.map(v => v.label).join(" / "),
         price: formData.price,
         compareAtPrice: formData.compareAtPrice,
         stock: formData.stock,
         sku: `${formData.sku}-${c.map(v => v.label).join("-")}`.toUpperCase(),
         image: c.find(v => v.variantImage)?.variantImage || ""
      }));

      setFormData({ ...formData, variantCombinations: newCombos });
   };

   const addTemplate = (type) => {
      const templates = {
         size: {
            name: "Size",
            type: "size",
            values: ["XS", "S", "M", "L", "XL"].map(v => ({ label: v, value: v, hex: "", image: "", variantImage: "" }))
         },
         color: {
            name: "Color",
            type: "color",
            values: [
               { label: "Black", value: "Black", hex: "#000000", colorMode: "single", hex2: "", hex3: "", hex4: "", texture: "", image: "", swatchType: "color", variantImage: "" },
               { label: "White", value: "White", hex: "#FFFFFF", colorMode: "single", hex2: "", hex3: "", hex4: "", texture: "", image: "", swatchType: "color", variantImage: "" },
               { label: "Navy", value: "Navy", hex: "#000080", colorMode: "single", hex2: "", hex3: "", hex4: "", texture: "", image: "", swatchType: "color", variantImage: "" },
               { label: "Gray", value: "Gray", hex: "#808080", colorMode: "single", hex2: "", hex3: "", hex4: "", texture: "", image: "", swatchType: "color", variantImage: "" },
               { label: "Red", value: "Red", hex: "#FF0000", colorMode: "single", hex2: "", hex3: "", hex4: "", texture: "", image: "", swatchType: "color", variantImage: "" }
            ]
         },
         material: {
            name: "Material",
            type: "custom",
            values: ["Cotton", "Leather", "Silk", "Wool", "Suede"].map(v => ({ label: v, value: v, hex: "", image: "", variantImage: "" }))
         }
      };
      if (templates[type]) {
         setFormData({
            ...formData,
            attributes: [...(formData.attributes || []), templates[type]]
         });
      }
   };

   if (loading) return <div className="p-10 text-[13px] font-medium text-gray-500 bg-[#f0f2f1] min-h-screen">Loading editor...</div>;

   if (productId && !formData.name) {
      return (
         <div className="p-10 text-center bg-[#f0f2f1] min-h-screen flex flex-col items-center justify-center gap-4">
            <div className="bg-white p-8 border border-[#c3c4c7] max-w-md w-full text-left shadow-sm rounded-sm">
               <h2 className="text-[#d63638] font-bold text-[16px] mb-2">
                  Failed to load product data
               </h2>
               <p className="text-gray-600 text-[13px] mb-6 leading-relaxed">
                  Your administrator session may have expired, or the product you are trying to edit does not exist. Please try logging back in.
               </p>
               <div className="flex flex-col gap-2.5">
                  <button 
                     type="button" 
                     onClick={() => window.location.reload()} 
                     className="w-full bg-[#2271b1] text-white px-4 py-2 text-[12px] font-bold hover:bg-[#135e96] transition-all text-center rounded-sm"
                  >
                     Retry Connection / Reload
                  </button>
                  <a 
                     href="/admin-login" 
                     className="w-full border border-[#c3c4c7] text-gray-700 px-4 py-2 text-[12px] font-bold bg-[#f6f7f7] hover:bg-[#f0f0f1] transition-all text-center block rounded-sm"
                  >
                     Log In to Admin Panel
                  </a>
                  <a 
                     href="/admin/products" 
                     className="w-full text-[#2271b1] text-[12px] hover:underline text-center mt-2 block"
                  >
                     ← Back to Products List
                  </a>
               </div>
            </div>
         </div>
      );
   }

   return (
    <AdminPageLayout 
      title={productId ? "Edit Product" : "Add New Product"} 
      addNewLink="/admin/products/new"
      addNewLabel="Add New"
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Products", href: "/admin/products" }, { label: productId ? "Edit" : "New" }]}
    >
         <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
            {/* Main Column */}
            <div className="lg:col-span-3 space-y-4">
               <div className="space-y-1">
                  <input
                     required
                     placeholder="Enter title here"
                     className="w-full border border-[#c3c4c7] focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] rounded-lg outline-none px-4 py-2.5 text-[20px] bg-white shadow-sm font-semibold transition-all"
                     value={formData.name}
                      onChange={(e) => {
                         const newName = e.target.value;
                         setFormData(prev => ({
                            ...prev,
                            name: newName,
                            slug: slugManuallyEdited ? prev.slug : toSlug(newName)
                         }));
                      }}
                  />
                  {/* Permalink / Slug Row */}
                  <div className="text-[12px] text-gray-500 px-1 mt-1 flex flex-wrap items-center gap-1.5">
                     <span>Permalink:</span>
                     <span className="text-gray-400 font-mono">pairolifestyle.com/product/</span>

                     {slugLocked ? (
                        // Read-only view with pencil edit button
                        <>
                           <span className="font-mono text-[#2271b1] font-semibold">{formData.slug || <span className="text-gray-300 italic">auto-generated</span>}</span>
                           <button
                              type="button"
                              title="Edit permalink"
                              onClick={() => {
                                 setSlugDraftValue(formData.slug);
                                 setSlugCheckState(null);
                                 setSlugLocked(false);
                              }}
                              className="ml-1 p-0.5 rounded hover:bg-gray-100 transition text-gray-400 hover:text-[#2271b1]"
                           >
                              <Pencil className="w-3.5 h-3.5" />
                           </button>
                           {!slugManuallyEdited && formData.slug && (
                              <span className="text-[10px] text-gray-300">(auto)</span>
                           )}
                        </>
                     ) : (
                        // Edit mode: input + check status + update/cancel buttons
                        <>
                           <input
                              autoFocus
                              className="border border-[#2271b1] bg-white rounded-[3px] outline-none px-2 py-0.5 text-[#2271b1] font-mono min-w-[120px] focus:ring-1 focus:ring-[#2271b1]/30"
                              value={slugDraftValue}
                              onChange={async (e) => {
                                 const raw = toSlug(e.target.value);
                                 setSlugDraftValue(raw);
                                 if (!raw) { setSlugCheckState(null); return; }
                                 setSlugCheckState("checking");
                                 try {
                                    const qs = new URLSearchParams({ slug: raw });
                                    if (productId) qs.set("excludeId", productId);
                                    const r = await fetch(`/api/admin/products/check-slug?${qs}`);
                                    const d = await r.json();
                                    setSlugCheckState(d.unique ? "unique" : "taken");
                                 } catch { setSlugCheckState(null); }
                              }}
                              placeholder="url-slug"
                           />
                           {/* Uniqueness indicator */}
                           {slugCheckState === "checking" && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                           {slugCheckState === "unique" && <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-0.5"><Check className="w-3 h-3" /> Available</span>}
                           {slugCheckState === "taken" && <span className="text-red-500 text-[10px] font-bold">Taken</span>}

                           {/* Update (lock) button */}
                           <button
                              type="button"
                              disabled={slugCheckState === "taken" || slugCheckState === "checking" || !slugDraftValue}
                              onClick={() => {
                                 setFormData(prev => ({ ...prev, slug: slugDraftValue }));
                                 setSlugManuallyEdited(true);
                                 setSlugLocked(true);
                                 setSlugCheckState(null);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-[#2271b1] text-white text-[10px] font-bold hover:bg-[#135e96] disabled:opacity-40 disabled:cursor-not-allowed transition"
                           >
                              <Lock className="w-3 h-3" /> Update
                           </button>

                           {/* Cancel button */}
                           <button
                              type="button"
                              onClick={() => { setSlugLocked(true); setSlugCheckState(null); }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] border border-gray-300 text-gray-600 text-[10px] font-bold hover:bg-gray-50 transition"
                           >
                              Cancel
                           </button>
                        </>
                     )}
                  </div>
               </div>

               {/* Short Description */}
               <div className="bg-white border border-[#c3c4c7] shadow-sm">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">
                     Product Short Description
                  </div>
                  <div className="p-3">
                     <TiptapEditor
                        content={formData.shortDescription}
                        onChange={(html) => setFormData({ ...formData, shortDescription: html })}
                     />
                     <p className="text-[11px] text-gray-400 mt-1">Supports bold, italic, lists, and links. Displays as a rich excerpt on the product page.</p>
                  </div>
               </div>

               {/* Content / SEO Tabs */}
               <div className="flex border-b border-[#ccd0d4] gap-6 select-none pb-0">
                  <button
                     type="button"
                     onClick={() => setActiveFormTab("content")}
                     className={`pb-2.5 text-[14px] font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                        activeFormTab === "content"
                           ? "border-[#2271b1] text-[#2271b1]"
                           : "border-transparent text-gray-500 hover:text-black"
                     }`}
                  >
                     Content Editor
                  </button>
                  <button
                     type="button"
                     onClick={() => setActiveFormTab("seo")}
                     className={`pb-2.5 text-[14px] font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                        activeFormTab === "seo"
                           ? "border-[#2271b1] text-[#2271b1]"
                           : "border-transparent text-gray-500 hover:text-black"
                     }`}
                  >
                     SEO Settings
                  </button>
               </div>

               {activeFormTab === "content" ? (
                  <>
                     {/* Long Description Meta Box with Tiptap */}
                     <div className="bg-white border border-[#c3c4c7] shadow-sm">
                        <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-1 flex items-center justify-between">
                           <div className="flex gap-2">
                              <button type="button" className="p-1 px-3 bg-white border border-[#c3c4c7] border-b-white -mb-[5px] text-[12px] font-bold z-10">Visual</button>
                              <button type="button" className="p-1 px-3 text-[12px] text-gray-400">Text</button>
                           </div>
                           <button type="button" className="text-[12px] text-[#2271b1] hover:text-black font-medium">Add Media</button>
                        </div>
                        <TiptapEditor
                           content={formData.description}
                           onChange={(html) => setFormData({ ...formData, description: html })}
                        />
                     </div>

                     {/* Product Data Meta Box */}
                     <div className="bg-white border border-[#c3c4c7] shadow-sm">
                        <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-4 py-2 flex items-center justify-between gap-4">
                           <div className="flex items-center gap-3">
                              <span className="text-[13px] font-bold text-gray-700">Product Data —</span>
                              <div className="relative">
                                 <select 
                                    className="appearance-none bg-white border border-[#c3c4c7] pl-3 pr-8 py-1 rounded-[3px] text-[13px] font-medium text-[#2271b1] focus:outline-none focus:border-[#2271b1] cursor-pointer"
                                    value={formData.productType}
                                    onChange={(e) => {
                                       const val = e.target.value;
                                       setFormData({ ...formData, productType: val });
                                       if (val === "variable") setActiveTab("variants");
                                    }}
                                 >
                                    <option value="simple">Simple product</option>
                                    <option value="variable">Variable product</option>
                                 </select>
                                 <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                           </div>
                        </div>
                        <div className="flex min-h-[400px]">
                           {/* Vertical Tabs */}
                           <div className="w-44 bg-[#f6f7f7] border-r border-[#c3c4c7] flex flex-col shrink-0">
                              {[
                                 { id: "general", label: "General", icon: Zap },
                                 { id: "inventory", label: "Inventory", icon: Package },
                                 formData.productType === "variable" && { id: "variants", label: "Variants Engine", icon: Layers },
                                 { id: "stats", label: "Product Stats", icon: Activity },
                                 { id: "faqs", label: "FAQs", icon: HelpCircle },
                                 { id: "sizeguide", label: "Size Guide", icon: Ruler }
                              ].filter(Boolean).map(tab => (
                                 <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`p-3 text-[13px] text-left border-b border-[#c3c4c7]/30 flex items-center gap-3 transition-all ${activeTab === tab.id 
                                       ? "bg-white text-black font-bold -mr-[1px] border-l-[3px] border-l-[#2271b1] z-10" 
                                       : "text-[#2271b1] hover:bg-[#f0f0f1]"
                                       }`}
                                 >
                                    <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-[#2271b1]' : 'text-gray-400'}`} /> {tab.label}
                                 </button>
                              ))}
                           </div>

                           {/* Tab Panels */}
                           <div className="flex-1 p-8 bg-white overflow-y-auto">
                              {activeTab === "general" && (
                                 <div className="space-y-4 max-w-xl">
                                    <div className="flex items-center gap-6 py-2 border-b border-gray-50">
                                       <label className="text-[12px] font-bold text-gray-400 uppercase w-40">Regular price</label>
                                       <div className="flex-1 flex items-center gap-2 border border-gray-200 bg-gray-50/50 px-3 py-2 rounded-sm focus-within:border-[#2271b1] transition-colors">
                                          <span className="text-gray-400 text-[13px]">$</span>
                                          <input className="w-full bg-transparent text-[14px] outline-none" placeholder="0.00" value={formData.compareAtPrice} onChange={(e) => setFormData({ ...formData, compareAtPrice: e.target.value })} />
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-6 py-2 border-b border-gray-50">
                                       <label className="text-[12px] font-bold text-gray-400 uppercase w-40">Sale price</label>
                                       <div className="flex-1 flex items-center gap-2 border border-gray-200 bg-gray-50/50 px-3 py-2 rounded-sm focus-within:border-[#2271b1] transition-colors">
                                          <span className="text-gray-400 text-[13px] font-bold">$</span>
                                          <input id="sale-price-input" className="w-full bg-transparent text-[14px] outline-none font-bold" placeholder="0.00" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-6 py-2 border-b border-gray-50">
                                       <label className="text-[12px] font-bold text-gray-400 uppercase w-40">Shipping Type</label>
                                       <select className="flex-1 border border-gray-200 bg-gray-50/50 p-2 text-[14px] outline-none rounded-sm focus:border-[#2271b1]" value={formData.shippingType} onChange={(e) => setFormData({ ...formData, shippingType: e.target.value })}>
                                          <option value="Express">Express Shipping</option>
                                          <option value="Standard">Standard Shipping</option>
                                          <option value="Free">Free Shipping</option>
                                          <option value="Priority">Priority Mail</option>
                                       </select>
                                    </div>
                                    <div className="flex items-center gap-6 py-2 border-b border-gray-50">
                                       <label className="text-[12px] font-bold text-gray-400 uppercase w-40">Color</label>
                                       <input 
                                          className="flex-1 border border-gray-200 bg-gray-50/50 p-2 text-[14px] outline-none rounded-sm focus:border-[#2271b1]" 
                                          placeholder="e.g. Black, Navy Blue, Crimson" 
                                          value={formData.color || ""} 
                                          onChange={(e) => setFormData({ ...formData, color: e.target.value })} 
                                       />
                                    </div>
                                    <div className="flex items-center gap-6 py-2 border-b border-gray-50">
                                       <label className="text-[12px] font-bold text-gray-400 uppercase w-40">Gender</label>
                                       <select 
                                          className="flex-1 border border-gray-200 bg-gray-50/50 p-2 text-[14px] outline-none rounded-sm focus:border-[#2271b1]" 
                                          value={formData.gender || "unisex"} 
                                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                       >
                                          <option value="unisex">Unisex</option>
                                          <option value="male">Male</option>
                                          <option value="female">Female</option>
                                       </select>
                                    </div>
                                    <div className="flex items-center gap-6 py-2 border-b border-gray-50">
                                       <label className="text-[12px] font-bold text-gray-400 uppercase w-40">Age Group</label>
                                       <select 
                                          className="flex-1 border border-gray-200 bg-gray-50/50 p-2 text-[14px] outline-none rounded-sm focus:border-[#2271b1]" 
                                          value={formData.ageGroup || "adult"} 
                                          onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
                                       >
                                          <option value="adult">Adult</option>
                                          <option value="kids">Kids</option>
                                          <option value="toddler">Toddler</option>
                                          <option value="infant">Infant</option>
                                          <option value="newborn">Newborn</option>
                                       </select>
                                    </div>
                                 </div>
                              )}

                              {activeTab === "inventory" && (
                                 <div className="space-y-4 max-w-xl">
                                    <div className="flex items-center gap-6 py-2 border-b border-gray-50">
                                       <label className="text-[12px] font-bold text-gray-400 uppercase w-40">SKU</label>
                                       <input className="flex-1 border border-gray-200 bg-gray-50/50 p-2 text-[14px] outline-none rounded-sm uppercase focus:border-[#2271b1]" placeholder="e.g. PR-001" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                                    </div>
                                    <div className="flex items-center gap-6 py-4 border-b border-gray-50">
                                       <label className="text-[12px] font-bold text-gray-400 uppercase w-40">Track Stock</label>
                                       <div className="flex items-center gap-3">
                                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-[#2271b1] focus:ring-[#2271b1]" checked={formData.manageStock} onChange={(e) => setFormData({ ...formData, manageStock: e.target.checked })} />
                                          <span className="text-[12px] text-gray-500 font-medium">Enable inventory tracking for this product</span>
                                       </div>
                                    </div>
                                    {formData.manageStock && (
                                       <div className="flex items-center gap-6 py-2">
                                          <label className="text-[12px] font-bold text-gray-400 uppercase w-40">Stock Quantity</label>
                                          <input id="stock-input" type="number" className="w-32 border border-gray-200 bg-gray-50/50 p-2 text-[14px] outline-none rounded-sm focus:border-[#2271b1]" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} />
                                       </div>
                                    )}
                                 </div>
                              )}

                              {activeTab === "variants" && (
                                 <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                       <p className="text-[13px] font-bold text-gray-700">Variant Attributes</p>
                                       <div className="flex gap-2">
                                          <button type="button" onClick={() => addTemplate("color")} className="text-[11px] font-bold border border-gray-200 px-3 py-1.5 bg-white hover:bg-gray-50 rounded">+ Color</button>
                                          <button type="button" onClick={() => addTemplate("size")} className="text-[11px] font-bold border border-gray-200 px-3 py-1.5 bg-white hover:bg-gray-50 rounded">+ Size</button>
                                          <button type="button" onClick={addAttribute} className="bg-[#2271b1] text-white px-3 py-1.5 rounded font-bold text-[11px] hover:bg-[#135e96]">+ Custom</button>
                                       </div>
                                    </div>

                                    {(formData.attributes || []).map((attr, aIdx) => {
                                       const updateAttr = (key, v) => { const n=[...formData.attributes]; n[aIdx][key]=v; setFormData({...formData,attributes:n}); };
                                       const updateVal = (vIdx, key, v) => { const n=[...formData.attributes]; n[aIdx].values[vIdx][key]=v; setFormData({...formData,attributes:n}); };
                                       const removeVal = (vIdx) => { const n=[...formData.attributes]; n[aIdx].values=n[aIdx].values.filter((_,i)=>i!==vIdx); setFormData({...formData,attributes:n}); };

                                       return (
                                          <div key={aIdx} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                                             <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                                                <input className="border border-gray-200 rounded px-2 py-1 text-[12px] font-bold w-32 outline-none focus:border-[#2271b1] bg-white" value={attr.name} onChange={e=>updateAttr("name",e.target.value)} />
                                                <select className="border border-gray-200 rounded px-2 py-1 text-[11px] font-bold outline-none text-[#2271b1] bg-white" value={attr.type} onChange={e=>updateAttr("type",e.target.value)}>
                                                   <option value="color">Color</option>
                                                   <option value="size">Size</option>
                                                   <option value="custom">Custom</option>
                                                </select>
                                                <button type="button" onClick={()=>setFormData({...formData,attributes:formData.attributes.filter((_,i)=>i!==aIdx)})} className="ml-auto text-gray-300 hover:text-red-500 p-0.5"><X className="w-3.5 h-3.5" /></button>
                                             </div>
                                             <div className="divide-y divide-gray-50">
                                                {(attr.values||[]).map((val,vIdx)=>{
                                                    const swatchType = val.swatchType || "color";
                                                    return (
                                                    <div key={vIdx} className="flex items-start gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0">
                                                       {/* Swatch Config — only for color attributes */}
                                                       {attr.type==="color" && (
                                                          <div className="flex flex-col gap-1.5 shrink-0">
                                                             {/* Toggle between Color Picker and Image Swatch */}
                                                             <div className="flex rounded overflow-hidden border border-gray-200 text-[10px] font-bold">
                                                                <button
                                                                   type="button"
                                                                   onClick={()=>updateVal(vIdx,"swatchType","color")}
                                                                   className={`px-2 py-1 transition-colors ${
                                                                      swatchType==="color"
                                                                         ? "bg-[#2271b1] text-white"
                                                                         : "bg-white text-gray-400 hover:bg-gray-50"
                                                                   }`}
                                                                   title="Use a solid color swatch"
                                                                >
                                                                   Color
                                                                </button>
                                                                <button
                                                                   type="button"
                                                                   onClick={()=>updateVal(vIdx,"swatchType","image")}
                                                                   className={`px-2 py-1 transition-colors ${
                                                                      swatchType==="image"
                                                                         ? "bg-[#2271b1] text-white"
                                                                         : "bg-white text-gray-400 hover:bg-gray-50"
                                                                   }`}
                                                                   title="Use an image as the swatch (texture, pattern, etc.)"
                                                                >
                                                                   Image
                                                                </button>
                                                             </div>
                                                             {/* Swatch preview + picker */}
                                                             {swatchType==="color" ? (
                                                                <div className="flex flex-col gap-2 bg-gray-50 p-2 rounded border border-gray-100 shrink-0 min-w-[160px]">
                                                                   <div className="flex items-center gap-2">
                                                                      {/* Final preview bubble */}
                                                                      <div
                                                                         className="w-8 h-8 rounded-full border-2 border-white shadow ring-1 ring-gray-200 shrink-0"
                                                                         style={{
                                                                            background: getSwatchBackground(val),
                                                                            backgroundSize: "cover"
                                                                         }}
                                                                         title="Combined Swatch Preview"
                                                                      />
                                                                      {/* Controls */}
                                                                      <div className="flex flex-col gap-1">
                                                                         <div className="flex items-center gap-1">
                                                                            <span className="text-[9px] text-gray-400 font-bold uppercase w-10">Mode</span>
                                                                            <select
                                                                               value={val.colorMode || "single"}
                                                                               onChange={e=>updateVal(vIdx,"colorMode",e.target.value)}
                                                                               className="border border-gray-200 rounded px-1 py-0.5 text-[9px] bg-white outline-none focus:border-[#2271b1] w-20 font-medium"
                                                                            >
                                                                               <option value="single">Single</option>
                                                                               <option value="dual">Dual</option>
                                                                               <option value="triple">Triple</option>
                                                                               <option value="quad">Quad</option>
                                                                            </select>
                                                                         </div>
                                                                         <div className="flex items-center gap-1">
                                                                            <span className="text-[9px] text-gray-400 font-bold uppercase w-10">Texture</span>
                                                                            <select
                                                                               value={val.texture || ""}
                                                                               onChange={e=>updateVal(vIdx,"texture",e.target.value)}
                                                                               className="border border-gray-200 rounded px-1 py-0.5 text-[9px] bg-white outline-none focus:border-[#2271b1] w-20 font-medium"
                                                                            >
                                                                               <option value="">No Texture</option>
                                                                               <option value="leather-smooth">Leather S</option>
                                                                               <option value="leather-full-grain">Leather F</option>
                                                                               <option value="denim-classic">Denim</option>
                                                                               <option value="cotton-brushed">Cotton</option>
                                                                               <option value="wool-tweed">Wool</option>
                                                                               <option value="fleece-polar">Fleece</option>
                                                                               <option value="puffer-quilted">Puffer</option>
                                                                               <option value="technical-softshell">Softshell</option>
                                                                               <option value="luxury-velvet">Velvet</option>
                                                                               <option value="knit-cable">Cable</option>
                                                                            </select>
                                                                         </div>
                                                                      </div>
                                                                   </div>
                                                                   {/* Individual Color pickers */}
                                                                   <div className="flex items-center gap-1.5 flex-wrap">
                                                                      {/* Color 1 */}
                                                                      <div className="relative flex items-center justify-center">
                                                                         <div className="w-5 h-5 rounded-full border border-gray-300 shadow cursor-pointer shrink-0" style={{ backgroundColor: val.hex || "#000000" }} title="Color 1" />
                                                                         <input type="color" value={val.hex || "#000000"} onChange={e=>updateVal(vIdx,"hex",e.target.value)} className="w-5 h-5 opacity-0 absolute inset-0 cursor-pointer" />
                                                                      </div>
                                                                      
                                                                      {/* Color 2 */}
                                                                      {(val.colorMode === "dual" || val.colorMode === "triple" || val.colorMode === "quad") && (
                                                                         <div className="relative flex items-center justify-center">
                                                                            <div className="w-5 h-5 rounded-full border border-gray-300 shadow cursor-pointer shrink-0" style={{ backgroundColor: val.hex2 || "#ffffff" }} title="Color 2" />
                                                                            <input type="color" value={val.hex2 || "#ffffff"} onChange={e=>updateVal(vIdx,"hex2",e.target.value)} className="w-5 h-5 opacity-0 absolute inset-0 cursor-pointer" />
                                                                         </div>
                                                                      )}

                                                                      {/* Color 3 */}
                                                                      {(val.colorMode === "triple" || val.colorMode === "quad") && (
                                                                         <div className="relative flex items-center justify-center">
                                                                            <div className="w-5 h-5 rounded-full border border-gray-300 shadow cursor-pointer shrink-0" style={{ backgroundColor: val.hex3 || "#ffffff" }} title="Color 3" />
                                                                            <input type="color" value={val.hex3 || "#ffffff"} onChange={e=>updateVal(vIdx,"hex3",e.target.value)} className="w-5 h-5 opacity-0 absolute inset-0 cursor-pointer" />
                                                                         </div>
                                                                      )}

                                                                      {/* Color 4 */}
                                                                      {(val.colorMode === "quad") && (
                                                                         <div className="relative flex items-center justify-center">
                                                                            <div className="w-5 h-5 rounded-full border border-gray-300 shadow cursor-pointer shrink-0" style={{ backgroundColor: val.hex4 || "#ffffff" }} title="Color 4" />
                                                                            <input type="color" value={val.hex4 || "#ffffff"} onChange={e=>updateVal(vIdx,"hex4",e.target.value)} className="w-5 h-5 opacity-0 absolute inset-0 cursor-pointer" />
                                                                         </div>
                                                                      )}
                                                                   </div>
                                                                </div>
                                                             ) : (
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                   {val.image ? (
                                                                      <img src={val.image} alt="swatch" className="w-7 h-7 rounded-full object-cover border border-gray-200 shadow" />
                                                                   ) : (
                                                                      <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                                                         <ImageIcon className="w-3 h-3 text-gray-300" />
                                                                      </div>
                                                                   )}
                                                                   <InlinePick
                                                                      value={val.image}
                                                                      onChange={url=>updateVal(vIdx,"image",url)}
                                                                      label="+ Swatch"
                                                                      doneLabel="✓ Swatch"
                                                                      title="Pick swatch image (texture / pattern)"
                                                                   />
                                                                </div>
                                                             )}
                                                          </div>
                                                       )}
                                                       {/* Value label */}
                                                       <input className="flex-1 border border-gray-200 rounded px-2 py-1 text-[12px] mt-0.5" placeholder="Label" value={val.label} onChange={e=>updateVal(vIdx,"label",e.target.value)} />
                                                       {/* Variant product image (separate from swatch) */}
                                                       <div className="flex flex-col items-center gap-0.5 shrink-0">
                                                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Product img</span>
                                                          <InlinePick value={val.variantImage} onChange={url=>updateVal(vIdx,"variantImage",url)} label="+" />
                                                       </div>
                                                       <button type="button" onClick={()=>removeVal(vIdx)} className="text-gray-300 hover:text-red-500 mt-0.5 shrink-0"><X className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                 );})}
                                             </div>
                                             <div className="p-2">
                                                <input className="w-full border border-gray-200 rounded px-3 py-1 text-[12px]" placeholder="Add value..." onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addAttributeValue(aIdx,e.target.value); e.target.value=""; } }} />
                                             </div>
                                          </div>
                                       );
                                    })}

                                    <div className="pt-4 border-t border-gray-100">
                                       <button type="button" onClick={generateCombinations} className="bg-white border border-[#2271b1] text-[#2271b1] px-4 py-1.5 rounded-[3px] text-[11px] font-bold hover:bg-[#f0f6fb]">Generate All Combinations</button>
                                       {formData.variantCombinations?.length > 0 && (
                                          <div className="mt-4 border border-gray-200 rounded-lg overflow-x-auto">
                                             <table className="w-full text-left text-[11px]">
                                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-400 uppercase font-bold">
                                                   <tr>
                                                      <th className="px-4 py-3 w-16">IMG</th>
                                                      <th className="px-4 py-3">Variant</th>
                                                      <th className="px-4 py-3 w-32">Regular Price ($)</th>
                                                      <th className="px-4 py-3 w-32">Sale Price ($)</th>
                                                      <th className="px-4 py-3 w-10"></th>
                                                   </tr>
                                                </thead>
                                                <tbody>
                                                   {formData.variantCombinations.map((comb, cIdx) => (
                                                      <tr key={cIdx} className="border-b border-gray-100">
                                                         <td className="px-4 py-2"><InlinePick value={comb.image} onChange={url=>{ const n=[...formData.variantCombinations]; n[cIdx].image=url; setFormData({...formData,variantCombinations:n}); }} /></td>
                                                         <td className="px-4 py-2 font-bold">{comb.title}</td>
                                                         <td className="px-4 py-2">
                                                            <input
                                                               type="number"
                                                               step="0.01"
                                                               className="w-full border border-gray-200 p-1 text-[11px] outline-none focus:border-[#2271b1] rounded"
                                                               placeholder="e.g. 0.00"
                                                               value={comb.compareAtPrice !== undefined && comb.compareAtPrice !== null ? comb.compareAtPrice : ""}
                                                               onChange={(e) => {
                                                                  const n = [...formData.variantCombinations];
                                                                  n[cIdx].compareAtPrice = e.target.value === "" ? "" : Number(e.target.value);
                                                                  setFormData({ ...formData, variantCombinations: n });
                                                               }}
                                                            />
                                                         </td>
                                                         <td className="px-4 py-2">
                                                            <input
                                                               type="number"
                                                               step="0.01"
                                                               className="w-full border border-gray-200 p-1 text-[11px] outline-none focus:border-[#2271b1] rounded font-bold"
                                                               placeholder="e.g. 0.00"
                                                               value={comb.price !== undefined && comb.price !== null ? comb.price : ""}
                                                               onChange={(e) => {
                                                                  const n = [...formData.variantCombinations];
                                                                  n[cIdx].price = e.target.value === "" ? "" : Number(e.target.value);
                                                                  setFormData({ ...formData, variantCombinations: n });
                                                               }}
                                                            />
                                                         </td>
                                                         <td className="px-4 py-2"><button type="button" onClick={()=>setFormData({...formData,variantCombinations:formData.variantCombinations.filter((_,i)=>i!==cIdx)})}><X className="w-3.5 h-3.5 text-gray-300 hover:text-red-500" /></button></td>
                                                      </tr>
                                                   ))}
                                                </tbody>
                                             </table>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              )}

                              {activeTab === "stats" && (
                                 <div className="space-y-6">
                                    <button type="button" onClick={() => setFormData({ ...formData, stats: [...(formData.stats || []), { label: "", value: "", icon: "Shield" }] })} className="bg-[#2271b1] text-white px-4 py-1.5 rounded-sm text-[11px] font-bold">+ Add Stat</button>
                                    {(formData.stats || []).map((stat, sIdx) => (
                                       <div key={sIdx} className="flex items-center gap-4 bg-white p-4 border border-gray-100 rounded shadow-sm">
                                          <input className="flex-1 border-b border-gray-100 p-1.5 text-[13px]" placeholder="Label" value={stat.label} onChange={e=>{ const n=[...formData.stats]; n[sIdx].label=e.target.value; setFormData({...formData,stats:n}); }} />
                                          <input className="flex-1 border-b border-gray-100 p-1.5 text-[13px]" placeholder="Value" value={stat.value} onChange={e=>{ const n=[...formData.stats]; n[sIdx].value=e.target.value; setFormData({...formData,stats:n}); }} />
                                          <button type="button" onClick={()=>setFormData({...formData,stats:formData.stats.filter((_,i)=>i!==sIdx)})}><X className="w-4 h-4 text-gray-300" /></button>
                                       </div>
                                    ))}
                                 </div>
                              )}

                              {activeTab === "faqs" && (
                                 <div className="space-y-6">
                                    <button type="button" onClick={() => setFormData({ ...formData, faqs: [...(formData.faqs || []), { question: "", answer: "" }] })} className="bg-[#2271b1] text-white px-4 py-1.5 rounded-sm text-[11px] font-bold">+ Add FAQ</button>
                                    {(formData.faqs || []).map((faq, fIdx) => (
                                       <div key={fIdx} className="bg-white border border-gray-100 p-4 rounded shadow-sm space-y-4">
                                          <input className="w-full border-b border-gray-100 p-2 text-[13px] font-bold" placeholder="Question" value={faq.question} onChange={e=>{ const n=[...formData.faqs]; n[fIdx].question=e.target.value; setFormData({...formData,faqs:n}); }} />
                                          <textarea className="w-full border-b border-gray-100 p-2 text-[13px]" placeholder="Answer" rows={2} value={faq.answer} onChange={e=>{ const n=[...formData.faqs]; n[fIdx].answer=e.target.value; setFormData({...formData,faqs:n}); }} />
                                          <button type="button" onClick={()=>setFormData({...formData,faqs:formData.faqs.filter((_,i)=>i!==fIdx)})} className="text-red-500 text-[11px]">Remove</button>
                                       </div>
                                    ))}
                                 </div>
                              )}

                               {activeTab === "sizeguide" && (
                                   <div className="space-y-6">
                                      <div className="bg-white border border-gray-100 p-6 rounded shadow-sm space-y-4 max-w-xl">
                                         <h3 className="text-[14px] font-bold text-gray-700 border-b border-gray-100 pb-2">Size Chart Configuration</h3>
                                         
                                         {/* Size Chart Source */}
                                         <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Size Chart Source</label>
                                            <select 
                                               className="w-full border border-gray-200 bg-white p-2 text-[13px] outline-none rounded focus:border-[#2271b1] cursor-pointer"
                                               value={formData.sizeChartSource || "category_default"}
                                               onChange={(e) => {
                                                  const val = e.target.value;
                                                  setFormData({ 
                                                     ...formData, 
                                                     sizeChartSource: val,
                                                     sizeGuide: {
                                                        ...(formData.sizeGuide || {}),
                                                        enabled: val === "product_custom"
                                                     }
                                                  });
                                               }}
                                            >
                                               <option value="category_default">Use Category Default</option>
                                               <option value="custom">Select Reusable Size Chart</option>
                                               <option value="product_custom">Create Custom Size Chart for this Product</option>
                                               <option value="none">No Size Chart (Disabled)</option>
                                            </select>
                                            <p className="text-[11px] text-gray-400">
                                               {formData.sizeChartSource === "category_default" 
                                                  ? "This product will automatically inherit the size chart assigned to its primary category."
                                                  : formData.sizeChartSource === "custom"
                                                  ? "Select a specific master size chart below to override the category default."
                                                  : formData.sizeChartSource === "product_custom"
                                                  ? "Build a custom, one-off size chart directly for this product below."
                                                  : "No size chart will be shown for this product."
                                               }
                                            </p>
                                         </div>

                                         {/* Size Chart Selection */}
                                         {formData.sizeChartSource === "custom" && (
                                            <div className="space-y-1.5 pt-2 animate-in fade-in duration-200">
                                               <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Select Reusable Size Chart</label>
                                               <select 
                                                  className="w-full border border-gray-200 bg-white p-2 text-[13px] outline-none rounded focus:border-[#2271b1] cursor-pointer"
                                                  value={formData.sizeChart || ""}
                                                  onChange={(e) => setFormData({ ...formData, sizeChart: e.target.value })}
                                               >
                                                  <option value="">-- Choose Size Chart --</option>
                                                  {sizeCharts.map((sc) => (
                                                     <option key={sc._id} value={sc._id}>
                                                        {sc.label}
                                                     </option>
                                                  ))}
                                               </select>
                                               {sizeCharts.length === 0 && (
                                                  <p className="text-[11px] text-red-500 font-bold">
                                                     No published size charts found. <a href="/admin/products/size-charts/new" className="underline" target="_blank" rel="noopener noreferrer">Create one here</a>
                                                  </p>
                                               )}
                                            </div>
                                         )}
                                      </div>

                                      {/* Inline Custom Size Chart Editor (only shown if sizeChartSource is product_custom) */}
                                      {formData.sizeChartSource === "product_custom" && (
                                         <div className="space-y-6 animate-in fade-in duration-300">
                                            {/* Size Name & Video */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                                               <div className="bg-white border border-[#c3c4c7] p-4 rounded space-y-3 shadow-sm">
                                                  <label className="block text-[11px] font-bold text-gray-400 uppercase">Size Column Name</label>
                                                  <input
                                                     className="w-full border border-[#c3c4c7] p-2 text-[13px] outline-none focus:border-[#2271b1] bg-white rounded"
                                                     placeholder="e.g. Jacket Size, Waist Size, Dress Size"
                                                     value={formData.sizeGuide?.sizeName || ""}
                                                     onChange={(e) => setFormData({
                                                        ...formData,
                                                        sizeGuide: {
                                                           ...(formData.sizeGuide || {}),
                                                           sizeName: e.target.value
                                                        }
                                                     })}
                                                  />
                                                  <p className="text-[11px] text-gray-400">Label shown as the first column header in the size table (e.g. "Jacket Size").</p>
                                               </div>
                                               <div className="bg-white border border-[#c3c4c7] p-4 rounded space-y-3 shadow-sm">
                                                  <label className="block text-[11px] font-bold text-gray-400 uppercase">YouTube Video Link</label>
                                                  <input
                                                     className="w-full border border-[#c3c4c7] p-2 text-[13px] outline-none focus:border-[#2271b1] bg-white rounded"
                                                     placeholder="e.g. https://www.youtube.com/watch?v=ipyhV51zUWk"
                                                     value={formData.sizeGuide?.videoUrl || ""}
                                                     onChange={(e) => setFormData({
                                                        ...formData,
                                                        sizeGuide: {
                                                           ...(formData.sizeGuide || {}),
                                                           videoUrl: e.target.value
                                                        }
                                                     })}
                                                  />
                                                  <p className="text-[11px] text-gray-400">URL to instructions video (YouTube embed/watch link).</p>
                                               </div>
                                            </div>

                                            {/* CM Table */}
                                            {(() => {
                                               const DEFAULT_COLS_CM = [
                                                  { key: "size", label: "Size" },
                                                  { key: "us", label: "US Size" },
                                                  { key: "eu", label: "EU Size" },
                                                  { key: "chest", label: "Chest (CM)" },
                                                  { key: "sleeves", label: "Sleeves (CM)" },
                                               ];
                                               const colsCm = formData.sizeGuide?.columnsCm?.length > 0
                                                  ? formData.sizeGuide.columnsCm
                                                  : DEFAULT_COLS_CM;
                                               const updateColsCm = (cols) =>
                                                  setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), columnsCm: cols } });
                                               const addColCm = () => {
                                                  const key = `col_${Date.now()}`;
                                                  updateColsCm([...colsCm, { key, label: "New Column" }]);
                                               };
                                               const removeColCm = (idx) => updateColsCm(colsCm.filter((_, i) => i !== idx));
                                               const renameColCm = (idx, label) => {
                                                  const updated = colsCm.map((c, i) => i === idx ? { ...c, label } : c);
                                                  updateColsCm(updated);
                                               };
                                               return (
                                                  <div className="bg-white border border-[#c3c4c7] p-4 rounded max-w-4xl shadow-sm">
                                                     <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                                                        <h4 className="text-[13px] font-bold text-gray-700">Size Chart (CM)</h4>
                                                        <div className="flex gap-2">
                                                           <button type="button" onClick={addColCm}
                                                              className="border border-[#2271b1] text-[#2271b1] px-3 py-1 rounded text-[11px] font-bold hover:bg-[#2271b1] hover:text-white transition">
                                                              + Add Column
                                                           </button>
                                                           <button type="button"
                                                              onClick={() => {
                                                                 const cm = [...(formData.sizeGuide?.sizesCm || [])];
                                                                 const emptyRow = {};
                                                                 colsCm.forEach(c => { emptyRow[c.key] = ""; });
                                                                 cm.push(emptyRow);
                                                                 setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), sizesCm: cm } });
                                                              }}
                                                              className="bg-[#2271b1] text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-[#135e96]">
                                                              + Add Row
                                                           </button>
                                                        </div>
                                                     </div>
                                                     <div className="overflow-x-auto">
                                                        <table className="w-full text-left text-[11px] border-collapse">
                                                           <thead>
                                                              <tr className="bg-gray-50 border-b border-gray-200">
                                                                 {colsCm.map((col, cIdx) => (
                                                                    <th key={col.key} className="p-1">
                                                                       <div className="flex items-center gap-1 group">
                                                                          <input
                                                                             className="border border-transparent hover:border-gray-200 focus:border-[#2271b1] bg-transparent outline-none text-gray-500 font-bold uppercase text-[10px] w-full min-w-[60px] px-1 py-0.5 rounded"
                                                                             value={col.label}
                                                                             onChange={(e) => renameColCm(cIdx, e.target.value)}
                                                                          />
                                                                          {colsCm.length > 1 && (
                                                                             <button type="button" onClick={() => removeColCm(cIdx)}
                                                                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition flex-shrink-0">
                                                                                <X className="w-3 h-3" />
                                                                             </button>
                                                                          )}
                                                                       </div>
                                                                    </th>
                                                                 ))}
                                                                 <th className="p-1 w-8" />
                                                              </tr>
                                                           </thead>
                                                           <tbody className="divide-y divide-gray-100">
                                                              {(formData.sizeGuide?.sizesCm || []).map((row, rIdx) => (
                                                                 <tr key={rIdx}>
                                                                    {colsCm.map(col => (
                                                                       <td key={col.key} className="p-1">
                                                                          <input
                                                                             className="w-full border border-gray-200 p-1 text-[11px]"
                                                                             value={row[col.key] || ""}
                                                                             onChange={(e) => {
                                                                                const cm = [...(formData.sizeGuide?.sizesCm || [])];
                                                                                cm[rIdx] = { ...cm[rIdx], [col.key]: e.target.value };
                                                                                setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), sizesCm: cm } });
                                                                             }}
                                                                          />
                                                                       </td>
                                                                    ))}
                                                                    <td className="p-1 text-center">
                                                                       <button type="button" onClick={() => {
                                                                          const cm = (formData.sizeGuide?.sizesCm || []).filter((_, i) => i !== rIdx);
                                                                          setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), sizesCm: cm } });
                                                                       }}><X className="w-3.5 h-3.5 text-gray-300 hover:text-red-500" /></button>
                                                                    </td>
                                                                 </tr>
                                                              ))}
                                                           </tbody>
                                                        </table>
                                                     </div>
                                                  </div>
                                               );
                                            })()}

                                            {/* INCHES Table */}
                                            {(() => {
                                               const DEFAULT_COLS_IN = [
                                                  { key: "size", label: "Size" },
                                                  { key: "us", label: "US Size" },
                                                  { key: "eu", label: "EU Size" },
                                                  { key: "chest", label: "Chest (IN)" },
                                                  { key: "sleeves", label: "Sleeves (IN)" },
                                               ];
                                               const colsIn = formData.sizeGuide?.columnsIn?.length > 0
                                                  ? formData.sizeGuide.columnsIn
                                                  : DEFAULT_COLS_IN;
                                               const updateColsIn = (cols) =>
                                                  setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), columnsIn: cols } });
                                               const addColIn = () => {
                                                  const key = `col_${Date.now()}`;
                                                  updateColsIn([...colsIn, { key, label: "New Column" }]);
                                               };
                                               const removeColIn = (idx) => updateColsIn(colsIn.filter((_, i) => i !== idx));
                                               const renameColIn = (idx, label) => {
                                                  const updated = colsIn.map((c, i) => i === idx ? { ...c, label } : c);
                                                  updateColsIn(updated);
                                               };
                                               return (
                                                  <div className="bg-white border border-[#c3c4c7] p-4 rounded max-w-4xl shadow-sm">
                                                     <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                                                        <h4 className="text-[13px] font-bold text-gray-700">Size Chart (INCHES)</h4>
                                                        <div className="flex gap-2">
                                                           <button type="button" onClick={addColIn}
                                                              className="border border-[#2271b1] text-[#2271b1] px-3 py-1 rounded text-[11px] font-bold hover:bg-[#2271b1] hover:text-white transition">
                                                              + Add Column
                                                           </button>
                                                           <button type="button"
                                                              onClick={() => {
                                                                 const inches = [...(formData.sizeGuide?.sizesIn || [])];
                                                                 const emptyRow = {};
                                                                 colsIn.forEach(c => { emptyRow[c.key] = ""; });
                                                                 inches.push(emptyRow);
                                                                 setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), sizesIn: inches } });
                                                              }}
                                                              className="bg-[#2271b1] text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-[#135e96]">
                                                              + Add Row
                                                           </button>
                                                        </div>
                                                     </div>
                                                     <div className="overflow-x-auto">
                                                        <table className="w-full text-left text-[11px] border-collapse">
                                                           <thead>
                                                              <tr className="bg-gray-50 border-b border-gray-200">
                                                                 {colsIn.map((col, cIdx) => (
                                                                    <th key={col.key} className="p-1">
                                                                       <div className="flex items-center gap-1 group">
                                                                          <input
                                                                             className="border border-transparent hover:border-gray-200 focus:border-[#2271b1] bg-transparent outline-none text-gray-500 font-bold uppercase text-[10px] w-full min-w-[60px] px-1 py-0.5 rounded"
                                                                             value={col.label}
                                                                             onChange={(e) => renameColIn(cIdx, e.target.value)}
                                                                          />
                                                                          {colsIn.length > 1 && (
                                                                             <button type="button" onClick={() => removeColIn(cIdx)}
                                                                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition flex-shrink-0">
                                                                                <X className="w-3 h-3" />
                                                                             </button>
                                                                          )}
                                                                       </div>
                                                                    </th>
                                                                 ))}
                                                                 <th className="p-1 w-8" />
                                                              </tr>
                                                           </thead>
                                                           <tbody className="divide-y divide-gray-100">
                                                              {(formData.sizeGuide?.sizesIn || []).map((row, rIdx) => (
                                                                 <tr key={rIdx}>
                                                                    {colsIn.map(col => (
                                                                       <td key={col.key} className="p-1">
                                                                          <input
                                                                             className="w-full border border-gray-200 p-1 text-[11px]"
                                                                             value={row[col.key] || ""}
                                                                             onChange={(e) => {
                                                                                const inches = [...(formData.sizeGuide?.sizesIn || [])];
                                                                                inches[rIdx] = { ...inches[rIdx], [col.key]: e.target.value };
                                                                                setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), sizesIn: inches } });
                                                                             }}
                                                                          />
                                                                       </td>
                                                                    ))}
                                                                    <td className="p-1 text-center">
                                                                       <button type="button" onClick={() => {
                                                                          const inches = (formData.sizeGuide?.sizesIn || []).filter((_, i) => i !== rIdx);
                                                                          setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), sizesIn: inches } });
                                                                       }}><X className="w-3.5 h-3.5 text-gray-300 hover:text-red-500" /></button>
                                                                    </td>
                                                                 </tr>
                                                              ))}
                                                           </tbody>
                                                        </table>
                                                     </div>
                                                  </div>
                                               );
                                            })()}

                                            {/* Instructions */}
                                            <div className="bg-white border border-[#c3c4c7] p-4 rounded max-w-4xl shadow-sm space-y-4">
                                               <div className="flex justify-between items-center mb-1 flex-wrap gap-2">
                                                  <h4 className="text-[13px] font-bold text-gray-700">How to Measure Instructions</h4>
                                                  <button type="button"
                                                     onClick={() => {
                                                        const inst = [...(formData.sizeGuide?.instructions || [])];
                                                        inst.push({ title: "", desc: "" });
                                                        setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), instructions: inst } });
                                                     }}
                                                     className="bg-[#2271b1] text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-[#135e96]">
                                                     + Add Instruction
                                                  </button>
                                               </div>
                                               <div className="space-y-4">
                                                  {(formData.sizeGuide?.instructions || []).map((row, rIdx) => {
                                                     const updateRow = (key, val) => {
                                                        const inst = [...(formData.sizeGuide?.instructions || [])];
                                                        inst[rIdx][key] = val;
                                                        setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), instructions: inst } });
                                                     };
                                                     return (
                                                        <div key={rIdx} className="border border-gray-100 p-3 rounded bg-gray-50/50 flex gap-4 items-start">
                                                           <div className="flex-1 space-y-2">
                                                              <input
                                                                 className="w-full border border-gray-200 p-1.5 text-[12px] font-bold bg-white"
                                                                 placeholder="e.g. Sleeve Length"
                                                                 value={row.title}
                                                                 onChange={(e) => updateRow("title", e.target.value)}
                                                              />
                                                              <textarea
                                                                 className="w-full border border-gray-200 p-1.5 text-[12px] bg-white resize-none"
                                                                 placeholder="Instruction text..."
                                                                 rows={2}
                                                                 value={row.desc}
                                                                 onChange={(e) => updateRow("desc", e.target.value)}
                                                              />
                                                           </div>
                                                           <button
                                                              type="button"
                                                              onClick={() => {
                                                                 const inst = (formData.sizeGuide?.instructions || []).filter((_, idx) => idx !== rIdx);
                                                                 setFormData({ ...formData, sizeGuide: { ...(formData.sizeGuide || {}), instructions: inst } });
                                                              }}
                                                              className="text-gray-300 hover:text-red-500 mt-1"
                                                           >
                                                              <X className="w-4 h-4" />
                                                           </button>
                                                        </div>
                                                     );
                                                  })}
                                               </div>
                                            </div>
                                         </div>
                                      )}
                                   </div>
                                )}

                           </div>
                        </div>
                     </div>
                  </>
               ) : (
                  <SEOConfigPanel
                     seo={formData.seo || {}}
                     onChange={newSeo => setFormData(prev => ({ ...prev, seo: newSeo }))}
                     parentTitle={formData.name}
                     parentDescription={formData.shortDescription || formData.description}
                     parentSlug={formData.slug}
                     parentImage={formData.image || (formData.images && formData.images[0])}
                     parentType="product"
                  />
               )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
               <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[2px]">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Publish</div>
                  <div className="p-3 space-y-4 text-[13px]">
                     <div className="flex justify-between items-center">
                        <button type="button" onClick={handleSubmit} className="border border-[#c3c4c7] px-3 py-1.5 rounded-[3px] bg-[#f6f7f7] hover:bg-[#f0f0f1] text-[12px] font-medium">Save Draft</button>
                        <button type="button" onClick={() => formData.slug && window.open(`/product/${formData.slug}`, '_blank')} className="text-[#2271b1] underline text-[12px]" title={formData.slug ? `Preview /product/${formData.slug}` : 'Save first to preview'}>Preview</button>
                     </div>
                     <div className="space-y-3 py-3 border-y border-gray-100">
                        <div className="flex items-center justify-between">
                            <p><span className="text-gray-400">Status:</span> <strong>{formData.status}</strong></p>
                            <select 
                                className="text-[11px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-[#2271b1]"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                           <input 
                              type="checkbox" 
                              id="isFeatured"
                              checked={formData.isFeatured}
                              onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                           />
                           <label htmlFor="isFeatured" className="text-gray-400 cursor-pointer">Featured Product</label>
                        </div>
                        <p><span className="text-gray-400">Visibility:</span> <strong>Public</strong></p>
                     </div>
                     <div className="bg-[#f6f7f7] border-t border-[#c3c4c7] -mx-3 -mb-3 p-3 flex justify-between items-center">
                        <button type="button" className="text-red-600 underline">Move to Trash</button>
                        <button type="submit" disabled={saving} className="bg-[#2271b1] text-white px-4 py-1.5 rounded-[3px] font-bold hover:bg-[#135e96]">
                           {saving ? "Saving..." : (productId ? "Update" : "Publish")}
                        </button>
                     </div>
                  </div>
               </div>

               <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[2px]">
                   <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700 flex items-center justify-between">
                      <span>Categories</span>
                      <button type="button" onClick={() => router.push("/admin/categories")} className="text-[10px] text-[#2271b1] hover:underline font-normal">Manage</button>
                   </div>
                   <div className="p-4 max-h-48 overflow-y-auto border-b border-gray-100">
                      {categories.length === 0 ? (
                         <p className="text-[11px] text-gray-400 italic">No categories found.</p>
                      ) : (
                         categories.map(cat => (
                            <label key={cat._id} className="flex items-center gap-2 text-[13px] mb-2 cursor-pointer">
                               <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-gray-300 text-[#2271b1] focus:ring-[#2271b1]" 
                                  checked={(formData.categories || []).includes(cat._id)} 
                                  onChange={e => {
                                     const n = e.target.checked ? [...(formData.categories || []), cat._id] : (formData.categories || []).filter(id => id !== cat._id);
                                     setFormData({ ...formData, categories: n });
                                  }} 
                               /> 
                               {cat.name}
                            </label>
                         ))
                      )}
                   </div>
                </div>

               <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[2px]">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Product Image</div>
                  <div className="p-4">
                     <MediaPicker value={formData.images[0]} onChange={url => setFormData({ ...formData, images: [url, ...(formData.images?.slice(1) || [])] })} />
                  </div>
                  <div className="p-4 border-t border-gray-100">
                     <label className="text-[13px] font-bold block mb-2 text-gray-700">Product Gallery</label>
                     <MediaPicker multiple value={formData.images.slice(1)} onChange={urls => setFormData({ ...formData, images: [formData.images[0] || "", ...urls] })} />
                  </div>
               </div>
            </div>
         </form>
    </AdminPageLayout>
   );
}

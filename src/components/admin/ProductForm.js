"use client";

import { useState, useEffect, useRef } from "react";
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
   Ruler,
   Gift
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
import Link from "next/link";
import { Page, PageHeader, Postbox, Notice } from "./ui";
import { getSwatchBackground } from "@/lib/swatchRenderer";
import { getProductUrl } from "@/lib/routes";
import { usePopup } from "@/context/PopupContext";
import { validatePrices, priceWarning, buildVariantSku } from "@/lib/admin-products-utils";

// Tiny inline image button — opens MediaPickerModal without the full MediaPicker drop-zone UI
function InlinePick({ value, onChange, label = "+ Image", doneLabel = "✓ Change", title = "Pick image" }) {
   const [open, setOpen] = useState(false);
   return (
      <>
         <button
            type="button"
            onClick={() => setOpen(true)}
            title={title}
            className="wp-btn"
            style={{ minHeight: 28, padding: "0 8px", ...(value ? { background: "#f0f6fc" } : {}) }}
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
   const { showConfirm } = usePopup();
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

   // Per-attribute draft text for the "Add value…" inputs (keyed by attribute index)
   const [attrValueDrafts, setAttrValueDrafts] = useState({});
   const focusAppliedRef = useRef(false);

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
      corporateGifting: { minSelections: 3, items: [] },
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
            // Fetch categories safely
            const catsRes = await fetch("/api/admin/categories?type=product").catch(() => null);
            if (catsRes?.ok) {
               const data = await catsRes.json().catch(() => []);
               setCategories(Array.isArray(data) ? data : []);
            } else {
               setCategories([]);
            }

            // Fetch size charts safely
            const scRes = await fetch("/api/admin/size-charts").catch(() => null);
            if (scRes?.ok) {
               const scData = await scRes.json().catch(() => []);
               if (Array.isArray(scData)) {
                  setSizeCharts(scData.filter(sc => sc && sc.status === "Published" && !sc.isDeleted));
               }
            }

            if (productId) {
               const prodRes = await fetch(`/api/admin/products?id=${productId}`).catch(() => null);
               if (prodRes?.ok) {
                  const prodData = await prodRes.json().catch(() => null);
                  if (prodData && typeof prodData === "object" && prodData._id) {
                     setSlugManuallyEdited(!!prodData.slugManuallyEdited);
                     setFormData({
                        ...prodData,
                        productType: prodData.productType || "simple",
                        images: Array.isArray(prodData.images) ? prodData.images : [],
                        corporateGifting: {
                           minSelections: prodData.corporateGifting?.minSelections || 3,
                           items: Array.isArray(prodData.corporateGifting?.items) ? prodData.corporateGifting.items : [],
                        },
                        categories: Array.isArray(prodData.categories) ? prodData.categories : [],
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
                        attributes: prodData.attributes || (Array.isArray(prodData.variants) ? prodData.variants.map(v => ({
                           name: v?.name || "",
                           type: v?.name?.toLowerCase().includes("color") ? "color" : v?.name?.toLowerCase().includes("size") ? "size" : "custom",
                           values: Array.isArray(v?.values) ? v.values.map(val => ({
                              label: val?.name || val || "",
                              value: val?.name || val || "",
                              hex: val?.hex || "",
                              image: val?.image || "",
                              variantImage: ""
                           })) : []
                        })) : []),
                        variantCombinations: Array.isArray(prodData.variantCombinations) ? prodData.variantCombinations : [],
                        stats: Array.isArray(prodData.stats) ? prodData.stats : [],
                        faqs: Array.isArray(prodData.faqs) ? prodData.faqs : [],
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
               }
            }
         } catch (err) {
            console.error("Fetch failed", err);
         } finally {
            setLoading(false);
         }
      };
      fetchData();
    }, [productId]);

    // Apply ?focus= / ?tab= once, after the product data has loaded
    useEffect(() => {
        if (loading || focusAppliedRef.current || typeof window === 'undefined') return;
        focusAppliedRef.current = true;
        const params = new URLSearchParams(window.location.search);
        const focus = params.get("focus");
        const tab = params.get("tab");
        const productType = formData.productType;
        const focusEl = (...ids) => setTimeout(() => {
           const el = ids.map(id => document.getElementById(id)).find(Boolean);
           if (el) {
              el.focus();
              el.scrollIntoView({ behavior: "smooth", block: "center" });
           }
        }, 300);

        // Deferred so state isn't set synchronously inside the effect body
        Promise.resolve().then(() => {
           if (focus === "seo" || tab === "seo") {
              setActiveFormTab("seo");
           } else if (focus === "content" || tab === "content") {
              setActiveFormTab("content");
           }

           if (focus === "pricing" || focus === "price" || tab === "general") {
              setActiveTab("general");
              focusEl("sale-price-input");
           } else if (focus === "stock" || focus === "inventory" || tab === "inventory") {
              setActiveTab("inventory");
              // The quantity field only renders while stock tracking is on; else focus the toggle
              focusEl("stock-input", "manage-stock-input");
           } else if (focus === "variants" || tab === "variants") {
              // The Variants tab only exists for variable products
              setActiveTab(productType === "variable" ? "variants" : productType === "gifting" ? "gifting" : "general");
           } else if (focus === "sizeguide" || focus === "size" || tab === "sizeguide") {
              setActiveTab("sizeguide");
           } else if (focus === "faqs" || tab === "faqs") {
              setActiveTab("faqs");
           } else if (focus === "stats" || tab === "stats") {
              setActiveTab("stats");
           }
        });
     }, [loading, formData.productType]);

   // options.asDraft: "Save Draft" always saves with status Draft
   const handleSubmit = async (e, options = {}) => {
      if (e) e.preventDefault();
      const asDraft = options.asDraft === true;
      const priceError = validatePrices(formData.compareAtPrice, formData.price);
      if (priceError) {
         toast.error(priceError);
         setActiveTab("general");
         return;
      }
      const warning = priceWarning(formData.compareAtPrice, formData.price);
      if (warning) toast(warning);
      if (formData.productType === "variable") {
         for (const comb of formData.variantCombinations || []) {
            const combError = validatePrices(comb.compareAtPrice, comb.price);
            if (combError) {
               toast.error(`${comb.title || "Variant"}: ${combError}`);
               setActiveTab("variants");
               return;
            }
         }
      }
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

      // Gifting products carry their selectable items on corporateGifting; `enabled` is derived
      // from the product type so the checkout/pricing/order pipeline (which keys off it) stays in
      // sync without a separate toggle. Non-gifting products save it disabled with no items.
      const isGifting = formData.productType === "gifting";
      const corporateGifting = {
         enabled: isGifting,
         minSelections: isGifting ? Math.max(1, Number(formData.corporateGifting?.minSelections) || 3) : 3,
         items: isGifting
            ? (formData.corporateGifting?.items || [])
               .filter((it) => String(it.name || "").trim())
               .map(({ _localKey, ...it }) => ({
                  ...(it._id ? { _id: it._id } : {}),
                  name: String(it.name).trim(),
                  description: String(it.description || "").trim(),
                  image: it.image || "",
                  priceDelta: Number(it.priceDelta) || 0,
                  active: it.active !== false,
               }))
            : [],
      };
      const normalizedData = {
         ...formData,
         ...(asDraft ? { status: "Draft" } : {}),
         corporateGifting,
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
             if (asDraft) setFormData(prev => ({ ...prev, status: "Draft" }));
             // The server keeps slugs unique (adds -1, -2… on a clash): show the slug actually saved
             if (savedProduct?.slug && savedProduct.slug !== finalSlug) {
                setFormData(prev => ({ ...prev, slug: savedProduct.slug }));
                toast(`That permalink was taken, so it was saved as "${savedProduct.slug}".`);
             }
             toast.success(asDraft ? "Draft saved." : productId ? "Product updated successfully!" : "Product created successfully!");
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

   const handleTrash = async () => {
      if (!productId) return;
      if (!(await showConfirm("Move this product to trash?", "Move to Trash", { confirmText: "Move to Trash", danger: true }))) return;
      try {
         const res = await fetch(`/api/admin/products?id=${productId}`, { method: "DELETE" });
         if (res.ok) {
            toast.success("Product moved to trash.");
            router.push("/admin/products");
         } else {
            const errData = await res.json().catch(() => ({}));
            toast.error(errData.error || "Failed to move product to trash");
         }
      } catch (err) {
         console.error(err);
         toast.error("Failed to move product to trash");
      }
   };

   // Restore a trashed product straight from its edit screen (server puts back its old status)
   const handleRestore = async () => {
      if (!productId) return;
      try {
         const res = await fetch("/api/admin/products", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: productId, isDeleted: false })
         });
         const data = await res.json().catch(() => ({}));
         if (!res.ok) throw new Error(data?.error || "Failed to restore product");
         setFormData(prev => ({ ...prev, isDeleted: false, deletedAt: null, status: data.status || prev.status }));
         toast.success("Product restored.");
      } catch (err) {
         toast.error(err.message || "Failed to restore product");
      }
   };

   const addAttribute = () => {
      setFormData(prev => ({
         ...prev,
         attributes: [...(prev.attributes || []), { name: "", type: "custom", values: [] }]
      }));
   };

   const addAttributeValue = (aIdx, label) => {
      if (!label) return;
      setFormData(prev => ({
         ...prev,
         attributes: (prev.attributes || []).map((attr, i) => i !== aIdx ? attr : {
            ...attr,
            values: [...(attr.values || []), {
               label,
               value: label,
               hex: attr.type === "color" ? "#000000" : "",
               colorMode: "single",
               hex2: "",
               hex3: "",
               hex4: "",
               texture: "",
               image: "",
               swatchType: "color", // "color" | "image"
               variantImage: ""
            }]
         })
      }));
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
      setFormData(prev => ({
         ...prev,
         variantCombinations: combos.map(c => ({
            title: c.map(v => v.label).join(" / "),
            price: prev.price,
            compareAtPrice: prev.compareAtPrice,
            stock: prev.stock,
            sku: buildVariantSku(prev.sku, c.map(v => v.label)),
            image: c.find(v => v.variantImage)?.variantImage || ""
         }))
      }));
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
         setFormData(prev => ({
            ...prev,
            attributes: [...(prev.attributes || []), templates[type]]
         }));
      }
   };

   if (loading) return (
      <Page>
         <p className="wp-muted" role="status" style={{ padding: "16px 0" }}>Loading editor...</p>
      </Page>
   );

   if (productId && !formData.name) {
      return (
         <Page>
            <PageHeader title="Edit Product" />
            <div className="wp-notice wp-notice-error" role="alert" style={{ alignItems: "flex-start", maxWidth: 640 }}>
               <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="wp-strong" style={{ marginBottom: 4 }}>
                     Failed to load product data
                  </p>
                  <p>
                     Your administrator session may have expired, or the product you are trying to edit does not exist. Please try logging back in.
                  </p>
                  <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 12 }}>
                     <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="wp-btn wp-btn-primary"
                     >
                        Retry Connection / Reload
                     </button>
                     <Link href="/admin-login" className="wp-btn">
                        Log In to Admin Panel
                     </Link>
                     <Link href="/admin/products" className="wp-link">
                        ← Back to Products List
                     </Link>
                  </div>
               </div>
            </div>
         </Page>
      );
   }

   // Presentational helper: plain-text buttons styled as WordPress links
   const linkBtnStyle = { background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" };
   const dangerLinkStyle = { ...linkBtnStyle, color: "#b32d2e", textDecoration: "underline" };
   const subBoxStyle = { border: "1px solid #dcdcde", background: "#fff", marginBottom: 16 };
   const subHeadStyle = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #dcdcde", background: "#f6f7f7" };
   const iconBtnStyle = { ...linkBtnStyle, color: "#646970", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 32, minHeight: 32 };
   // Canonical storefront URL is /product/<slug> (category-nested URLs redirect there);
   // an unsaved slug falls back to the saved product's id route.
   const previewUrl = productId ? getProductUrl({ slug: formData.slug, _id: productId }) : null;

   return (
      <Page>
         <PageHeader
            title={productId ? "Edit Product" : "Add New Product"}
            actions={productId ? <Link href="/admin/products/new" className="wp-btn">Add New</Link> : null}
         />
         {productId && formData.isDeleted && (
            <Notice type="warning">
               This product is in the Trash and hidden from the store.{" "}
               <button type="button" onClick={handleRestore} className="wp-link" style={linkBtnStyle}>Restore it</button>
            </Notice>
         )}
         <form onSubmit={handleSubmit} className="wp-cols">
            {/* Main Column */}
            <div className="wp-col-main">
               <div style={{ marginBottom: 20 }}>
                  <label htmlFor="product-title-input" className="sr-only">Product name</label>
                  <input
                     id="product-title-input"
                     required
                     placeholder="Enter title here"
                     className="wp-title-input"
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
                  <div className="wp-small flex flex-wrap items-center gap-1.5 break-words" style={{ marginTop: 8, color: "#3c434a" }} aria-live="polite">
                     <span className="wp-strong">Permalink:</span>
                     <span className="wp-muted break-all">pairolifestyle.com/product/</span>

                     {slugLocked ? (
                        // Read-only view with edit button
                        <>
                           <span className="wp-strong break-all">{formData.slug || <em className="wp-muted">auto-generated</em>}</span>
                           <button
                              type="button"
                              title="Edit permalink"
                              aria-label="Edit permalink"
                              onClick={() => {
                                 setSlugDraftValue(formData.slug);
                                 setSlugCheckState(null);
                                 setSlugLocked(false);
                              }}
                              className="wp-btn"
                              style={{ minHeight: 26, padding: "0 8px" }}
                           >
                              <Pencil className="w-3 h-3" aria-hidden="true" /> Edit
                           </button>
                           {!slugManuallyEdited && formData.slug && (
                              <span className="wp-muted">(auto)</span>
                           )}
                        </>
                     ) : (
                        // Edit mode: input + check status + update/cancel buttons
                        <>
                           <label htmlFor="product-slug-input" className="sr-only">Permalink slug</label>
                           <input
                              id="product-slug-input"
                              autoFocus
                              className="wp-input"
                              style={{ minWidth: 140, minHeight: 28 }}
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
                           {slugCheckState === "checking" && <Loader2 className="w-3.5 h-3.5 animate-spin wp-muted" aria-label="Checking availability" />}
                           {slugCheckState === "unique" && <span className="flex items-center gap-0.5" style={{ color: "#2f6f1a", fontWeight: 600 }}><Check className="w-3 h-3" aria-hidden="true" /> Available</span>}
                           {slugCheckState === "taken" && <span style={{ color: "#b32d2e", fontWeight: 600 }}>Taken</span>}

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
                              className="wp-btn"
                              style={{ minHeight: 26, padding: "0 8px" }}
                           >
                              <Lock className="w-3 h-3" aria-hidden="true" /> Update
                           </button>

                           {/* Cancel button */}
                           <button
                              type="button"
                              onClick={() => { setSlugLocked(true); setSlugCheckState(null); }}
                              className="wp-link"
                              style={linkBtnStyle}
                           >
                              Cancel
                           </button>
                        </>
                     )}
                  </div>
               </div>

               {/* Content / SEO Tabs */}
               <div className="wp-tabs" role="tablist" aria-label="Editor sections">
                  <button
                     type="button"
                     role="tab"
                     id="pf-tab-content"
                     aria-selected={activeFormTab === "content"}
                     aria-controls="pf-form-panel"
                     onClick={() => setActiveFormTab("content")}
                     className="wp-tab"
                  >
                     Content Editor
                  </button>
                  <button
                     type="button"
                     role="tab"
                     id="pf-tab-seo"
                     aria-selected={activeFormTab === "seo"}
                     aria-controls="pf-form-panel"
                     onClick={() => setActiveFormTab("seo")}
                     className="wp-tab"
                  >
                     SEO Settings
                  </button>
               </div>

               <div id="pf-form-panel" role="tabpanel" aria-labelledby={activeFormTab === "seo" ? "pf-tab-seo" : "pf-tab-content"}>
               {activeFormTab === "content" ? (
                  <>
                     {/* Long Description editor */}
                     {/* No overflow:hidden here: it would trap the editor's sticky toolbar inside this box
                         (offset by the admin-bar height, covering the first lines of text) */}
                     <div className="wp-postbox" role="group" aria-label="Product description">
                        <TiptapEditor
                           content={formData.description}
                           onChange={(html) => setFormData(prev => ({ ...prev, description: html }))}
                        />
                     </div>

                     {/* Product Data Meta Box */}
                     <section className="wp-postbox" aria-labelledby="pf-data-title">
                        <div className="wp-postbox-head" style={{ flexWrap: "wrap", paddingTop: 6, paddingBottom: 6 }}>
                           <h2 id="pf-data-title" style={{ flex: "none" }}>Product data</h2>
                           <span className="wp-muted" aria-hidden="true">—</span>
                           <label htmlFor="product-type-select" className="sr-only">Product type</label>
                           <select
                              id="product-type-select"
                              className="wp-select"
                              value={formData.productType}
                              onChange={(e) => {
                                 const val = e.target.value;
                                 setFormData(prev => ({ ...prev, productType: val }));
                                 if (val === "variable") setActiveTab("variants");
                                 if (val === "gifting") setActiveTab("gifting");
                              }}
                           >
                              <option value="simple">Simple product</option>
                              <option value="variable">Variable product</option>
                              <option value="gifting">Gifting product</option>
                           </select>
                        </div>
                        <div className="wp-vtabs">
                           {/* Vertical Tabs */}
                           <div className="wp-vtabs-list" role="tablist" aria-label="Product data">
                              {[
                                 { id: "general", label: "General", icon: Zap },
                                 { id: "inventory", label: "Inventory", icon: Package },
                                 formData.productType === "variable" && { id: "variants", label: "Variants Engine", icon: Layers },
                                 formData.productType === "gifting" && { id: "gifting", label: "Gifting Items", icon: Gift },
                                 { id: "stats", label: "Product Stats", icon: Activity },
                                 { id: "faqs", label: "FAQs", icon: HelpCircle },
                                 { id: "sizeguide", label: "Size Guide", icon: Ruler }
                              ].filter(Boolean).map(tab => (
                                 <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    id={`pf-vtab-${tab.id}`}
                                    aria-selected={activeTab === tab.id}
                                    aria-controls="pf-vtab-panel"
                                    onClick={() => setActiveTab(tab.id)}
                                    className="wp-vtab"
                                 >
                                    <tab.icon className="w-4 h-4" aria-hidden="true" style={{ flex: "none" }} /> {tab.label}
                                 </button>
                              ))}
                           </div>

                           {/* Tab Panels */}
                           <div id="pf-vtab-panel" role="tabpanel" aria-labelledby={`pf-vtab-${activeTab}`} className="wp-vtabs-panel">
                              {activeTab === "general" && (
                                 <div>
                                    <div className="wp-frow">
                                       <label htmlFor="regular-price-input" className="wp-flabel">Regular price ($)</label>
                                       <input id="regular-price-input" type="number" min="0" step="0.01" inputMode="decimal" className="wp-input" placeholder="0.00" value={formData.compareAtPrice ?? ""} onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, compareAtPrice: v })); }} />
                                    </div>
                                    <div className="wp-frow">
                                       <label htmlFor="sale-price-input" className="wp-flabel">Sale price ($)</label>
                                       <input id="sale-price-input" type="number" min="0" step="0.01" inputMode="decimal" className="wp-input" placeholder="0.00" value={formData.price ?? ""} onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, price: v })); }} />
                                    </div>
                                    <div className="wp-frow">
                                       <label htmlFor="shipping-type-select" className="wp-flabel">Shipping type</label>
                                       <select id="shipping-type-select" className="wp-select" value={formData.shippingType} onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, shippingType: v })); }}>
                                          <option value="Express">Express Shipping</option>
                                          <option value="Standard">Standard Shipping</option>
                                          <option value="Free">Free Shipping</option>
                                          <option value="Priority">Priority Mail</option>
                                       </select>
                                    </div>
                                    <div className="wp-frow">
                                       <label htmlFor="product-color-input" className="wp-flabel">Color</label>
                                       <input
                                          id="product-color-input"
                                          className="wp-input"
                                          placeholder="e.g. Black, Navy Blue, Crimson"
                                          value={formData.color || ""}
                                          onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, color: v })); }}
                                       />
                                    </div>
                                    <div className="wp-frow">
                                       <label htmlFor="product-gender-select" className="wp-flabel">Gender</label>
                                       <select
                                          id="product-gender-select"
                                          className="wp-select"
                                          value={formData.gender || "unisex"}
                                          onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, gender: v })); }}
                                       >
                                          <option value="unisex">Unisex</option>
                                          <option value="male">Male</option>
                                          <option value="female">Female</option>
                                       </select>
                                    </div>
                                    <div className="wp-frow">
                                       <label htmlFor="product-age-select" className="wp-flabel">Age group</label>
                                       <select
                                          id="product-age-select"
                                          className="wp-select"
                                          value={formData.ageGroup || "adult"}
                                          onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, ageGroup: v })); }}
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
                                 <div>
                                    <div className="wp-frow">
                                       <label htmlFor="product-sku-input" className="wp-flabel">SKU</label>
                                       <input id="product-sku-input" className="wp-input uppercase" placeholder="e.g. PR-001" value={formData.sku} onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, sku: v })); }} />
                                    </div>
                                    <div className="wp-frow">
                                       <span className="wp-flabel">Track stock</span>
                                       <label className="wp-check" htmlFor="manage-stock-input">
                                          <input id="manage-stock-input" type="checkbox" checked={formData.manageStock} onChange={(e) => { const v = e.target.checked; setFormData(prev => ({ ...prev, manageStock: v })); }} />
                                          <span>Enable inventory tracking for this product</span>
                                       </label>
                                    </div>
                                    {formData.manageStock && (
                                       <div className="wp-frow">
                                          <label htmlFor="stock-input" className="wp-flabel">Stock quantity</label>
                                          <input id="stock-input" type="number" className="wp-input" value={formData.stock} onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, stock: v })); }} />
                                       </div>
                                    )}
                                 </div>
                              )}

                              {activeTab === "variants" && (
                                 <div>
                                    <div className="flex flex-wrap items-center justify-between gap-2" style={{ margin: "6px 0 14px" }}>
                                       <h3 className="wp-strong" style={{ fontSize: 14, margin: 0 }}>Variant attributes</h3>
                                       <div className="flex flex-wrap gap-2">
                                          <button type="button" onClick={() => addTemplate("color")} className="wp-btn">+ Color</button>
                                          <button type="button" onClick={() => addTemplate("size")} className="wp-btn">+ Size</button>
                                          <button type="button" onClick={addAttribute} className="wp-btn wp-btn-primary">+ Custom</button>
                                       </div>
                                    </div>

                                    {(formData.attributes || []).map((attr, aIdx) => {
                                       const mapAttr = (fn) => setFormData(prev => ({ ...prev, attributes: (prev.attributes || []).map((a, i) => i === aIdx ? fn(a) : a) }));
                                       const updateAttr = (key, v) => mapAttr(a => ({ ...a, [key]: v }));
                                       const updateVal = (vIdx, key, v) => mapAttr(a => ({ ...a, values: (a.values || []).map((val, i) => i === vIdx ? { ...val, [key]: v } : val) }));
                                       const removeVal = (vIdx) => mapAttr(a => ({ ...a, values: (a.values || []).filter((_, i) => i !== vIdx) }));

                                       return (
                                          <div key={aIdx} style={subBoxStyle}>
                                             <div style={subHeadStyle}>
                                                <label htmlFor={`attr-${aIdx}-name`} className="sr-only">Attribute name</label>
                                                <input id={`attr-${aIdx}-name`} className="wp-input wp-strong" style={{ width: 160 }} placeholder="Attribute name" value={attr.name} onChange={e=>updateAttr("name",e.target.value)} />
                                                <label htmlFor={`attr-${aIdx}-type`} className="sr-only">Attribute type</label>
                                                <select id={`attr-${aIdx}-type`} className="wp-select" value={attr.type} onChange={e=>updateAttr("type",e.target.value)}>
                                                   <option value="color">Color</option>
                                                   <option value="size">Size</option>
                                                   <option value="custom">Custom</option>
                                                </select>
                                                <button type="button" aria-label={`Remove attribute ${attr.name || ""}`.trim()} title="Remove attribute" onClick={()=>{ setFormData(prev=>({...prev,attributes:(prev.attributes||[]).filter((_,i)=>i!==aIdx)})); setAttrValueDrafts({}); }} className="hover:text-red-700" style={{ ...iconBtnStyle, marginLeft: "auto" }}><X className="w-4 h-4" aria-hidden="true" /></button>
                                             </div>
                                             <div>
                                                {(attr.values||[]).map((val,vIdx)=>{
                                                    const swatchType = val.swatchType || "color";
                                                    const vid = `attr-${aIdx}-val-${vIdx}`;
                                                    return (
                                                    <div key={vIdx} className="flex flex-wrap items-start gap-3" style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f1" }}>
                                                       {/* Swatch Config — only for color attributes */}
                                                       {attr.type==="color" && (
                                                          <div className="flex flex-col gap-2 shrink-0 min-w-0 max-w-full">
                                                             {/* Toggle between Color Picker and Image Swatch */}
                                                             <div className="wp-seg" role="group" aria-label="Swatch type">
                                                                <button
                                                                   type="button"
                                                                   aria-pressed={swatchType==="color"}
                                                                   onClick={()=>updateVal(vIdx,"swatchType","color")}
                                                                   title="Use a solid color swatch"
                                                                >
                                                                   Color
                                                                </button>
                                                                <button
                                                                   type="button"
                                                                   aria-pressed={swatchType==="image"}
                                                                   onClick={()=>updateVal(vIdx,"swatchType","image")}
                                                                   title="Use an image as the swatch (texture, pattern, etc.)"
                                                                >
                                                                   Image
                                                                </button>
                                                             </div>
                                                             {/* Swatch preview + picker */}
                                                             {swatchType==="color" ? (
                                                                <div className="flex flex-col gap-2 min-w-0 max-w-full" style={{ background: "#f6f7f7", border: "1px solid #dcdcde", padding: 8 }}>
                                                                   <div className="flex items-center gap-3">
                                                                      {/* Final preview bubble */}
                                                                      <div
                                                                         className="w-9 h-9 rounded-full shrink-0"
                                                                         style={{
                                                                            background: getSwatchBackground(val),
                                                                            backgroundSize: "cover",
                                                                            border: "2px solid #fff",
                                                                            boxShadow: "0 0 0 1px #c3c4c7"
                                                                         }}
                                                                         title="Combined Swatch Preview"
                                                                         aria-hidden="true"
                                                                      />
                                                                      {/* Controls */}
                                                                      <div className="flex flex-col gap-1">
                                                                         <div className="flex items-center gap-2">
                                                                            <label htmlFor={`${vid}-mode`} className="wp-small wp-muted" style={{ width: 52 }}>Mode</label>
                                                                            <select
                                                                               id={`${vid}-mode`}
                                                                               value={val.colorMode || "single"}
                                                                               onChange={e=>updateVal(vIdx,"colorMode",e.target.value)}
                                                                               className="wp-select"
                                                                            >
                                                                               <option value="single">Single</option>
                                                                               <option value="dual">Dual</option>
                                                                               <option value="triple">Triple</option>
                                                                               <option value="quad">Quad</option>
                                                                            </select>
                                                                         </div>
                                                                         <div className="flex items-center gap-2">
                                                                            <label htmlFor={`${vid}-texture`} className="wp-small wp-muted" style={{ width: 52 }}>Texture</label>
                                                                            <select
                                                                               id={`${vid}-texture`}
                                                                               value={val.texture || ""}
                                                                               onChange={e=>updateVal(vIdx,"texture",e.target.value)}
                                                                               className="wp-select"
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
                                                                   <div className="flex items-center gap-2 flex-wrap">
                                                                      <span className="wp-small wp-muted">Colors</span>
                                                                      {/* Color 1 */}
                                                                      <div className="relative flex items-center justify-center">
                                                                         <div className="w-6 h-6 rounded-full cursor-pointer shrink-0" style={{ backgroundColor: val.hex || "#000000", border: "1px solid #8c8f94" }} title="Color 1" aria-hidden="true" />
                                                                         <input type="color" aria-label="Color 1" value={val.hex || "#000000"} onChange={e=>updateVal(vIdx,"hex",e.target.value)} className="w-6 h-6 opacity-0 absolute inset-0 cursor-pointer" />
                                                                      </div>

                                                                      {/* Color 2 */}
                                                                      {(val.colorMode === "dual" || val.colorMode === "triple" || val.colorMode === "quad") && (
                                                                         <div className="relative flex items-center justify-center">
                                                                            <div className="w-6 h-6 rounded-full cursor-pointer shrink-0" style={{ backgroundColor: val.hex2 || "#ffffff", border: "1px solid #8c8f94" }} title="Color 2" aria-hidden="true" />
                                                                            <input type="color" aria-label="Color 2" value={val.hex2 || "#ffffff"} onChange={e=>updateVal(vIdx,"hex2",e.target.value)} className="w-6 h-6 opacity-0 absolute inset-0 cursor-pointer" />
                                                                         </div>
                                                                      )}

                                                                      {/* Color 3 */}
                                                                      {(val.colorMode === "triple" || val.colorMode === "quad") && (
                                                                         <div className="relative flex items-center justify-center">
                                                                            <div className="w-6 h-6 rounded-full cursor-pointer shrink-0" style={{ backgroundColor: val.hex3 || "#ffffff", border: "1px solid #8c8f94" }} title="Color 3" aria-hidden="true" />
                                                                            <input type="color" aria-label="Color 3" value={val.hex3 || "#ffffff"} onChange={e=>updateVal(vIdx,"hex3",e.target.value)} className="w-6 h-6 opacity-0 absolute inset-0 cursor-pointer" />
                                                                         </div>
                                                                      )}

                                                                      {/* Color 4 */}
                                                                      {(val.colorMode === "quad") && (
                                                                         <div className="relative flex items-center justify-center">
                                                                            <div className="w-6 h-6 rounded-full cursor-pointer shrink-0" style={{ backgroundColor: val.hex4 || "#ffffff", border: "1px solid #8c8f94" }} title="Color 4" aria-hidden="true" />
                                                                            <input type="color" aria-label="Color 4" value={val.hex4 || "#ffffff"} onChange={e=>updateVal(vIdx,"hex4",e.target.value)} className="w-6 h-6 opacity-0 absolute inset-0 cursor-pointer" />
                                                                         </div>
                                                                      )}
                                                                   </div>
                                                                </div>
                                                             ) : (
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                   {val.image ? (
                                                                      <img src={val.image} alt="swatch" className="w-8 h-8 rounded-full object-cover" style={{ border: "1px solid #c3c4c7" }} />
                                                                   ) : (
                                                                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: "2px dashed #c3c4c7", background: "#f6f7f7" }} aria-hidden="true">
                                                                         <ImageIcon className="w-3.5 h-3.5 wp-muted" />
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
                                                       <div className="flex-1 min-w-[140px]">
                                                          <label htmlFor={`${vid}-label`} className="sr-only">Value label</label>
                                                          <input id={`${vid}-label`} className="wp-input wp-full" placeholder="Label" value={val.label} onChange={e=>updateVal(vIdx,"label",e.target.value)} />
                                                       </div>
                                                       {/* Variant product image (separate from swatch) */}
                                                       <div className="flex items-center gap-2 shrink-0">
                                                          <span className="wp-small wp-muted">Product image</span>
                                                          <InlinePick value={val.variantImage} onChange={url=>updateVal(vIdx,"variantImage",url)} label="+ Image" />
                                                       </div>
                                                       <button type="button" aria-label={`Remove value ${val.label || ""}`.trim()} title="Remove value" onClick={()=>removeVal(vIdx)} className="hover:text-red-700 shrink-0" style={iconBtnStyle}><X className="w-4 h-4" aria-hidden="true" /></button>
                                                    </div>
                                                 );})}
                                             </div>
                                             <div style={{ padding: "8px 12px" }}>
                                                <label htmlFor={`attr-${aIdx}-add`} className="sr-only">Add value to {attr.name || "attribute"}</label>
                                                <input id={`attr-${aIdx}-add`} className="wp-input wp-full" placeholder="Add value... (press Enter)" value={attrValueDrafts[aIdx] || ""} onChange={e=>{ const v=e.target.value; setAttrValueDrafts(prev=>({...prev,[aIdx]:v})); }} onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addAttributeValue(aIdx,(attrValueDrafts[aIdx]||"").trim()); setAttrValueDrafts(prev=>({...prev,[aIdx]:""})); } }} />
                                             </div>
                                          </div>
                                       );
                                    })}

                                    <div style={{ paddingTop: 12, borderTop: "1px solid #f0f0f1" }}>
                                       <button type="button" onClick={generateCombinations} className="wp-btn">Generate All Combinations</button>
                                       {formData.variantCombinations?.length > 0 && (
                                          <div className="wp-table-box" style={{ marginTop: 14 }}>
                                             <table className="wp-list-table" style={{ minWidth: 480 }}>
                                                <thead>
                                                   <tr>
                                                      <th style={{ width: 90 }}>Image</th>
                                                      <th>Variant</th>
                                                      <th style={{ width: 140 }}>Regular price ($)</th>
                                                      <th style={{ width: 140 }}>Sale price ($)</th>
                                                      <th style={{ width: 44 }}><span className="sr-only">Actions</span></th>
                                                   </tr>
                                                </thead>
                                                <tbody>
                                                   {formData.variantCombinations.map((comb, cIdx) => (
                                                      <tr key={cIdx}>
                                                         <td><InlinePick value={comb.image} onChange={url=>setFormData(prev=>({...prev,variantCombinations:(prev.variantCombinations||[]).map((c,i)=>i===cIdx?{...c,image:url}:c)}))} /></td>
                                                         <td className="wp-strong">{comb.title}</td>
                                                         <td>
                                                            <input
                                                               type="number"
                                                               min="0"
                                                               step="0.01"
                                                               inputMode="decimal"
                                                               aria-label={`Regular price for ${comb.title}`}
                                                               className="wp-input wp-full"
                                                               placeholder="e.g. 0.00"
                                                               value={comb.compareAtPrice !== undefined && comb.compareAtPrice !== null ? comb.compareAtPrice : ""}
                                                               onChange={(e) => {
                                                                  const v = e.target.value === "" ? "" : Number(e.target.value);
                                                                  setFormData(prev => ({ ...prev, variantCombinations: (prev.variantCombinations || []).map((c, i) => i === cIdx ? { ...c, compareAtPrice: v } : c) }));
                                                               }}
                                                            />
                                                         </td>
                                                         <td>
                                                            <input
                                                               type="number"
                                                               min="0"
                                                               step="0.01"
                                                               inputMode="decimal"
                                                               aria-label={`Sale price for ${comb.title}`}
                                                               className="wp-input wp-full"
                                                               placeholder="e.g. 0.00"
                                                               value={comb.price !== undefined && comb.price !== null ? comb.price : ""}
                                                               onChange={(e) => {
                                                                  const v = e.target.value === "" ? "" : Number(e.target.value);
                                                                  setFormData(prev => ({ ...prev, variantCombinations: (prev.variantCombinations || []).map((c, i) => i === cIdx ? { ...c, price: v } : c) }));
                                                               }}
                                                            />
                                                         </td>
                                                         <td><button type="button" aria-label={`Remove variant ${comb.title}`} title="Remove variant" className="hover:text-red-700" style={iconBtnStyle} onClick={()=>setFormData(prev => ({...prev,variantCombinations:prev.variantCombinations.filter((_,i)=>i!==cIdx)}))}><X className="w-4 h-4" aria-hidden="true" /></button></td>
                                                      </tr>
                                                   ))}
                                                </tbody>
                                             </table>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              )}

                              {activeTab === "gifting" && (
                                 <div>
                                    <div className="flex flex-wrap items-start justify-between gap-2" style={{ margin: "6px 0 10px" }}>
                                       <div className="min-w-0" style={{ flex: "1 1 240px" }}>
                                          <h3 className="wp-strong" style={{ fontSize: 14, margin: 0 }}>Gifting items</h3>
                                          <p className="wp-desc">Customers pick from these. Each selected item adds its price to the product price and asks for a logo upload.</p>
                                       </div>
                                       <button
                                          type="button"
                                          onClick={() => setFormData(prev => ({
                                             ...prev,
                                             corporateGifting: {
                                                ...(prev.corporateGifting || {}),
                                                items: [...(prev.corporateGifting?.items || []), { name: "", description: "", image: "", priceDelta: "", active: true, _localKey: Date.now() + Math.random() }],
                                             },
                                          }))}
                                          className="wp-btn"
                                       >
                                          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add Item
                                       </button>
                                    </div>

                                    <div className="wp-frow" style={{ marginBottom: 10 }}>
                                       <label htmlFor="gifting-min-selections" className="wp-flabel">Minimum items a customer must select</label>
                                       <input
                                          id="gifting-min-selections"
                                          type="number"
                                          min="1"
                                          className="wp-input"
                                          style={{ maxWidth: 120 }}
                                          value={formData.corporateGifting?.minSelections ?? 3}
                                          onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, corporateGifting: { ...(prev.corporateGifting || {}), minSelections: v } })); }}
                                       />
                                    </div>

                                    {(formData.corporateGifting?.items || []).length === 0 ? (
                                       <p className="wp-muted text-center" style={{ padding: "24px 12px", border: "1px dashed #c3c4c7" }}>No items yet — add at least {Number(formData.corporateGifting?.minSelections) || 3} so customers can meet the minimum.</p>
                                    ) : (
                                       <div>
                                          {(formData.corporateGifting?.items || []).length < (Number(formData.corporateGifting?.minSelections) || 3) && (
                                             <div className="wp-notice wp-notice-warning"><p>Only {(formData.corporateGifting?.items || []).length} item(s) but the minimum is {Number(formData.corporateGifting?.minSelections) || 3} — customers won&apos;t be able to order until there are enough items.</p></div>
                                          )}
                                          {(formData.corporateGifting?.items || []).map((item, idx) => {
                                             const updateItem = (patch) => setFormData(prev => ({
                                                ...prev,
                                                corporateGifting: {
                                                   ...(prev.corporateGifting || {}),
                                                   items: (prev.corporateGifting?.items || []).map((it, i) => (i === idx ? { ...it, ...patch } : it)),
                                                },
                                             }));
                                             return (
                                                <div key={item._id || item._localKey || idx} className="flex flex-col sm:flex-row gap-3" style={{ ...subBoxStyle, padding: 12, marginBottom: 10 }}>
                                                   <div className="shrink-0 flex sm:flex-col items-center gap-2">
                                                      <div className="wp-thumb" style={{ width: 64, height: 64 }}>
                                                         {item.image ? <img src={item.image} alt={item.name} /> : <ImageIcon className="w-5 h-5 wp-muted" aria-hidden="true" />}
                                                      </div>
                                                      <InlinePick value={item.image} onChange={(url) => updateItem({ image: url })} label="+ Picture" doneLabel="✓ Change" title="Pick item picture" />
                                                   </div>
                                                   <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                                                      <div className="min-w-0">
                                                         <label htmlFor={`gift-${idx}-name`} className="wp-label wp-small">Item name</label>
                                                         <input
                                                            id={`gift-${idx}-name`}
                                                            placeholder="Item name (e.g. Belt)"
                                                            className="wp-input wp-full"
                                                            value={item.name || ""}
                                                            onChange={(e) => updateItem({ name: e.target.value })}
                                                         />
                                                      </div>
                                                      <div className="min-w-0">
                                                         <label htmlFor={`gift-${idx}-price`} className="wp-label wp-small">Price increase (+ $)</label>
                                                         <input
                                                            id={`gift-${idx}-price`}
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="Price increase"
                                                            className="wp-input wp-full"
                                                            value={item.priceDelta ?? ""}
                                                            onChange={(e) => updateItem({ priceDelta: e.target.value })}
                                                         />
                                                      </div>
                                                      <div className="sm:col-span-2 min-w-0">
                                                         <label htmlFor={`gift-${idx}-desc`} className="wp-label wp-small">Description</label>
                                                         <input
                                                            id={`gift-${idx}-desc`}
                                                            placeholder="Short description shown to the customer"
                                                            className="wp-input wp-full"
                                                            value={item.description || ""}
                                                            onChange={(e) => updateItem({ description: e.target.value })}
                                                         />
                                                      </div>
                                                   </div>
                                                   <div className="shrink-0 flex sm:flex-col items-center justify-between gap-2">
                                                      <label className="wp-check">
                                                         <input type="checkbox" checked={item.active !== false} onChange={(e) => updateItem({ active: e.target.checked })} />
                                                         Active
                                                      </label>
                                                      <button
                                                         type="button"
                                                         onClick={() => setFormData(prev => ({
                                                            ...prev,
                                                            corporateGifting: {
                                                               ...(prev.corporateGifting || {}),
                                                               items: (prev.corporateGifting?.items || []).filter((_, i) => i !== idx),
                                                            },
                                                         }))}
                                                         className="hover:text-red-700"
                                                         style={iconBtnStyle}
                                                         aria-label="Remove item"
                                                         title="Remove item"
                                                      >
                                                         <X className="w-4 h-4" aria-hidden="true" />
                                                      </button>
                                                   </div>
                                                </div>
                                             );
                                          })}
                                       </div>
                                    )}
                                 </div>
                              )}

                              {activeTab === "stats" && (
                                 <div>
                                    <div style={{ margin: "6px 0 12px" }}>
                                       <button type="button" onClick={() => setFormData(prev => ({ ...prev, stats: [...(prev.stats || []), { label: "", value: "", icon: "Shield" }] }))} className="wp-btn">+ Add Stat</button>
                                    </div>
                                    {(formData.stats || []).map((stat, sIdx) => (
                                       <div key={sIdx} className="flex flex-wrap items-end gap-2" style={{ ...subBoxStyle, padding: 10, marginBottom: 10 }}>
                                          <div className="flex-1 min-w-[120px]">
                                             <label htmlFor={`stat-${sIdx}-label`} className="wp-label wp-small">Label</label>
                                             <input id={`stat-${sIdx}-label`} className="wp-input wp-full" placeholder="Label" value={stat.label} onChange={e=>{ const v=e.target.value; setFormData(prev=>({...prev,stats:(prev.stats||[]).map((x,i)=>i===sIdx?{...x,label:v}:x)})); }} />
                                          </div>
                                          <div className="flex-1 min-w-[120px]">
                                             <label htmlFor={`stat-${sIdx}-value`} className="wp-label wp-small">Value</label>
                                             <input id={`stat-${sIdx}-value`} className="wp-input wp-full" placeholder="Value" value={stat.value} onChange={e=>{ const v=e.target.value; setFormData(prev=>({...prev,stats:(prev.stats||[]).map((x,i)=>i===sIdx?{...x,value:v}:x)})); }} />
                                          </div>
                                          <button type="button" aria-label="Remove stat" title="Remove stat" className="hover:text-red-700" style={iconBtnStyle} onClick={()=>setFormData(prev => ({...prev,stats:prev.stats.filter((_,i)=>i!==sIdx)}))}><X className="w-4 h-4" aria-hidden="true" /></button>
                                       </div>
                                    ))}
                                 </div>
                              )}

                              {activeTab === "faqs" && (
                                 <div>
                                    <div style={{ margin: "6px 0 12px" }}>
                                       <button type="button" onClick={() => setFormData(prev => ({ ...prev, faqs: [...(prev.faqs || []), { question: "", answer: "" }] }))} className="wp-btn">+ Add FAQ</button>
                                    </div>
                                    {(formData.faqs || []).map((faq, fIdx) => (
                                       <div key={fIdx} style={{ ...subBoxStyle, padding: 12, marginBottom: 10 }}>
                                          <div className="wp-field">
                                             <label htmlFor={`faq-${fIdx}-q`} className="wp-label">Question</label>
                                             <input id={`faq-${fIdx}-q`} className="wp-input wp-full" placeholder="Question" value={faq.question} onChange={e=>{ const v=e.target.value; setFormData(prev=>({...prev,faqs:(prev.faqs||[]).map((x,i)=>i===fIdx?{...x,question:v}:x)})); }} />
                                          </div>
                                          <div className="wp-field">
                                             <label htmlFor={`faq-${fIdx}-a`} className="wp-label">Answer</label>
                                             <textarea id={`faq-${fIdx}-a`} className="wp-textarea" placeholder="Answer" rows={2} value={faq.answer} onChange={e=>{ const v=e.target.value; setFormData(prev=>({...prev,faqs:(prev.faqs||[]).map((x,i)=>i===fIdx?{...x,answer:v}:x)})); }} />
                                          </div>
                                          <button type="button" onClick={()=>setFormData(prev => ({...prev,faqs:prev.faqs.filter((_,i)=>i!==fIdx)}))} style={dangerLinkStyle}>Remove</button>
                                       </div>
                                    ))}
                                 </div>
                              )}

                               {activeTab === "sizeguide" && (
                                   <div>
                                      <div style={{ maxWidth: 560, margin: "6px 0 16px" }}>
                                         <h3 className="wp-strong" style={{ fontSize: 14, margin: "0 0 10px" }}>Size chart configuration</h3>

                                         {/* Size Chart Source */}
                                         <div className="wp-field">
                                            <label htmlFor="size-chart-source-select" className="wp-label">Size chart source</label>
                                            <select
                                               id="size-chart-source-select"
                                               className="wp-select wp-full"
                                               value={formData.sizeChartSource || "category_default"}
                                               onChange={(e) => {
                                                  const val = e.target.value;
                                                  setFormData(prev => ({
                                                     ...prev,
                                                     sizeChartSource: val,
                                                     sizeGuide: {
                                                        ...(prev.sizeGuide || {}),
                                                        enabled: val === "product_custom"
                                                     }
                                                  }));
                                               }}
                                            >
                                               <option value="category_default">Use Category Default</option>
                                               <option value="custom">Select Reusable Size Chart</option>
                                               <option value="product_custom">Create Custom Size Chart for this Product</option>
                                               <option value="none">No Size Chart (Disabled)</option>
                                            </select>
                                            <p className="wp-desc">
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
                                            <div className="wp-field">
                                               <label htmlFor="size-chart-select" className="wp-label">Select reusable size chart</label>
                                               <select
                                                  id="size-chart-select"
                                                  className="wp-select wp-full"
                                                  value={formData.sizeChart || ""}
                                                  onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, sizeChart: v })); }}
                                               >
                                                  <option value="">-- Choose Size Chart --</option>
                                                  {sizeCharts.map((sc) => (
                                                     <option key={sc._id} value={sc._id}>
                                                        {sc.label}
                                                     </option>
                                                  ))}
                                               </select>
                                               {sizeCharts.length === 0 && (
                                                  <p className="wp-desc" style={{ color: "#b32d2e" }}>
                                                     No published size charts found. <a href="/admin/products/size-charts/new" className="wp-link" style={{ textDecoration: "underline" }} target="_blank" rel="noopener noreferrer">Create one here</a>
                                                  </p>
                                               )}
                                            </div>
                                         )}
                                      </div>

                                      {/* Inline Custom Size Chart Editor (only shown if sizeChartSource is product_custom) */}
                                      {formData.sizeChartSource === "product_custom" && (
                                         <div>
                                            {/* Size Name & Video */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
                                               <div className="min-w-0">
                                                  <label htmlFor="size-guide-size-name" className="wp-label">Size column name</label>
                                                  <input
                                                     id="size-guide-size-name"
                                                     className="wp-input wp-full"
                                                     placeholder="e.g. Jacket Size, Waist Size, Dress Size"
                                                     value={formData.sizeGuide?.sizeName || ""}
                                                     onChange={(e) => { const v = e.target.value; setFormData(prev => ({
                                                        ...prev,
                                                        sizeGuide: {
                                                           ...(prev.sizeGuide || {}),
                                                           sizeName: v
                                                        }
                                                     })); }}
                                                  />
                                                  <p className="wp-desc">Label shown as the first column header in the size table (e.g. &quot;Jacket Size&quot;).</p>
                                               </div>
                                               <div className="min-w-0">
                                                  <label htmlFor="size-guide-video-url" className="wp-label">YouTube video link</label>
                                                  <input
                                                     id="size-guide-video-url"
                                                     className="wp-input wp-full"
                                                     placeholder="e.g. https://www.youtube.com/watch?v=ipyhV51zUWk"
                                                     value={formData.sizeGuide?.videoUrl || ""}
                                                     onChange={(e) => { const v = e.target.value; setFormData(prev => ({
                                                        ...prev,
                                                        sizeGuide: {
                                                           ...(prev.sizeGuide || {}),
                                                           videoUrl: v
                                                        }
                                                     })); }}
                                                  />
                                                  <p className="wp-desc">URL to instructions video (YouTube embed/watch link).</p>
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
                                                  setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), columnsCm: cols } }));
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
                                                  <div style={subBoxStyle}>
                                                     <div style={subHeadStyle}>
                                                        <h4 className="wp-strong" style={{ fontSize: 14, margin: 0, flex: 1 }}>Size chart (CM)</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                           <button type="button" onClick={addColCm}
                                                              className="wp-btn">
                                                              + Add Column
                                                           </button>
                                                           <button type="button"
                                                              onClick={() => {
                                                                 const emptyRow = {};
                                                                 colsCm.forEach(c => { emptyRow[c.key] = ""; });
                                                                 setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), sizesCm: [...(prev.sizeGuide?.sizesCm || []), emptyRow] } }));
                                                              }}
                                                              className="wp-btn wp-btn-primary">
                                                              + Add Row
                                                           </button>
                                                        </div>
                                                     </div>
                                                     <div className="overflow-x-auto max-w-full">
                                                        <table className="wp-list-table" style={{ minWidth: 420 }}>
                                                           <thead>
                                                              <tr>
                                                                 {colsCm.map((col, cIdx) => (
                                                                    <th key={col.key} style={{ padding: 6 }}>
                                                                       <div className="flex items-center gap-1">
                                                                          <input
                                                                             aria-label={`Column ${cIdx + 1} name`}
                                                                             className="wp-input wp-full wp-strong"
                                                                             style={{ minWidth: 70 }}
                                                                             value={col.label}
                                                                             onChange={(e) => renameColCm(cIdx, e.target.value)}
                                                                          />
                                                                          {colsCm.length > 1 && (
                                                                             <button type="button" onClick={() => removeColCm(cIdx)}
                                                                                aria-label={`Remove column ${col.label}`}
                                                                                title="Remove column"
                                                                                className="hover:text-red-700 flex-shrink-0"
                                                                                style={{ ...iconBtnStyle, minWidth: 24 }}>
                                                                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                                                                             </button>
                                                                          )}
                                                                       </div>
                                                                    </th>
                                                                 ))}
                                                                 <th style={{ width: 40, padding: 6 }}><span className="sr-only">Actions</span></th>
                                                              </tr>
                                                           </thead>
                                                           <tbody>
                                                              {(formData.sizeGuide?.sizesCm || []).map((row, rIdx) => (
                                                                 <tr key={rIdx}>
                                                                    {colsCm.map(col => (
                                                                       <td key={col.key} style={{ padding: 6 }}>
                                                                          <input
                                                                             aria-label={`${col.label}, row ${rIdx + 1}`}
                                                                             className="wp-input wp-full"
                                                                             value={row[col.key] || ""}
                                                                             onChange={(e) => {
                                                                                const v = e.target.value;
                                                                                setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), sizesCm: (prev.sizeGuide?.sizesCm || []).map((r, i) => i === rIdx ? { ...r, [col.key]: v } : r) } }));
                                                                             }}
                                                                          />
                                                                       </td>
                                                                    ))}
                                                                    <td style={{ padding: 6, textAlign: "center" }}>
                                                                       <button type="button" aria-label={`Remove row ${rIdx + 1}`} title="Remove row" className="hover:text-red-700" style={iconBtnStyle} onClick={() => {
                                                                          setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), sizesCm: (prev.sizeGuide?.sizesCm || []).filter((_, i) => i !== rIdx) } }));
                                                                       }}><X className="w-4 h-4" aria-hidden="true" /></button>
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
                                                  setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), columnsIn: cols } }));
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
                                                  <div style={subBoxStyle}>
                                                     <div style={subHeadStyle}>
                                                        <h4 className="wp-strong" style={{ fontSize: 14, margin: 0, flex: 1 }}>Size chart (INCHES)</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                           <button type="button" onClick={addColIn}
                                                              className="wp-btn">
                                                              + Add Column
                                                           </button>
                                                           <button type="button"
                                                              onClick={() => {
                                                                 const emptyRow = {};
                                                                 colsIn.forEach(c => { emptyRow[c.key] = ""; });
                                                                 setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), sizesIn: [...(prev.sizeGuide?.sizesIn || []), emptyRow] } }));
                                                              }}
                                                              className="wp-btn wp-btn-primary">
                                                              + Add Row
                                                           </button>
                                                        </div>
                                                     </div>
                                                     <div className="overflow-x-auto max-w-full">
                                                        <table className="wp-list-table" style={{ minWidth: 420 }}>
                                                           <thead>
                                                              <tr>
                                                                 {colsIn.map((col, cIdx) => (
                                                                    <th key={col.key} style={{ padding: 6 }}>
                                                                       <div className="flex items-center gap-1">
                                                                          <input
                                                                             aria-label={`Column ${cIdx + 1} name`}
                                                                             className="wp-input wp-full wp-strong"
                                                                             style={{ minWidth: 70 }}
                                                                             value={col.label}
                                                                             onChange={(e) => renameColIn(cIdx, e.target.value)}
                                                                          />
                                                                          {colsIn.length > 1 && (
                                                                             <button type="button" onClick={() => removeColIn(cIdx)}
                                                                                aria-label={`Remove column ${col.label}`}
                                                                                title="Remove column"
                                                                                className="hover:text-red-700 flex-shrink-0"
                                                                                style={{ ...iconBtnStyle, minWidth: 24 }}>
                                                                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                                                                             </button>
                                                                          )}
                                                                       </div>
                                                                    </th>
                                                                 ))}
                                                                 <th style={{ width: 40, padding: 6 }}><span className="sr-only">Actions</span></th>
                                                              </tr>
                                                           </thead>
                                                           <tbody>
                                                              {(formData.sizeGuide?.sizesIn || []).map((row, rIdx) => (
                                                                 <tr key={rIdx}>
                                                                    {colsIn.map(col => (
                                                                       <td key={col.key} style={{ padding: 6 }}>
                                                                          <input
                                                                             aria-label={`${col.label}, row ${rIdx + 1}`}
                                                                             className="wp-input wp-full"
                                                                             value={row[col.key] || ""}
                                                                             onChange={(e) => {
                                                                                const v = e.target.value;
                                                                                setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), sizesIn: (prev.sizeGuide?.sizesIn || []).map((r, i) => i === rIdx ? { ...r, [col.key]: v } : r) } }));
                                                                             }}
                                                                          />
                                                                       </td>
                                                                    ))}
                                                                    <td style={{ padding: 6, textAlign: "center" }}>
                                                                       <button type="button" aria-label={`Remove row ${rIdx + 1}`} title="Remove row" className="hover:text-red-700" style={iconBtnStyle} onClick={() => {
                                                                          setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), sizesIn: (prev.sizeGuide?.sizesIn || []).filter((_, i) => i !== rIdx) } }));
                                                                       }}><X className="w-4 h-4" aria-hidden="true" /></button>
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
                                            <div style={subBoxStyle}>
                                               <div style={subHeadStyle}>
                                                  <h4 className="wp-strong" style={{ fontSize: 14, margin: 0, flex: 1 }}>How to measure instructions</h4>
                                                  <button type="button"
                                                     onClick={() => {
                                                        setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), instructions: [...(prev.sizeGuide?.instructions || []), { title: "", desc: "" }] } }));
                                                     }}
                                                     className="wp-btn wp-btn-primary">
                                                     + Add Instruction
                                                  </button>
                                               </div>
                                               <div style={{ padding: 12 }}>
                                                  {(formData.sizeGuide?.instructions || []).map((row, rIdx) => {
                                                     const updateRow = (key, val) => {
                                                        setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), instructions: (prev.sizeGuide?.instructions || []).map((r, i) => i === rIdx ? { ...r, [key]: val } : r) } }));
                                                     };
                                                     return (
                                                        <div key={rIdx} className="flex gap-3 items-start" style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f1" }}>
                                                           <div className="flex-1 min-w-0 flex flex-col gap-2">
                                                              <label htmlFor={`instr-${rIdx}-title`} className="sr-only">Instruction {rIdx + 1} title</label>
                                                              <input
                                                                 id={`instr-${rIdx}-title`}
                                                                 className="wp-input wp-full wp-strong"
                                                                 placeholder="e.g. Sleeve Length"
                                                                 value={row.title}
                                                                 onChange={(e) => updateRow("title", e.target.value)}
                                                              />
                                                              <label htmlFor={`instr-${rIdx}-desc`} className="sr-only">Instruction {rIdx + 1} text</label>
                                                              <textarea
                                                                 id={`instr-${rIdx}-desc`}
                                                                 className="wp-textarea"
                                                                 style={{ resize: "none" }}
                                                                 placeholder="Instruction text..."
                                                                 rows={2}
                                                                 value={row.desc}
                                                                 onChange={(e) => updateRow("desc", e.target.value)}
                                                              />
                                                           </div>
                                                           <button
                                                              type="button"
                                                              onClick={() => {
                                                                 setFormData(prev => ({ ...prev, sizeGuide: { ...(prev.sizeGuide || {}), instructions: (prev.sizeGuide?.instructions || []).filter((_, idx) => idx !== rIdx) } }));
                                                              }}
                                                              aria-label={`Remove instruction ${rIdx + 1}`}
                                                              title="Remove instruction"
                                                              className="hover:text-red-700 shrink-0"
                                                              style={iconBtnStyle}
                                                           >
                                                              <X className="w-4 h-4" aria-hidden="true" />
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
                     </section>
                  </>
               ) : (
                  <SEOConfigPanel
                     seo={formData.seo || {}}
                     onChange={newSeo => setFormData(prev => ({ ...prev, seo: newSeo }))}
                     parentTitle={formData.name}
                     parentDescription={formData.shortDescription || formData.description}
                     parentSlug={formData.slug}
                     parentImage={formData.images?.[0] || ""}
                     parentType="product"
                  />
               )}
               </div>

               {/* Short Description (always mounted, independent of the Content/SEO tabs) */}
               <div>
                  <Postbox title="Product short description" id="pf-short-desc">
                     <TiptapEditor
                        content={formData.shortDescription}
                        onChange={(html) => setFormData(prev => ({ ...prev, shortDescription: html }))}
                     />
                     <p className="wp-desc">Supports bold, italic, lists, and links. Displays as a rich excerpt on the product page.</p>
                  </Postbox>
               </div>
            </div>

            {/* Sidebar */}
            <div className="wp-col-side">
               <section className="wp-postbox" aria-labelledby="pf-publish-title">
                  <div className="wp-postbox-head"><h2 id="pf-publish-title">Publish</h2></div>
                  <div className="flex flex-wrap justify-between items-center gap-2" style={{ padding: "10px 12px 2px" }}>
                     <button type="button" disabled={saving} onClick={(e) => handleSubmit(e, { asDraft: true })} className="wp-btn">Save Draft</button>
                     <button type="button" onClick={() => previewUrl && window.open(previewUrl, '_blank')} className="wp-btn" title={previewUrl ? `Preview ${previewUrl}` : 'Save first to preview'}>Preview</button>
                  </div>
                  <div className="wp-misc">
                     <div className="wp-misc-row">
                        <label htmlFor="product-status-select" className="wp-muted">Status:</label>
                        <strong className="wp-strong">{formData.status}</strong>
                        <select
                           id="product-status-select"
                           className="wp-select"
                           style={{ marginLeft: "auto" }}
                           value={formData.status}
                           onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, status: v })); }}
                        >
                           <option value="Draft">Draft</option>
                           <option value="Published">Published</option>
                        </select>
                     </div>
                     <div className="wp-misc-row">
                        <span className="wp-muted">Visibility:</span> <strong className="wp-strong">Public</strong>
                     </div>
                     <div className="wp-misc-row">
                        <label htmlFor="isFeatured" className="wp-check">
                           <input
                              type="checkbox"
                              id="isFeatured"
                              checked={formData.isFeatured}
                              onChange={(e) => { const v = e.target.checked; setFormData(prev => ({ ...prev, isFeatured: v })); }}
                           />
                           <span>Featured product</span>
                        </label>
                     </div>
                  </div>
                  <div className="wp-box-foot">
                     {productId && !formData.isDeleted && <button type="button" onClick={handleTrash} style={dangerLinkStyle}>Move to Trash</button>}
                     <span className="wp-spacer" />
                     <button type="submit" disabled={saving} className="wp-btn wp-btn-primary" style={{ minHeight: 36 }}>
                        {saving ? "Saving..." : (productId ? "Update" : "Publish")}
                     </button>
                  </div>
               </section>

               <Postbox
                  title="Product categories"
                  id="pf-categories"
                  aside={<button type="button" onClick={() => router.push("/admin/categories")} className="wp-link" style={linkBtnStyle}>Manage</button>}
               >
                  {categories.length === 0 ? (
                     <p className="wp-muted">No categories found.</p>
                  ) : (
                     <div className="wp-checklist" role="group" aria-labelledby="pf-categories-title">
                        {categories.map(cat => (
                           <label key={cat._id} className="wp-check">
                              <input
                                 type="checkbox"
                                 checked={(formData.categories || []).includes(cat._id)}
                                 onChange={e => {
                                    const checked = e.target.checked;
                                    setFormData(prev => ({ ...prev, categories: checked ? [...(prev.categories || []), cat._id] : (prev.categories || []).filter(id => id !== cat._id) }));
                                 }}
                              />
                              <span>{cat.name}</span>
                           </label>
                        ))}
                     </div>
                  )}
               </Postbox>

               <Postbox title="Product image" id="pf-image">
                  <MediaPicker value={formData.images[0]} onChange={url => setFormData(prev => ({ ...prev, images: [url, ...(prev.images?.slice(1) || [])] }))} />
               </Postbox>

               <Postbox title="Product gallery" id="pf-gallery">
                  <MediaPicker multiple value={formData.images.slice(1)} onChange={urls => setFormData(prev => ({ ...prev, images: [prev.images[0] || "", ...urls] }))} />
               </Postbox>
            </div>
         </form>
      </Page>
   );
}

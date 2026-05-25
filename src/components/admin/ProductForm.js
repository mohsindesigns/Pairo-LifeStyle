"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
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
   Check
} from "lucide-react";

const TiptapEditor = dynamic(() => import('./TiptapEditor'), { ssr: false });
import MediaPicker from "./MediaPicker";
import SEOConfigPanel from "./SEOConfigPanel";
import MediaPickerModal from "./MediaPickerModal";
import GallerySorter from "./GallerySorter";
import AdminPageLayout from "./AdminPageLayout";

// Tiny inline image button — opens MediaPickerModal without the full MediaPicker drop-zone UI
function InlinePick({ value, onChange }) {
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
            {value ? "✓ Change" : "+ Image"}
         </button>
         <MediaPickerModal
            open={open}
            onClose={() => setOpen(false)}
            onSelect={(sel) => { onChange(sel.url); setOpen(false); }}
            title="Pick variant image"
         />
      </>
   );
}

export default function ProductForm({ productId = null }) {
   const router = useRouter();
   const [loading, setLoading] = useState(productId ? true : false);
   const [saving, setSaving] = useState(false);
   const [activeTab, setActiveTab] = useState("general");
   const [activeFormTab, setActiveFormTab] = useState("content");
   const [categories, setCategories] = useState([]);

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
      attributes: [], // { name: "", type: "custom", values: [{ label: "", hex: "", image: "", value: "", variantImage: "" }] }
      variantCombinations: [], // { title: "", price: "", stock: "", sku: "", image: "" }
      stats: [],
      faqs: []
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

            if (productId) {
               const prodRes = await fetch(`/api/admin/products?id=${productId}`);
               if (!prodRes.ok) {
                  throw new Error("Failed to fetch product details.");
               }
               const prodData = await prodRes.json();
               setFormData({
                  ...prodData,
                  productType: prodData.productType || "simple",
                  images: prodData.images || [],
                  categories: prodData.categories || [],
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
                  shippingType: prodData.shippingType || "Express"
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

   const handleSubmit = async (e) => {
      if (e) e.preventDefault();
      setSaving(true);
      try {
         const payload = productId ? { ...formData, id: productId } : formData;
         const res = await fetch("/api/admin/products", {
            method: productId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
         });
         if (res.ok) {
            router.push("/admin/products");
         } else {
            const errData = await res.json().catch(() => ({}));
            alert(`Save failed: ${errData.error || res.statusText || "Unknown error"}`);
            console.error("[ProductForm] Save failed:", errData);
         }
      } catch (err) {
         alert(`Network error: ${err.message}`);
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
         image: "",
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
               { label: "Black", value: "Black", hex: "#000000", image: "", variantImage: "" },
               { label: "White", value: "White", hex: "#FFFFFF", image: "", variantImage: "" },
               { label: "Navy", value: "Navy", hex: "#000080", image: "", variantImage: "" },
               { label: "Gray", value: "Gray", hex: "#808080", image: "", variantImage: "" },
               { label: "Red", value: "Red", hex: "#FF0000", image: "", variantImage: "" }
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
                     className="w-full border border-[#c3c4c7] outline-none px-3 py-2 text-[20px] bg-white shadow-inner font-semibold post-title-input"
                     value={formData.name}
                     onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <div className="text-[12px] text-gray-500 px-1 mt-1 flex items-center gap-1">
                     Permalink: <span className="text-gray-400">pairo.store/product/</span>
                     <input className="border-none bg-transparent outline-none text-[#2271b1] font-mono w-fit min-w-[50px]" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
                  </div>
               </div>

               {/* Content / SEO Tabs */}
               <div className="flex border-b border-[#ccd0d4] gap-1 bg-[#f0f2f1] p-1 rounded w-fit">
                  <button
                     type="button"
                     onClick={() => setActiveFormTab("content")}
                     className={`px-4 py-1.5 text-[13px] font-bold transition-all rounded ${
                        activeFormTab === "content"
                           ? "bg-white text-[#2271b1] shadow-sm border border-[#ccd0d4]/60"
                           : "text-gray-600 hover:text-black hover:bg-[#f6f7f7]/50"
                     }`}
                  >
                     Content Editor
                  </button>
                  <button
                     type="button"
                     onClick={() => setActiveFormTab("seo")}
                     className={`px-4 py-1.5 text-[13px] font-bold transition-all rounded ${
                        activeFormTab === "seo"
                           ? "bg-white text-[#2271b1] shadow-sm border border-[#ccd0d4]/60"
                           : "text-gray-600 hover:text-black hover:bg-[#f6f7f7]/50"
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
                                 { id: "faqs", label: "FAQs", icon: HelpCircle }
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
                                    {formData.productType === "simple" && (
                                       <>
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
                                                <input className="w-full bg-transparent text-[14px] outline-none font-bold" placeholder="0.00" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
                                             </div>
                                          </div>
                                       </>
                                    )}
                                    <div className="flex items-center gap-6 py-2 border-b border-gray-50">
                                       <label className="text-[12px] font-bold text-gray-400 uppercase w-40">Shipping Type</label>
                                       <select className="flex-1 border border-gray-200 bg-gray-50/50 p-2 text-[14px] outline-none rounded-sm focus:border-[#2271b1]" value={formData.shippingType} onChange={(e) => setFormData({ ...formData, shippingType: e.target.value })}>
                                          <option value="Express">Express Shipping</option>
                                          <option value="Standard">Standard Shipping</option>
                                          <option value="Free">Free Shipping</option>
                                          <option value="Priority">Priority Mail</option>
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
                                          <input type="number" className="w-32 border border-gray-200 bg-gray-50/50 p-2 text-[14px] outline-none rounded-sm focus:border-[#2271b1]" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} />
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
                                                {(attr.values||[]).map((val,vIdx)=>(
                                                   <div key={vIdx} className="flex items-center gap-3 px-3 py-2">
                                                      {attr.type==="color" && <input type="color" value={val.hex} onChange={e=>updateVal(vIdx,"hex",e.target.value)} className="w-6 h-6 p-0 border-none rounded-full" />}
                                                      <input className="flex-1 border border-gray-200 rounded px-2 py-1 text-[12px]" value={val.label} onChange={e=>updateVal(vIdx,"label",e.target.value)} />
                                                      <InlinePick value={val.variantImage} onChange={url=>updateVal(vIdx,"variantImage",url)} />
                                                      <button type="button" onClick={()=>removeVal(vIdx)} className="text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                                   </div>
                                                ))}
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
                                                      <th className="px-4 py-3">IMG</th>
                                                      <th className="px-4 py-3">Variant</th>
                                                      <th className="px-4 py-3">Price</th>
                                                      <th className="px-4 py-3">Stock</th>
                                                      <th className="px-4 py-3"></th>
                                                   </tr>
                                                </thead>
                                                <tbody>
                                                   {formData.variantCombinations.map((comb, cIdx) => (
                                                      <tr key={cIdx} className="border-b border-gray-100">
                                                         <td className="px-4 py-2"><InlinePick value={comb.image} onChange={url=>{ const n=[...formData.variantCombinations]; n[cIdx].image=url; setFormData({...formData,variantCombinations:n}); }} /></td>
                                                         <td className="px-4 py-2 font-bold">{comb.title}</td>
                                                         <td className="px-4 py-2"><input className="w-20 border border-gray-200 p-1" type="number" value={comb.price} onChange={e=>{ const n=[...formData.variantCombinations]; n[cIdx].price=e.target.value; setFormData({...formData,variantCombinations:n}); }} /></td>
                                                         <td className="px-4 py-2"><input className="w-16 border border-gray-200 p-1" type="number" value={comb.stock} onChange={e=>{ const n=[...formData.variantCombinations]; n[cIdx].stock=e.target.value; setFormData({...formData,variantCombinations:n}); }} /></td>
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
                           </div>
                        </div>
                     </div>
                  </>
               ) : (
                  <div className="bg-white border border-[#c3c4c7] shadow-sm p-6">
                     <h2 className="text-[14px] font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2">SEO Configurations</h2>
                     <SEOConfigPanel
                        seo={formData.seo || {}}
                        onChange={newSeo => setFormData(prev => ({ ...prev, seo: newSeo }))}
                        parentTitle={formData.name}
                        parentDescription={formData.shortDescription || formData.description}
                        parentSlug={formData.slug}
                        parentImage={formData.image || (formData.images && formData.images[0])}
                        parentType="product"
                     />
                  </div>
               )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
               <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[2px]">
                  <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 text-[13px] font-bold text-gray-700">Publish</div>
                  <div className="p-3 space-y-4 text-[13px]">
                     <div className="flex justify-between items-center">
                        <button type="button" onClick={handleSubmit} className="border border-[#c3c4c7] px-3 py-1.5 rounded-[3px] bg-[#f6f7f7] hover:bg-[#f0f0f1] text-[12px] font-medium">Save Draft</button>
                        <button type="button" className="text-[#2271b1] underline">Preview</button>
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
                  <div className="p-4 max-h-48 overflow-y-auto">
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
                     <MediaPicker value={formData.images[0]} onChange={url => setFormData({ ...formData, images: [url] })} />
                  </div>
                  <div className="p-4 border-t border-gray-100">
                     <label className="text-[13px] font-bold block mb-2 text-gray-700">Product Gallery</label>
                     <MediaPicker multiple value={formData.images.slice(1)} onChange={urls => setFormData({ ...formData, images: [formData.images[0], ...urls] })} />
                  </div>
               </div>
            </div>
         </form>
    </AdminPageLayout>
   );
}

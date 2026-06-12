/**
 * PageForm.js
 * 
 * A high-performance, WordPress-style administrative interface for managing dynamic pages.
 * Replaces the legacy drag-and-drop builder with a streamlined, field-based editor.
 * 
 * Features:
 * - Accordion-style section management (only one section expanded at a time).
 * - Advanced SEO Suite (Focus keywords, OG/Twitter Meta, Schema Auto-generation).
 * - Integrated Media Library (Click-to-select interaction on all image fields).
 * - Production-ready UUID generation for section stability.
 * - Draggable reordering using @dnd-kit.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
   ChevronDown,
   ChevronUp,
   Plus,
   X,
   Globe,
   Layers,
   Settings,
   Copy,
   Trash2,
   Eye,
   EyeOff,
   GripVertical,
   ExternalLink,
   ArrowLeft,
   Save,
   FileText,
   CheckCircle2,
   Clock
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "react-hot-toast";
import Link from "next/link";

import { SECTION_SCHEMAS } from "@/lib/section-schemas";
import { TEMPLATE_REGISTRY } from "@/lib/templates";
import MediaPickerModal from "./MediaPickerModal";
import AdminPageLayout from "./AdminPageLayout";
import SEOConfigPanel from "./SEOConfigPanel";
import * as LucideIcons from "lucide-react";

/**
 * PRODUCTION-GRADE UUID GENERATOR
 */
const generateId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
};

// Massive icon library for the picker
const COMMON_ICONS = [
  "Zap", "Shield", "Truck", "RotateCcw", "Globe", "HelpCircle", "Package",
  "ShoppingBag", "Star", "Heart", "Search", "User", "Mail", "Phone",
  "MapPin", "Gift", "Award", "Clock", "Check", "Info", "AlertCircle",
  "ArrowRight", "ArrowLeft", "ChevronUp", "ChevronDown", "CreditCard", "Tag",
  "ThumbsUp", "Bell", "Eye", "Lock", "Unlock", "Camera", "Image", "Video",
  "Play", "Pause", "Home", "Settings", "Menu", "X", "Filter", "Download"
];

const IconPicker = ({ value, onChange }) => {
  const [search, setSearch] = useState("");
  const Icon = LucideIcons[value] || LucideIcons.HelpCircle;
  const filteredIcons = COMMON_ICONS.filter(name => name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-2 border border-[#c3c4c7] bg-[#f6f7f7] p-2">
      <div className="flex items-center gap-3 p-2 bg-white border border-[#c3c4c7]">
        <div className="w-10 h-10 bg-gray-50 border border-gray-100 flex items-center justify-center text-[#2271b1]">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="Search icons..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-[13px] border-none p-0 focus:ring-0 placeholder:text-[#646970] font-medium"
          />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 p-1 max-h-[140px] overflow-y-auto bg-white border border-[#c3c4c7]">
        {filteredIcons.map(iconName => {
          const ItemIcon = LucideIcons[iconName];
          return (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              className={`p-2 flex items-center justify-center rounded-sm transition-all ${value === iconName ? 'bg-[#2271b1] text-white' : 'bg-white hover:bg-gray-100 text-[#646970]'}`}
            >
              <ItemIcon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- Sortable Section Meta Box ---
const SectionMetaBox = ({
  section,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onDuplicate,
  onOpenMediaPicker,
  renderField
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const schema = SECTION_SCHEMAS[section.type] || { name: section.type, fields: [] };
  const config = section.config || {};

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className={`bg-white border border-[#c3c4c7] mb-3 shadow-sm ${!section.enabled ? 'opacity-60' : ''}`}>
      <div className="px-3 py-2 border-b border-[#c3c4c7] flex items-center justify-between bg-[#f6f7f7] hover:bg-white transition-colors">
        <div className="flex items-center gap-3 flex-1">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-[#2271b1]">
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 select-none cursor-pointer" onClick={() => onToggleExpand(section.id)}>
            <h3 className="text-[13px] font-bold text-gray-700">{schema.name}</h3>
            {!section.enabled && <span className="text-[9px] bg-gray-200 px-1.5 py-0.5 rounded uppercase font-black">Hidden</span>}
          </div>
        </div>

        <div className="flex items-center gap-1">
           <button type="button" onClick={() => onUpdate(section.id, null, !section.enabled)} className={`p-1.5 rounded hover:bg-gray-100 ${section.enabled ? 'text-green-600' : 'text-gray-400'}`}>
              {section.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
           </button>
           <button type="button" onClick={() => onDuplicate(section)} className="p-1.5 rounded hover:bg-gray-100 text-[#2271b1]">
              <Copy className="w-3.5 h-3.5" />
           </button>
           <button type="button" onClick={() => onDelete(section.id)} className="p-1.5 rounded hover:bg-red-50 text-[#d63638]">
              <Trash2 className="w-3.5 h-3.5" />
           </button>
           <button type="button" onClick={() => onToggleExpand(section.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
           </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-5 bg-white space-y-6">
          {schema.fields.filter(field => field.dependsOn ? config[field.dependsOn] === field.visibleIf : true).map((field) => (
            <div key={field.name} className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{field.label}</label>
              {renderField(field, config[field.name], (val) => onUpdate(section.id, { [field.name]: val }), onOpenMediaPicker)}
            </div>
          ))}
          <div className="pt-3 border-t border-gray-100 flex justify-between items-center opacity-30 text-[9px] font-mono">
             <span>TYPE: {section.type}</span>
             <span>ID: {section.id.slice(0, 8)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function PageForm({ pageId }) {
   const router = useRouter();
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [activeFormTab, setActiveFormTab] = useState("content");
   const [page, setPage] = useState(null);
   const [expandedSectionId, setExpandedSectionId] = useState(null);
   const [mediaPicker, setMediaPicker] = useState({ open: false, onSelect: null });
   const [dynamicOptions, setDynamicOptions] = useState({ categories: [], products: [], blogs: [] });

   const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
   );

   useEffect(() => {
      const fetchData = async () => {
         try {
            const promises = [
               fetch("/api/admin/categories"),
               fetch("/api/admin/products"),
               fetch("/api/admin/blogs")
            ];
            if (pageId && pageId !== "new") {
               promises.unshift(fetch(`/api/admin/pages/${pageId}`));
            }

            const results = await Promise.all(promises);

            let pageData = null;
            let catsRes, prodsRes, blogsRes;

            if (pageId && pageId !== "new") {
               const [pageRes, catsFetch, prodsFetch, blogsFetch] = results;
               pageData = await pageRes.json();
               catsRes = catsFetch;
               prodsRes = prodsFetch;
               blogsRes = blogsFetch;
            } else {
               const [catsFetch, prodsFetch, blogsFetch] = results;
               catsRes = catsFetch;
               prodsRes = prodsFetch;
               blogsRes = blogsFetch;
               pageData = {
                  title: "",
                  slug: "",
                  description: "",
                  status: "Draft",
                  template: "default",
                  sections: [],
                  seo: {
                     title: "",
                     description: "",
                     keywords: [],
                     focusKeyword: "",
                     secondaryKeywords: "",
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
                  }
               };
            }

            const [cats, prods, blogs] = await Promise.all([
               catsRes.json(),
               prodsRes.json(),
               blogsRes.json()
            ]);

            setPage(pageData);
            setDynamicOptions({
               categories: Array.isArray(cats) ? cats.filter(c => c.status === 'Published').map(c => ({ label: c.name, value: c._id })) : [],
               products: Array.isArray(prods) ? prods.map(p => ({ label: p.name, value: p.slug || p._id })) : [],
               blogs: Array.isArray(blogs) ? blogs.filter(b => b.status === 'Published').map(b => ({ label: b.title, value: b._id })) : []
            });
            setLoading(false);
         } catch (err) {
            console.error("Fetch failed", err);
            toast.error("Failed to load page data");
            setLoading(false);
         }
      };
      fetchData();
   }, [pageId]);

   const handleSave = async (e) => {
      if (e) e.preventDefault();
      setSaving(true);
      try {
         // Strip immutable Mongoose fields that cause _id update errors
         const { _id, __v, createdAt, updatedAt, ...cleanPage } = page;
         console.log("[PageForm] Saving page seo:", cleanPage.seo);
         
         const isNew = pageId === "new" || !_id;
         const url = isNew ? "/api/admin/pages" : `/api/admin/pages/${pageId}`;
         const method = isNew ? "POST" : "PUT";

         const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cleanPage)
         });
         if (res.ok) {
            const savedData = await res.json();
            toast.success(isNew ? "Page created successfully" : "Page updated successfully");
            router.push(isNew ? `/admin/pages/${savedData._id}` : "/admin/pages");
         } else {
            const errData = await res.json().catch(() => ({}));
            toast.error(`Save failed: ${errData.error || res.statusText || "Unknown error"}`);
            console.error("[PageForm] Save failed:", errData);
         }
      } catch (err) {
         toast.error(`Failed to save changes: ${err.message}`);
         console.error(err);
      } finally {
         setSaving(false);
      }
   };

   const handleDelete = async () => {
      if (page.isSystem) {
         toast.error("System pages cannot be deleted");
         return;
      }
      if (!confirm("Are you sure you want to delete this page? This action cannot be undone.")) {
         return;
      }
      try {
         const res = await fetch(`/api/admin/pages/${pageId}`, {
            method: "DELETE"
         });
         if (res.ok) {
            toast.success("Page deleted successfully");
            router.push("/admin/pages");
         } else {
            const errData = await res.json().catch(() => ({}));
            toast.error(`Delete failed: ${errData.error || res.statusText || "Unknown error"}`);
         }
      } catch (err) {
         toast.error(`Failed to delete page: ${err.message}`);
         console.error(err);
      }
   };

   const renderField = (field, value, onChange, onOpenMediaPicker) => {
      const inputClass = "w-full border border-[#c3c4c7] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white transition-all shadow-inner";

      switch (field.type) {
         case "text":
            return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
         case "textarea":
            return <textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${inputClass} resize-none`} />;
         case "image":
            return (
               <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                     <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} placeholder="URL or Pick Asset..." />
                     <button type="button" onClick={() => onOpenMediaPicker(onChange)} className="h-9 px-4 bg-white border border-[#c3c4c7] text-[12px] font-bold hover:bg-[#f6f7f7] shrink-0">Select Image</button>
                  </div>
                  {value ? (
                     <div 
                        className="w-32 aspect-square border-2 border-dashed border-gray-200 rounded bg-gray-50 overflow-hidden cursor-pointer hover:border-[#2271b1] transition-all group relative"
                        onClick={() => onOpenMediaPicker(onChange)}
                     >
                        <img src={value} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <span className="bg-black/60 text-white text-[9px] px-2 py-1 rounded font-bold">CHANGE</span>
                        </div>
                     </div>
                  ) : (
                     <div 
                        className="w-32 aspect-square border-2 border-dashed border-gray-200 rounded bg-gray-50 flex items-center justify-center cursor-pointer hover:border-[#2271b1] text-gray-400"
                        onClick={() => onOpenMediaPicker(onChange)}
                     >
                        <Plus className="w-5 h-5" />
                     </div>
                  )}
               </div>
            );
         case "icon":
            return <IconPicker value={value} onChange={onChange} />;
         case "select":
            return (
               <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass}>
                  <option value="">— Select —</option>
                  {(field.options === 'categories' ? dynamicOptions.categories : 
                    field.options === 'products' ? dynamicOptions.products :
                    field.options === 'blogs' ? dynamicOptions.blogs :
                    Array.isArray(field.options) ? field.options : []).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
               </select>
            );
         case "multiselect": {
            const selected = Array.isArray(value) ? value : [];
            const msOpts = field.options === 'categories' ? dynamicOptions.categories : field.options === 'products' ? dynamicOptions.products : field.options === 'blogs' ? dynamicOptions.blogs : field.options || [];
            return (
               <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto p-3 border border-[#c3c4c7] bg-white shadow-inner">
                  {msOpts.length === 0 && <span className="text-[11px] text-gray-400 italic p-2">No options available</span>}
                  {msOpts.map(opt => (
                     <label key={opt.value} className="flex items-center gap-2.5 text-[13px] hover:bg-[#f0f6fa] px-2 py-1.5 cursor-pointer transition-colors rounded">
                        <input type="checkbox" className="rounded-sm border-gray-300 text-[#2271b1] focus:ring-[#2271b1]" checked={selected.includes(opt.value)} onChange={(e) => onChange(e.target.checked ? [...selected, opt.value] : selected.filter(v => v !== opt.value))} />
                        <span>{opt.label}</span>
                     </label>
                  ))}
               </div>
            );
         }
         case "repeater":
            const items = value || [];
            return (
               <div className="space-y-3 bg-[#f6f7f7] p-4 border border-[#c3c4c7]">
                  {items.map((item, index) => (
                     <div key={index} className="bg-white border border-[#c3c4c7] p-4 relative shadow-sm">
                        <div className="flex items-center justify-between border-b border-[#f0f0f1] pb-2 mb-4">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Item {index + 1}</span>
                           <button type="button" onClick={() => { const n = [...items]; n.splice(index, 1); onChange(n); }} className="text-[#d63638] text-[11px] font-bold hover:underline">Remove</button>
                        </div>
                        <div className="grid grid-cols-1 gap-5">
                           {field.fields.map(sf => (
                              <div key={sf.name} className="space-y-1.5">
                                 <label className="text-[11px] font-bold text-gray-400 uppercase">{sf.label}</label>
                                 {renderField(sf, item[sf.name], (v) => { const n = [...items]; n[index] = { ...item, [sf.name]: v }; onChange(n); }, onOpenMediaPicker)}
                              </div>
                           ))}
                        </div>
                     </div>
                  ))}
                  <button type="button" onClick={() => onChange([...items, {}])} className="w-full py-2 bg-white border border-[#c3c4c7] text-[#2271b1] text-[11px] font-bold uppercase hover:bg-[#f6f7f7] transition-all">+ Add Item</button>
               </div>
            );
         default: return null;
      }
   };

   const updateSection = (id, newConfig, enabled) => {
      setPage(prev => ({
         ...prev,
         sections: prev.sections.map(s => s.id === id ? { ...s, enabled: enabled !== undefined ? enabled : s.enabled, config: newConfig ? { ...(s.config || {}), ...newConfig } : (s.config || {}) } : s)
      }));
   };

   const handleDragEnd = (event) => {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
         setPage((prev) => {
            const oldIndex = prev.sections.findIndex(s => s.id === active.id);
            const newIndex = prev.sections.findIndex(s => s.id === over.id);
            const newSections = arrayMove(prev.sections, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }));
           return { ...prev, sections: newSections };
         });
      }
   };

   if (loading) return <div className="p-10 text-[13px] font-medium text-gray-500 bg-[#f0f2f1] min-h-screen">Loading WordPress-style editor...</div>;

   if (!page) {
      return (
         <div className="p-10 text-center bg-[#f0f2f1] min-h-screen flex flex-col items-center justify-center gap-4">
            <div className="bg-white p-8 border border-[#c3c4c7] max-w-md w-full text-left shadow-sm rounded-sm">
               <h2 className="text-[#d63638] font-bold text-[16px] mb-2 flex items-center gap-2">
                  Failed to load page data
               </h2>
               <p className="text-gray-600 text-[13px] mb-6 leading-relaxed">
                  Your administrator session may have expired, or the page you are trying to edit does not exist. Please try logging back in.
               </p>
               <div className="flex flex-col gap-2.5">
                  <button 
                     type="button" 
                     onClick={() => window.location.reload()} 
                     className="w-full bg-[#2271b1] text-white px-4 py-2 text-[12px] font-bold hover:bg-[#135e96] transition-all text-center rounded-sm"
                  >
                     Retry Connection / Reload
                  </button>
                  <Link 
                     href="/admin-login" 
                     className="w-full border border-[#c3c4c7] text-gray-700 px-4 py-2 text-[12px] font-bold bg-[#f6f7f7] hover:bg-[#f0f0f1] transition-all text-center block rounded-sm"
                  >
                     Log In to Admin Panel
                  </Link>
                  <Link 
                     href="/admin/pages" 
                     className="w-full text-[#2271b1] text-[12px] hover:underline text-center mt-2 block"
                  >
                     ← Back to Pages List
                  </Link>
               </div>
            </div>
         </div>
      );
   }

   return (
      <AdminPageLayout 
         title="Edit Page" 
         addNewLink="/admin/pages/new"
         addNewLabel="Add New"
         breadcrumbs={[{ label: "Pages", href: "/admin/pages" }, { label: "Edit" }]}
      >
         <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start pb-40">
            {/* Main Column */}
            <div className="lg:col-span-3 space-y-4">
               <div className="space-y-1">
                  <div className="flex items-center gap-2">
                     <input
                        required
                        placeholder="Enter title here"
                        className="w-full border border-[#c3c4c7] outline-none px-3 py-2 text-[20px] bg-white shadow-inner font-semibold post-title-input"
                        value={page.title}
                        onChange={(e) => {
                           const val = e.target.value;
                           if (pageId === "new") {
                              const slug = val
                                 .toLowerCase()
                                 .replace(/[^a-z0-9]+/g, '-')
                                 .replace(/(^-|-$)/g, '');
                              setPage(prev => ({ ...prev, title: val, slug }));
                           } else {
                              setPage(prev => ({ ...prev, title: val }));
                           }
                        }}
                     />
                     {page.isSystem && <span className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase px-2 py-1 rounded">System Page</span>}
                     {pageId === "new" ? (
                        <div className="flex items-center gap-1.5 shrink-0 bg-white border border-[#c3c4c7] px-2 py-1 rounded-[3px]">
                           <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Template:</span>
                           <select 
                              value={page.template || "default"}
                              onChange={(e) => {
                                 const nextTemplate = e.target.value;
                                 const templateConfig = TEMPLATE_REGISTRY[nextTemplate] || TEMPLATE_REGISTRY.default;
                                 const defaultSecs = templateConfig.defaultSections ? templateConfig.defaultSections.map((s, i) => ({
                                    id: generateId(),
                                    type: s.type,
                                    enabled: true,
                                    order: i,
                                    config: s.config || {}
                                 })) : [];
                                 setPage(prev => ({
                                    ...prev,
                                    template: nextTemplate,
                                    sections: defaultSecs
                                 }));
                              }}
                              className="text-[11px] font-bold text-[#2271b1] bg-transparent outline-none cursor-pointer border-none p-0 focus:ring-0"
                           >
                              <option value="default">Default Template</option>
                              <option value="home">Homepage Template</option>
                              <option value="about">About Page Template</option>
                              <option value="contact">Contact Page Template</option>
                           </select>
                        </div>
                     ) : (
                        <span className="bg-blue-50 text-blue-700 text-[9px] font-black uppercase px-2 py-1 rounded select-none border border-blue-200">
                           Template: {TEMPLATE_REGISTRY[page.template || "default"]?.name || page.template || "Default"}
                        </span>
                     )}
                  </div>
                  <div className="text-[12px] text-gray-500 px-1 mt-1 flex items-center gap-1">
                     Permalink: <span className="text-gray-400">pairo.store/</span>
                     <input className="border-none bg-transparent outline-none text-[#2271b1] font-mono w-fit min-w-[50px]" value={page.slug} onChange={(e) => setPage({ ...page, slug: e.target.value })} disabled={page.isSystem} />
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
                  /* Section Manager Meta Box */
                  <div className="bg-white border border-[#c3c4c7] shadow-sm">
                     <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-4 py-2 flex items-center justify-between">
                        <span className="text-[13px] font-bold text-gray-700 uppercase tracking-tighter">Page Sections</span>
                        <div className="relative group">
                           <button type="button" className="text-[11px] font-bold text-[#2271b1] hover:text-black flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5" /> Add Section
                           </button>
                           <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#c3c4c7] shadow-xl z-50 hidden group-hover:block py-1">
                              {Object.entries(SECTION_SCHEMAS)
                                 .filter(([type]) => {
                                    const templateConfig = TEMPLATE_REGISTRY[page.template || "default"];
                                    return !templateConfig || !templateConfig.allowedSections || templateConfig.allowedSections.includes(type);
                                 })
                                 .map(([type, s]) => (
                                    <button 
                                       key={type} 
                                       type="button"
                                       onClick={() => {
                                          const id = generateId();
                                          const newSec = { id, type, enabled: true, order: page.sections.length, config: {} };
                                          setPage({ ...page, sections: [...page.sections, newSec] });
                                          setExpandedSectionId(id);
                                       }}
                                       className="w-full text-left px-4 py-1.5 text-[12px] hover:bg-[#2271b1] hover:text-white"
                                    >
                                       {s.name}
                                    </button>
                                 ))}
                           </div>
                        </div>
                     </div>
                     <div className="p-4 bg-[#f0f2f1]/30">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                           <SortableContext items={page.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-1">
                                 {page.sections.map((s) => (
                                    <SectionMetaBox 
                                       key={s.id} 
                                       section={s} 
                                       isExpanded={expandedSectionId === s.id} 
                                       onToggleExpand={(id) => setExpandedSectionId(expandedSectionId === id ? null : id)} 
                                       onUpdate={updateSection} 
                                       onDelete={(id) => setPage({ ...page, sections: page.sections.filter(x => x.id !== id) })} 
                                       onDuplicate={(sec) => {
                                          const id = generateId();
                                          const newSec = { ...JSON.parse(JSON.stringify(sec)), id, order: page.sections.length };
                                          setPage({ ...page, sections: [...page.sections, newSec] });
                                          setExpandedSectionId(id);
                                       }} 
                                       onOpenMediaPicker={(cb) => setMediaPicker({ open: true, onSelect: cb })} 
                                       renderField={renderField} 
                                    />
                                 ))}
                              </div>
                           </SortableContext>
                        </DndContext>
                     </div>
                  </div>
               ) : (
                  <div className="bg-white border border-[#c3c4c7] shadow-sm p-6">
                     <h2 className="text-[14px] font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2">SEO Configurations</h2>
                     <SEOConfigPanel
                        seo={page.seo || {}}
                        onChange={newSeo => setPage(prev => ({ ...prev, seo: newSeo }))}
                        parentTitle={page.title}
                        parentDescription={page.description}
                        parentSlug={page.slug}
                        parentImage=""
                        parentType="page"
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
                        <button type="button" onClick={handleSave} className="border border-[#c3c4c7] px-3 py-1.5 rounded-[3px] bg-[#f6f7f7] hover:bg-[#f0f0f1] text-[12px] font-medium">Save Draft</button>
                        <Link href={`/${page.slug}`} target="_blank" className="text-[#2271b1] underline">Preview</Link>
                     </div>
                     <div className="space-y-3 py-3 border-y border-gray-100">
                        <div className="flex items-center justify-between">
                            <p><span className="text-gray-400">Status:</span> <strong>{page.status}</strong></p>
                            <select 
                                className="text-[11px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-[#2271b1]"
                                value={page.status}
                                onChange={(e) => setPage({ ...page, status: e.target.value })}
                            >
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                            </select>
                        </div>
                        <p><span className="text-gray-400">Last Modified:</span> <strong>{new Date(page.updatedAt).toLocaleDateString()}</strong></p>
                     </div>
                     <div className="bg-[#f6f7f7] border-t border-[#c3c4c7] -mx-3 -mb-3 p-3 flex justify-between items-center">
                        <div>
                           {!page.isSystem && pageId !== "new" && (
                              <button type="button" onClick={handleDelete} className="text-[#d63638] underline hover:text-red-800 transition-colors">
                                 Delete Page
                              </button>
                           )}
                        </div>
                        <button type="submit" disabled={saving} className="bg-[#2271b1] text-white px-4 py-1.5 rounded-[3px] font-bold hover:bg-[#135e96]">
                           {saving ? "Saving..." : "Update"}
                        </button>
                     </div>
                  </div>
               </div>

            </div>
         </form>

         {mediaPicker.open && (
            <MediaPickerModal open={true} onClose={() => setMediaPicker({ open: false, onSelect: null })} onSelect={(sel) => { mediaPicker.onSelect(sel.url); setMediaPicker({ open: false, onSelect: null }); }} title="Asset Library" />
         )}
      </AdminPageLayout>
   );
}

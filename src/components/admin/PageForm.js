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

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePopup } from "@/context/PopupContext";
import { confirmSlugChange, normalizePageSlug } from "./slugChange";
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
   ArrowUp,
   ArrowDown,
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

import dynamic from "next/dynamic";
import { SECTION_SCHEMAS } from "@/lib/section-schemas";
import { TEMPLATE_REGISTRY } from "@/lib/templates";
import MediaPickerModal from "./MediaPickerModal";
import { Page, PageHeader, Notice } from "./ui";
import SEOConfigPanel from "./SEOConfigPanel";
import { useRBAC } from "@/hooks/useRBAC";
import { planTemplateChange } from "./builder/templateChange";
import * as LucideIcons from "lucide-react";
import ThemedSelect from "@/components/ui/ThemedSelect";

const QuillEditor = dynamic(() => import("@/components/admin/QuillEditor"), { ssr: false });

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

   const allIconNames = React.useMemo(() => {
      return Object.keys(LucideIcons).filter(key => 
         key !== 'createReactComponent' && 
         key !== 'default' && 
         /^[A-Z]/.test(key)
      );
   }, []);

   const filteredIcons = React.useMemo(() => {
      if (!search) return COMMON_ICONS;
      return allIconNames
         .filter(name => name.toLowerCase().includes(search.toLowerCase()))
         .slice(0, 49);
   }, [search, allIconNames]);

   return (
      <div className="flex flex-col gap-2 border border-[#dcdcde] bg-[#f6f7f7] p-2">
         <div className="flex items-center gap-2">
            <div className="w-10 h-10 shrink-0 bg-white border border-[#dcdcde] flex items-center justify-center text-[#2271b1]" title={value || "No icon selected"}>
               <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <input
               type="search"
               aria-label="Search icons"
               placeholder="Search icons..."
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="wp-input flex-1 min-w-0"
            />
         </div>
         <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 p-1 max-h-[160px] overflow-y-auto bg-white border border-[#dcdcde]">
            {filteredIcons.map(iconName => {
               const ItemIcon = LucideIcons[iconName];
               if (!ItemIcon) return null;
               return (
                  <button
                     key={iconName}
                     type="button"
                     onClick={() => onChange(iconName)}
                     aria-label={iconName}
                     aria-pressed={value === iconName}
                     title={iconName}
                     className={`min-h-[40px] flex items-center justify-center ${value === iconName ? 'bg-[#2271b1] text-white' : 'bg-white hover:bg-[#f0f0f1] text-[#3c434a]'}`}
                  >
                     <ItemIcon className="w-4 h-4" aria-hidden="true" />
                  </button>
               );
            })}
         </div>
      </div>
   );
}

// --- Sortable Section Meta Box ---
const SectionMetaBox = ({
   section,
   isExpanded,
   onToggleExpand,
   onUpdate,
   onDelete,
   onDuplicate,
   onMove,
   isFirst,
   isLast,
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
      <div ref={setNodeRef} style={style} className={`bg-white border border-[#c3c4c7] mb-2 ${!section.enabled ? 'opacity-60' : ''}`}>
         <div className={`flex flex-wrap items-center justify-between gap-x-1 px-1 sm:px-2 bg-white ${isExpanded ? 'border-b border-[#dcdcde]' : ''}`}>
            <div className="flex items-center gap-1 flex-1 min-w-[150px]">
               <div {...attributes} {...listeners} style={{ touchAction: "none" }} className="cursor-grab active:cursor-grabbing min-w-[36px] min-h-[40px] flex items-center justify-center text-[#8c8f94] hover:text-[#2271b1] shrink-0" title="Drag to reorder" aria-label={`Drag to reorder ${schema.name} section`}>
                  <GripVertical className="w-4 h-4" aria-hidden="true" />
               </div>
               <div className="flex flex-wrap items-center gap-2 select-none cursor-pointer min-w-0 py-2" onClick={() => onToggleExpand(section.id)}>
                  <h3 className="text-[14px] font-semibold text-[#1d2327] break-words m-0">{schema.name}</h3>
                  {!section.enabled && <span className="wp-pill wp-pill-sm wp-st-draft">Hidden</span>}
               </div>
            </div>

            <div className="flex items-center shrink-0 ml-auto">
               <button type="button" onClick={() => onMove(section.id, -1)} disabled={isFirst} aria-label={`Move ${schema.name} section up`} title="Move up" className="min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#f0f0f1] text-[#646970] disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent">
                  <ArrowUp className="w-4 h-4" aria-hidden="true" />
               </button>
               <button type="button" onClick={() => onMove(section.id, 1)} disabled={isLast} aria-label={`Move ${schema.name} section down`} title="Move down" className="min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#f0f0f1] text-[#646970] disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent">
                  <ArrowDown className="w-4 h-4" aria-hidden="true" />
               </button>
               <button type="button" onClick={() => onUpdate(section.id, null, !section.enabled)} aria-label={section.enabled ? `Hide ${schema.name} section` : `Show ${schema.name} section`} title={section.enabled ? "Hide section" : "Show section"} className={`min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#f0f0f1] ${section.enabled ? 'text-[#00a32a]' : 'text-[#8c8f94]'}`}>
                  {section.enabled ? <Eye className="w-4 h-4" aria-hidden="true" /> : <EyeOff className="w-4 h-4" aria-hidden="true" />}
               </button>
               <button type="button" onClick={() => onDuplicate(section)} aria-label={`Duplicate ${schema.name} section`} title="Duplicate section" className="min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#f0f0f1] text-[#2271b1]">
                  <Copy className="w-4 h-4" aria-hidden="true" />
               </button>
               <button type="button" onClick={() => onDelete(section.id)} aria-label={`Delete ${schema.name} section`} title="Delete section" className="min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#fcf0f1] text-[#d63638]">
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
               </button>
               <button type="button" onClick={() => onToggleExpand(section.id)} aria-expanded={!!isExpanded} aria-label={isExpanded ? `Collapse ${schema.name} section` : `Expand ${schema.name} section`} className="min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#f0f0f1] text-[#646970]">
                  {isExpanded ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
               </button>
            </div>
         </div>

         {isExpanded && (
            <div className="p-3 sm:p-4 bg-white">
               {schema.fields.filter(field => {
                   if (!field.dependsOn) return true;
                   const val = config[field.dependsOn] !== undefined ? config[field.dependsOn] : (field.dependsOn === 'showType' ? 'collection' : undefined);
                   return val === field.visibleIf;
                }).map((field) => (
                  <div key={field.name} className="wp-field">
                     <label className="wp-label">{field.label}</label>
                     {renderField(field, config[field.name], (val) => onUpdate(section.id, { [field.name]: val }), onOpenMediaPicker)}
                  </div>
               ))}
               <div className="pt-2 mt-2 border-t border-[#f0f0f1] flex flex-wrap justify-between items-center gap-1 wp-muted wp-small">
                  <span className="break-all">Type: <code>{section.type}</code></span>
                  <span>ID: <code>{section.id.slice(0, 8)}</code></span>
               </div>
            </div>
         )}
      </div>
   );
};

export default function PageForm({ pageId }) {
   const router = useRouter();
   const { showConfirm } = usePopup();
   const { can } = useRBAC();
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   // ?tab=seo opens the SEO tab. Read once on mount; the tabs only render after the page data loads,
   // so the server/client initial values never reach the markup.
   const [activeFormTab, setActiveFormTab] = useState(() => {
      if (typeof window === "undefined") return "content";
      return new URLSearchParams(window.location.search).get("tab") === "seo" ? "seo" : "content";
   });
   const [page, setPage] = useState(null);
   const pageRef = useRef(null);
   // Slug the page was loaded / last saved with: changing it asks "Change URL?" first
   const savedSlugRef = useRef(null);
   useEffect(() => {
      pageRef.current = page;
   }, [page]);
   const [expandedSectionId, setExpandedSectionId] = useState(null);
   const [mediaPicker, setMediaPicker] = useState({ open: false, onSelect: null });
   const [dynamicOptions, setDynamicOptions] = useState({ categories: [], products: [], blogs: [] });
   // Add-section picker (a dialog, so it works on touch screens too) and the last save error.
   const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
   const [saveError, setSaveError] = useState("");
   const [duplicating, setDuplicating] = useState(false);

   const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
   );

   useEffect(() => {
      const fetchData = async () => {
         try {
            const promises = [
               fetch("/api/admin/categories", { cache: "no-store" }),
               fetch("/api/admin/products", { cache: "no-store" }),
               fetch("/api/admin/blogs", { cache: "no-store" })
            ];
            if (pageId && pageId !== "new") {
               promises.unshift(fetch(`/api/admin/pages/${pageId}`, { cache: "no-store" }));
            }

            const results = await Promise.all(promises);

            let pageData = null;
            let catsRes, prodsRes, blogsRes;

            if (pageId && pageId !== "new") {
               const [pageRes, catsFetch, prodsFetch, blogsFetch] = results;
               pageData = pageRes.ok ? await pageRes.json() : null;
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

            // Normalize sections productIds from slugs to ObjectIds
            const prodsList = Array.isArray(prods) ? prods : [];
            const catsList = Array.isArray(cats) ? cats : [];
            const blogsList = Array.isArray(blogs) ? blogs : [];

            if (pageData && !Array.isArray(pageData.sections)) pageData.sections = [];
            if (pageData && pageData.sections && Array.isArray(pageData.sections)) {
               pageData.sections.forEach(s => {
                  if (s?.config?.productIds && Array.isArray(s.config.productIds)) {
                     s.config.productIds = s.config.productIds.map(idOrSlug => {
                        const found = prodsList.find(p => p?._id === idOrSlug || p?.slug === idOrSlug);
                        return found ? found._id : idOrSlug;
                     });
                  }
               });
            }

            savedSlugRef.current = pageData?._id ? (pageData.slug || null) : null;
            setPage(pageData);
            setDynamicOptions({
               categories: catsList.filter(c => c && c.status === 'Published').map(c => ({ label: c.name, value: c._id })),
               products: prodsList.map(p => ({ label: p.name, value: p._id })),
               blogs: blogsList.filter(b => b && b.status === 'Published').map(b => ({ label: b.title, value: b._id }))
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

   // `overrides` lets "Save Draft" force status: "Draft" regardless of the status select.
   const handleSave = async (e, overrides = {}) => {
      if (e) e.preventDefault();
      const currentPage = pageRef.current || page;
      if (!currentPage) return;
      if (!String(currentPage.title || "").trim()) {
         setSaveError("Please enter a title before saving.");
         toast.error("Please enter a title before saving.");
         return;
      }
      if (!currentPage.isSystem && !String(currentPage.slug || "").trim()) {
         setSaveError("Please enter a permalink slug before saving.");
         toast.error("Please enter a permalink slug before saving.");
         return;
      }
      // Existing (non-system: their slug is locked) page whose URL changed: confirm first; cancel saves nothing
      const isExisting = pageId !== "new" && !!currentPage._id;
      if (isExisting && !currentPage.isSystem && !(await confirmSlugChange(showConfirm, {
         savedSlug: savedSlugRef.current,
         nextSlug: currentPage.slug,
         normalize: normalizePageSlug,
         toPath: (slug) => `/${slug}`,
      }))) return;
      setSaving(true);
      setSaveError("");
      try {
         // Strip immutable Mongoose fields that cause _id update errors
         const { _id, __v, createdAt, updatedAt, ...rest } = currentPage;
         const cleanPage = { ...rest, ...overrides };

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
            if (savedData?._id) savedSlugRef.current = savedData.slug || savedSlugRef.current;
            setPage(prev => ({ ...savedData, sections: Array.isArray(savedData.sections) ? savedData.sections : (prev?.sections || []) }));
            toast.success(overrides.status === "Draft" ? "Draft saved" : isNew ? (savedData.status === "Published" ? "Page published" : "Page created") : "Page updated");
            if (isNew && savedData._id) {
               router.push(`/admin/pages/${savedData._id}`);
            }
         } else {
            const errData = await res.json().catch(() => ({}));
            const msg = errData.error || res.statusText || "Unknown error";
            setSaveError(msg);
            toast.error(`Save failed: ${msg}`);
         }
      } catch (err) {
         setSaveError(`Failed to save changes: ${err.message}`);
         toast.error(`Failed to save changes: ${err.message}`);
      } finally {
         setSaving(false);
      }
   };

   const handleDelete = async () => {
      if (page.isSystem) {
         toast.error("System pages cannot be deleted");
         return;
      }
      if (!(await showConfirm("Move this page to the Trash? It will no longer be shown on the site. You can restore it from Pages → Trash.", "Move to Trash", { confirmText: "Move to Trash", danger: true }))) {
         return;
      }
      try {
         const res = await fetch(`/api/admin/pages/${page._id || pageId}`, {
            method: "DELETE"
         });
         if (res.ok) {
            toast.success("Page moved to Trash");
            router.push("/admin/pages");
         } else {
            const errData = await res.json().catch(() => ({}));
            toast.error(`Move to Trash failed: ${errData.error || res.statusText || "Unknown error"}`);
         }
      } catch (err) {
         toast.error(`Failed to move page to Trash: ${err.message}`);
         console.error(err);
      }
   };

   const handleDuplicate = async () => {
      if (!page?._id) return;
      setDuplicating(true);
      try {
         const res = await fetch(`/api/admin/pages/${page._id}/duplicate`, { method: "POST" });
         const data = await res.json().catch(() => ({}));
         if (res.ok && data?._id) {
            toast.success("Page duplicated as a draft");
            router.push(`/admin/pages/${data._id}`);
         } else {
            toast.error(data?.error || "Failed to duplicate page");
         }
      } catch (err) {
         toast.error("Failed to duplicate page");
      } finally {
         setDuplicating(false);
      }
   };

   // Move a section one place up (-1) or down (+1); the touch-friendly alternative to dragging.
   const moveSection = (id, dir) => {
      setPage(prev => {
         const from = prev.sections.findIndex(s => s.id === id);
         const to = from + dir;
         if (from < 0 || to < 0 || to >= prev.sections.length) return prev;
         return { ...prev, sections: arrayMove(prev.sections, from, to).map((s, i) => ({ ...s, order: i })) };
      });
   };

   const addSection = (type) => {
      const id = generateId();
      setPage(prev => ({ ...prev, sections: [...prev.sections, { id, type, enabled: true, order: prev.sections.length, config: {} }] }));
      setExpandedSectionId(id);
      setSectionPickerOpen(false);
   };

   const handleTemplateChange = async (nextTemplate) => {
      const currentSections = (pageRef.current || page)?.sections || [];
      const { templateConfig, defaults: defaultSecs, kept, removed, removedNames } =
         planTemplateChange(TEMPLATE_REGISTRY, SECTION_SCHEMAS, nextTemplate, currentSections, generateId);

      // Nothing to lose: just seed the new template's defaults.
      if (currentSections.length === 0) {
         setPage(prev => ({ ...prev, template: nextTemplate, sections: defaultSecs }));
         return;
      }

      const replace = await showConfirm(
         `This page already has ${currentSections.length} section${currentSections.length === 1 ? "" : "s"}. Replace them with the "${templateConfig.name}" default sections, or keep your current sections?` +
            (removedNames.length
               ? ` If you keep them, these sections aren't allowed in the new template and will be removed: ${removedNames.join(", ")}.`
               : " All current sections are allowed in the new template."),
         "Change template",
         { confirmText: "Replace with template defaults", cancelText: "Keep current sections" }
      );

      if (replace) {
         setPage(prev => ({ ...prev, template: nextTemplate, sections: defaultSecs }));
         return;
      }

      if (removed.length > 0) {
         const ok = await showConfirm(
            `Keeping your sections will remove ${removed.length} section${removed.length === 1 ? "" : "s"} not allowed in "${templateConfig.name}": ${removedNames.join(", ")}. Continue?`,
            "Remove sections",
            { confirmText: "Remove and change template", danger: true }
         );
         if (!ok) return; // Template change cancelled; nothing modified.
      }

      setPage(prev => ({ ...prev, template: nextTemplate, sections: kept }));
   };

   const renderField = (field, value, onChange, onOpenMediaPicker) => {
      const inputClass = "wp-input wp-full";

      switch (field.type) {
         case "text":
            return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
         case "number":
            return (
               <input
                  type="number"
                  value={value !== undefined && value !== null ? value : ""}
                  onChange={(e) => {
                     const v = e.target.value;
                     onChange(v === "" ? "" : Number(v));
                  }}
                  min={field.min !== undefined ? field.min : 0}
                  max={field.max !== undefined ? field.max : undefined}
                  step={field.step || "any"}
                  placeholder={field.placeholder || ""}
                  className={inputClass}
               />
            );
         case "textarea":
            return <textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} className="wp-textarea wp-full" />;
         case "image":
            return (
               <div className="flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                     <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="wp-input flex-1 min-w-0" placeholder="Image URL" aria-label="Image URL" />
                     <button type="button" onClick={() => onOpenMediaPicker(onChange)} className="wp-btn shrink-0">Select Image</button>
                  </div>
                  {value ? (
                     <button
                        type="button"
                        aria-label="Change image"
                        title="Change image"
                        className="w-32 aspect-square border border-[#dcdcde] bg-[#f6f7f7] overflow-hidden cursor-pointer hover:border-[#2271b1] p-0"
                        onClick={() => onOpenMediaPicker(onChange)}
                     >
                        <img src={value} alt="" className="w-full h-full object-cover" />
                     </button>
                  ) : (
                     <button
                        type="button"
                        aria-label="Select image"
                        className="w-32 aspect-square border border-dashed border-[#c3c4c7] bg-[#f6f7f7] flex items-center justify-center cursor-pointer hover:border-[#2271b1] text-[#646970] p-0"
                        onClick={() => onOpenMediaPicker(onChange)}
                     >
                        <Plus className="w-5 h-5" aria-hidden="true" />
                     </button>
                  )}
               </div>
            );
         case "icon":
            return <IconPicker value={value} onChange={onChange} />;
         case "select":
            return (
               <ThemedSelect value={value || ""} onChange={(e) => onChange(e.target.value)} className="wp-select wp-full">
                  <option value="">— Select —</option>
                  {(field.options === 'categories' ? dynamicOptions.categories :
                     field.options === 'products' ? dynamicOptions.products :
                        field.options === 'blogs' ? dynamicOptions.blogs :
                           Array.isArray(field.options) ? field.options : []).map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                           ))}
               </ThemedSelect>
            );
         case "multiselect": {
            const selected = Array.isArray(value) ? value : [];
            const msOpts = field.options === 'categories' ? dynamicOptions.categories :
               field.options === 'products' ? dynamicOptions.products :
               field.options === 'blogs' ? dynamicOptions.blogs :
               Array.isArray(field.options) ? field.options : [];
            return (
               <div className="wp-checklist" style={{ maxHeight: 200, overflowY: "auto" }}>
                  {msOpts.length === 0 && <span className="wp-muted">No options available</span>}
                  {msOpts.map(opt => (
                     <label key={opt.value} className="wp-check">
                        <input
                           type="checkbox"
                           checked={selected.some(v => String(v) === String(opt.value))}
                           onChange={(e) => onChange(
                              e.target.checked
                                 ? [...selected, opt.value]
                                 : selected.filter(v => String(v) !== String(opt.value))
                           )}
                        />
                        <span>{opt.label}</span>
                     </label>
                  ))}
               </div>
            );
         }
         case "repeater":
            const items = value || [];
            return (
               <div className="flex flex-col gap-2 bg-[#f6f7f7] p-2 sm:p-3 border border-[#dcdcde]">
                  {items.map((item, index) => (
                     <div key={index} className="bg-white border border-[#dcdcde]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f0f1] px-3 py-2 bg-[#f6f7f7]">
                           <span className="wp-strong">Item {index + 1}</span>
                           <button type="button" onClick={() => { const n = [...items]; n.splice(index, 1); onChange(n); }} className="text-[#d63638] underline min-h-[32px]" style={{ background: "none", border: 0, cursor: "pointer" }}>Remove</button>
                        </div>
                        <div className="p-3">
                           {field.fields.map(sf => (
                              <div key={sf.name} className="wp-field">
                                 <label className="wp-label">{sf.label}</label>
                                 {renderField(sf, item[sf.name], (v) => { const n = [...items]; n[index] = { ...item, [sf.name]: v }; onChange(n); }, onOpenMediaPicker)}
                              </div>
                           ))}
                        </div>
                     </div>
                  ))}
                  <button type="button" onClick={() => onChange([...items, {}])} className="wp-btn self-start"><Plus className="w-4 h-4" aria-hidden="true" /> Add Item</button>
               </div>
            );
         case "quill":
            return <QuillEditor value={value || ""} onChange={onChange} />;
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

   if (loading) return (
      <Page>
         <PageHeader title={pageId === "new" ? "Add New Page" : "Edit Page"} />
         <p className="wp-muted" role="status" style={{ marginTop: 0 }}>Loading page editor…</p>
      </Page>
   );

   if (!page) {
      return (
         <Page>
            <PageHeader title="Edit Page" />
            <div className="wp-notice wp-notice-error" role="alert">
               <p>
                  <strong>Failed to load page data.</strong> Your administrator session may have expired, or the page you are trying to edit does not exist. Please try logging back in.
               </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
               <Link href="/admin/pages" className="wp-link">
                  ← Back to Pages List
               </Link>
            </div>
         </Page>
      );
   }

   const linkBtnStyle = { background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" };
   const isNewPage = pageId === "new" || !page._id;
   const isTrashed = !!page.isDeleted;
   const availableSections = Object.entries(SECTION_SCHEMAS).filter(([type]) => {
      const templateConfig = TEMPLATE_REGISTRY[page.template || "default"];
      return !templateConfig || !templateConfig.allowedSections || templateConfig.allowedSections.includes(type);
   });

   return (
      <Page>
         <PageHeader
            title={isNewPage ? "Add New Page" : "Edit Page"}
            actions={can("pages.create") && !isNewPage ? <Link href="/admin/pages/new" className="wp-btn">Add New Page</Link> : null}
         />
         {isTrashed && (
            <Notice type="warning">
               This page is in the Trash, so it can&apos;t be edited. Restore it from <Link href="/admin/pages?status=trash">Pages → Trash</Link> first.
            </Notice>
         )}
         {saveError && (
            <Notice type="error" onDismiss={() => setSaveError("")}>
               <strong>Changes not saved.</strong> {saveError}
            </Notice>
         )}
         <form onSubmit={handleSave} className="wp-cols" style={{ paddingBottom: 40 }}>
            {/* Main Column */}
            <div className="wp-col-main">
               <div style={{ marginBottom: 20 }}>
                  <label htmlFor="page-title-input" className="sr-only">Page title</label>
                  <input
                     id="page-title-input"
                     required
                     placeholder="Enter title here"
                     className="wp-title-input"
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
                  <div className="wp-small flex flex-wrap items-center gap-1.5 break-words" style={{ marginTop: 8, color: "#3c434a" }}>
                     <span className="wp-strong">Permalink:</span>
                     <span className="wp-muted break-all">pairo.store/</span>
                     {page.isSystem ? (
                        <>
                           <span className="wp-strong break-all">{page.slug}</span>
                           <span className="wp-muted">(system slug locked)</span>
                        </>
                     ) : (
                        <>
                           <label htmlFor="page-slug-input" className="sr-only">Permalink slug</label>
                           <input
                              id="page-slug-input"
                              className="wp-input"
                              style={{ minWidth: 140, minHeight: 28, fontFamily: "monospace" }}
                              value={page.slug || ""}
                              onChange={(e) => setPage({ ...page, slug: e.target.value })}
                           />
                        </>
                     )}
                  </div>
               </div>

               {/* Content / SEO Tabs */}
               <div className="wp-tabs" role="tablist" aria-label="Editor sections">
                  <button
                     type="button"
                     role="tab"
                     id="page-tab-content"
                     aria-selected={activeFormTab === "content"}
                     aria-controls="page-form-panel"
                     onClick={() => setActiveFormTab("content")}
                     className="wp-tab"
                  >
                     Content Editor
                  </button>
                  <button
                     type="button"
                     role="tab"
                     id="page-tab-seo"
                     aria-selected={activeFormTab === "seo"}
                     aria-controls="page-form-panel"
                     onClick={() => setActiveFormTab("seo")}
                     className="wp-tab"
                  >
                     SEO Settings
                  </button>
               </div>

               <div id="page-form-panel" role="tabpanel" aria-labelledby={activeFormTab === "seo" ? "page-tab-seo" : "page-tab-content"}>
               {activeFormTab === "content" ? (
                  /* Section Manager Meta Box */
                  <section className="wp-postbox" aria-labelledby="page-sections-title">
                     <div className="wp-postbox-head">
                        <h2 id="page-sections-title">Page Sections</h2>
                        <div className="wp-postbox-aside">
                              <button type="button" className="wp-btn" aria-haspopup="dialog" onClick={() => setSectionPickerOpen(true)} disabled={isTrashed}>
                                 <Plus className="w-4 h-4" aria-hidden="true" /> Add Section
                              </button>
                        </div>
                     </div>
                     <div className="wp-inside" style={{ background: "#f6f7f7" }}>
                        {page.sections.length === 0 && (
                           <p className="wp-muted" style={{ margin: 0 }}>No sections yet. Use “Add Section” to start building this page.</p>
                        )}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                           <SortableContext items={page.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                              <div>
                                 {page.sections.map((s, idx) => (
                                    <SectionMetaBox
                                       key={s.id}
                                       section={s}
                                       isFirst={idx === 0}
                                       isLast={idx === page.sections.length - 1}
                                       onMove={moveSection}
                                       isExpanded={expandedSectionId === s.id}
                                       onToggleExpand={(id) => setExpandedSectionId(expandedSectionId === id ? null : id)}
                                       onUpdate={updateSection}
                                       onDelete={async (id) => {
                                          if (await showConfirm("Are you sure you want to remove this section? This cannot be undone.", "Remove section", { confirmText: "Remove", danger: true })) {
                                             setPage(prev => ({ ...prev, sections: prev.sections.filter(x => x.id !== id) }));
                                          }
                                       }}
                                       onDuplicate={(sec) => {
                                          const id = generateId();
                                          // The copy goes right below the original.
                                          setPage(prev => {
                                             const at = prev.sections.findIndex(x => x.id === sec.id);
                                             const next = [...prev.sections];
                                             next.splice(at + 1, 0, { ...JSON.parse(JSON.stringify(sec)), id });
                                             return { ...prev, sections: next.map((x, i) => ({ ...x, order: i })) };
                                          });
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
                  </section>
               ) : (
                  <SEOConfigPanel
                     seo={page.seo || {}}
                     onChange={newSeo => setPage(prev => ({ ...prev, seo: newSeo }))}
                     parentTitle={page.title}
                     parentDescription={page.description}
                     parentSlug={page.slug}
                     parentImage=""
                     parentType="page"
                  />
               )}
               </div>
            </div>

            {/* Sidebar */}
            <div className="wp-col-side">
               <section className="wp-postbox" aria-labelledby="page-publish-title">
                  <div className="wp-postbox-head"><h2 id="page-publish-title">Publish</h2></div>
                  <div className="flex flex-wrap justify-between items-center gap-2" style={{ padding: "10px 12px 2px" }}>
                     <button type="button" onClick={() => handleSave(null, { status: "Draft" })} disabled={saving || isTrashed} className="wp-btn">Save Draft</button>
                     {!isNewPage && page.slug && (
                        <Link href={page.slug === 'home' ? '/' : `/${page.slug}`} target="_blank" rel="noopener noreferrer" className="wp-btn">{page.status === "Published" ? "View Page" : "Preview"}</Link>
                     )}
                  </div>
                  <div className="wp-misc">
                     <div className="wp-misc-row">
                        <label htmlFor="page-status-select" className="wp-muted">Status:</label>
                        <strong className="wp-strong">{page.status}</strong>
                        <ThemedSelect
                           id="page-status-select"
                           className="wp-select"
                           style={{ marginLeft: "auto" }}
                           value={page.status}
                           onChange={(e) => setPage({ ...page, status: e.target.value })}
                        >
                           <option value="Draft">Draft</option>
                           <option value="Published">Published</option>
                        </ThemedSelect>
                     </div>
                     <div className="wp-misc-row">
                        {pageId === "new" ? (
                           <>
                              <label htmlFor="page-template-select" className="wp-muted">Template:</label>
                              <ThemedSelect
                                 id="page-template-select"
                                 className="wp-select"
                                 style={{ marginLeft: "auto", maxWidth: "100%" }}
                                 value={page.template || "default"}
                                 onChange={(e) => handleTemplateChange(e.target.value)}
                              >
                                 {Object.entries(TEMPLATE_REGISTRY).map(([key, t]) => (
                                    <option key={key} value={key}>{t.name || key}</option>
                                 ))}
                              </ThemedSelect>
                           </>
                        ) : (
                           <>
                              <span className="wp-muted">Template:</span>
                              <strong className="wp-strong break-words">{TEMPLATE_REGISTRY[page.template || "default"]?.name || page.template || "Default"}</strong>
                           </>
                        )}
                     </div>
                     {page.isSystem && (
                        <div className="wp-misc-row">
                           <span className="wp-muted">Type:</span> <strong className="wp-strong">System page</strong>
                        </div>
                     )}
                     <div className="wp-misc-row">
                        <span className="wp-muted">Last Modified:</span>
                        <strong className="wp-strong">{page.updatedAt ? new Date(page.updatedAt).toLocaleDateString() : "Not saved yet"}</strong>
                     </div>
                     {!isNewPage && can("pages.create") && !isTrashed && (
                        <div className="wp-misc-row">
                           <button type="button" onClick={handleDuplicate} disabled={duplicating} className="wp-link" style={{ ...linkBtnStyle, textDecoration: "underline", minHeight: 32 }}>
                              {duplicating ? "Duplicating…" : "Duplicate this page"}
                           </button>
                        </div>
                     )}
                  </div>
                  <div className="wp-box-foot">
                     {!page.isSystem && !isNewPage && !isTrashed && can("pages.delete") && (
                        <button type="button" onClick={handleDelete} style={{ ...linkBtnStyle, color: "#b32d2e", textDecoration: "underline", minHeight: 32 }}>
                           Move to Trash
                        </button>
                     )}
                     <span className="wp-spacer" />
                     <button type="submit" disabled={saving || isTrashed} className="wp-btn wp-btn-primary">
                        {saving ? "Saving..." : isNewPage ? (page.status === "Published" ? "Publish" : "Save") : "Update"}
                     </button>
                  </div>
               </section>
            </div>
         </form>

         {sectionPickerOpen && (
            <div className="wp-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setSectionPickerOpen(false); }} onKeyDown={(e) => { if (e.key === "Escape") setSectionPickerOpen(false); }}>
               <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="page-add-section-title">
                  <div className="wp-modal-head">
                     <h2 id="page-add-section-title">Add section</h2>
                     <button type="button" onClick={() => setSectionPickerOpen(false)} className="wp-notice-dismiss" aria-label="Close add section dialog"><X className="w-5 h-5" aria-hidden="true" /></button>
                  </div>
                  <div className="wp-modal-body">
                     {availableSections.length === 0 ? (
                        <p className="wp-muted m-0">No sections are available for this template.</p>
                     ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                           {availableSections.map(([type, s]) => (
                              <button key={type} type="button" onClick={() => addSection(type)} className="wp-btn justify-start text-left" style={{ minHeight: 40 }}>
                                 <Plus className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="min-w-0 break-words">{s.name}</span>
                              </button>
                           ))}
                        </div>
                     )}
                  </div>
                  <div className="wp-modal-foot">
                     <button type="button" onClick={() => setSectionPickerOpen(false)} className="wp-btn">Cancel</button>
                  </div>
               </div>
            </div>
         )}

         {mediaPicker.open && (
            <MediaPickerModal open={true} onClose={() => setMediaPicker({ open: false, onSelect: null })} onSelect={(sel) => { mediaPicker.onSelect(sel.url); setMediaPicker({ open: false, onSelect: null }); }} title="Asset Library" />
         )}
      </Page>
   );
}

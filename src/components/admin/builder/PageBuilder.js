"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
import * as LucideIcons from "lucide-react";
import { usePopup } from "@/context/PopupContext";
import { confirmSlugChange, normalizePageSlug } from "@/components/admin/slugChange";
import dynamic from "next/dynamic";

const QuillEditor = dynamic(() => import("@/components/admin/QuillEditor"), { ssr: false });
import { 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff, 
  Plus, 
  Save, 
  ArrowLeft, 
  ArrowUp,
  ArrowDown,
  Settings, 
  Globe, 
  GripVertical,
  ExternalLink,
  Monitor,
  Smartphone,
  Tablet,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";
import { SECTION_SCHEMAS } from "@/lib/section-schemas";
import { hydratePageDefaults } from "@/lib/section-defaults";
import { TEMPLATE_REGISTRY } from "@/lib/templates";
import Link from "next/link";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import SectionRenderer from "@/components/common/SectionRenderer";
import ThemedSelect from "@/components/ui/ThemedSelect";

/**
 * PRODUCTION-GRADE UUID GENERATOR
 */
const generateId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
      <div className="grid grid-cols-6 sm:grid-cols-7 gap-1 p-1 max-h-[160px] overflow-y-auto bg-white border border-[#dcdcde]">
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

// --- Sortable Section Item ---
const SortableSection = ({
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
          <div {...attributes} {...listeners} style={{ touchAction: "none" }} aria-label={`Drag to reorder ${schema.name} section`} className="cursor-grab active:cursor-grabbing min-w-[36px] min-h-[40px] flex items-center justify-center text-[#8c8f94] hover:text-[#2271b1] shrink-0" title="Drag to reorder">
            <GripVertical className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center gap-2 select-none cursor-pointer min-w-0 py-2" onClick={() => onToggleExpand(section.id)}>
            <h3 className="text-[14px] font-semibold text-[#1d2327] break-words min-w-0 m-0">{schema.name}</h3>
            {!section.enabled && <span className="wp-pill wp-pill-sm wp-st-draft">Hidden</span>}
          </div>
        </div>

        <div className="flex items-center shrink-0 ml-auto">
           <button type="button" onClick={() => onMove(section.id, -1)} disabled={isFirst} className="min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#f0f0f1] text-[#646970] disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent" title="Move up" aria-label={`Move ${schema.name} section up`}>
              <ArrowUp className="w-4 h-4" aria-hidden="true" />
           </button>
           <button type="button" onClick={() => onMove(section.id, 1)} disabled={isLast} className="min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#f0f0f1] text-[#646970] disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent" title="Move down" aria-label={`Move ${schema.name} section down`}>
              <ArrowDown className="w-4 h-4" aria-hidden="true" />
           </button>
           <button type="button" onClick={() => onUpdate(section.id, null, !section.enabled)} className={`min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#f0f0f1] ${section.enabled ? 'text-[#00a32a]' : 'text-[#8c8f94]'}`} title={section.enabled ? "Disable" : "Enable"} aria-label={section.enabled ? `Hide ${schema.name} section` : `Show ${schema.name} section`}>
              {section.enabled ? <Eye className="w-4 h-4" aria-hidden="true" /> : <EyeOff className="w-4 h-4" aria-hidden="true" />}
           </button>
           <button type="button" onClick={() => onDuplicate(section)} className="min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#f0f0f1] text-[#2271b1]" title="Duplicate" aria-label={`Duplicate ${schema.name} section`}>
              <Copy className="w-4 h-4" aria-hidden="true" />
           </button>
           <button type="button" onClick={() => onDelete(section.id)} className="min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#fcf0f1] text-[#d63638]" title="Remove" aria-label={`Remove ${schema.name} section`}>
              <Trash2 className="w-4 h-4" aria-hidden="true" />
           </button>
           <button type="button" onClick={() => onToggleExpand(section.id)} className="min-w-[36px] min-h-[40px] flex items-center justify-center hover:bg-[#f0f0f1] text-[#646970]" aria-expanded={!!isExpanded} aria-label={isExpanded ? `Collapse ${schema.name} section` : `Expand ${schema.name} section`}>
              {isExpanded ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
           </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 sm:p-4 bg-white">
          <div>
            {schema.fields.filter(field => {
              // New showWhen system
              if (field.showWhen) {
                return config[field.showWhen.field] === field.showWhen.value;
              }
              // Legacy dependsOn system
              if (field.dependsOn) {
                const parentField = schema.fields.find(f => f.name === field.dependsOn);
                const fallbackVal = parentField?.default;
                const val = config[field.dependsOn] !== undefined ? config[field.dependsOn] : fallbackVal;
                return val === field.visibleIf;
              }
              return true;
            }).map((field) => (
              <div key={field.name} className="wp-field">
                <label className="wp-label">{field.label}</label>
                {renderField(field, config[field.name], (val) => onUpdate(section.id, { [field.name]: val }), onOpenMediaPicker)}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-[#f0f0f1] flex flex-wrap justify-between items-center gap-x-3 gap-y-1 wp-muted wp-small">
             <span className="break-all">Type: <code>{section.type}</code></span>
             <span className="break-all">ID: <code>{section.id.slice(0, 8)}…</code></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function PageBuilder({ initialPage }) {
  const { showConfirm } = usePopup();
  // Fill fields the page never stored with the section's built-in content so the admin can see and edit it.
  const [hydratedInitial] = useState(() => hydratePageDefaults(initialPage));
  const [page, setPage] = useState(hydratedInitial);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(new Date());
  const [activeTab, setActiveTab] = useState("content");
  const [expandedSections, setExpandedSections] = useState({});
  const [previewMode, setPreviewMode] = useState("desktop");
  const [mediaPicker, setMediaPicker] = useState({ open: false, onSelect: null });
  const [dynamicOptions, setDynamicOptions] = useState({ categories: [], products: [], blogs: [] });
  // UI only: whether the "Add section" picker dialog is open.
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  
  // PRODUCTION TRACKING: Avoid redundant autosaves
  const lastSavedRef = useRef(JSON.stringify(hydratedInitial));
  // Slug the page was loaded / last saved with. Autosave always sends this one, so a URL
  // change only goes live through a manual save after the "Change URL?" confirm.
  const savedSlugRef = useRef(hydratedInitial?.slug ?? null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catsRes, prodsRes, blogsRes] = await Promise.all([
          fetch("/api/admin/categories", { cache: "no-store" }),
          fetch("/api/admin/products", { cache: "no-store" }),
          fetch("/api/admin/blogs", { cache: "no-store" })
        ]);
        const [cats, prods, blogs] = await Promise.all([catsRes.json(), prodsRes.json(), blogsRes.json()]);
        setDynamicOptions({
          categories: Array.isArray(cats) ? cats.map(c => ({ label: c.name, value: c._id })) : [],
          products: Array.isArray(prods) ? prods.map(p => ({ label: p.name, value: p._id })) : [],
          blogs: Array.isArray(blogs) ? blogs.map(b => ({ label: b.title, value: b._id })) : []
        });
      } catch (err) { console.error("[PageBuilder] Dynamic options fetch failed", err); }
    };
    fetchData();
  }, []);

  // Manual saves toast "Page saved"; autosaves only update the quiet "Synced" indicator. Errors are always toasted.
  const savePage = useCallback(async (data = page, { manual = false } = {}) => {
    // Autosave never applies a slug edit: it keeps the saved slug in the payload
    const payload = manual || savedSlugRef.current == null ? data : { ...data, slug: savedSlugRef.current };
    const currentDataStr = JSON.stringify(payload);
    if (currentDataStr === lastSavedRef.current) { // SKIP: Already saved this state
      if (manual) toast.success("No changes to save", { id: 'save-toast' });
      return;
    }
    // Manual save of a changed URL (system page slugs are locked): confirm first; cancel saves nothing
    if (manual && !data.isSystem && !(await confirmSlugChange(showConfirm, {
      savedSlug: savedSlugRef.current,
      nextSlug: data.slug,
      normalize: normalizePageSlug,
      toPath: (slug) => `/${slug}`,
    }))) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/pages/${data._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: currentDataStr
      });
      if (res.ok) {
        const savedData = await res.json();
        const savedAt = new Date();
        const nextPage = { ...savedData, updatedAt: savedData?.updatedAt || savedAt.toISOString() };
        if (nextPage.slug) savedSlugRef.current = nextPage.slug;
        // An autosave keeps the admin's unsaved slug edit in the form (it wasn't sent)
        setPage(manual ? nextPage : (prev) => ({ ...nextPage, slug: prev?.slug ?? nextPage.slug }));
        lastSavedRef.current = JSON.stringify(nextPage);
        setLastSaved(savedAt);
        if (manual) toast.success("Page saved", { id: 'save-toast' });
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(`${manual ? "Save" : "Auto-save"} failed: ${errData.error || res.statusText || "Unknown error"}`, { id: 'save-toast' });
      }
    } catch (err) { 
        toast.error(`${manual ? "Save" : "Auto-save"} failed. Check your connection.`, { id: 'save-toast' }); 
    } finally { 
        setIsSaving(false); 
    }
  }, [page, showConfirm]);

  // Optimized Debounced Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      savePage(undefined, { manual: false });
    }, 4000); // 4s debounce for production stability
    return () => clearTimeout(timer);
  }, [page, savePage]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  const renderField = (field, value, onChange, onOpenMediaPicker) => {
    const inputClass = "wp-input wp-full";

    switch (field.type) {
      case "text":
        return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
      case "textarea":
        return <textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} className="wp-textarea wp-full" />;
      case "number":
        return (
          <input
            type="number"
            min={field.min !== undefined ? field.min : 0}
            max={field.max !== undefined ? field.max : undefined}
            step={field.step || "any"}
            placeholder={field.placeholder || ""}
            value={value !== undefined && value !== null ? value : (field.default !== undefined ? field.default : "")}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? "" : Number(v));
            }}
            className={inputClass}
          />
        );
      case "image":
        return (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="wp-input flex-1 min-w-0" placeholder="Image URL" aria-label="Image URL" />
              <button type="button" onClick={() => onOpenMediaPicker(onChange)} className="wp-btn shrink-0">Select Image</button>
            </div>
            {value && <div className="w-full aspect-video border border-[#dcdcde] bg-[#f6f7f7] overflow-hidden"><img src={value} alt="" className="w-full h-full object-cover" /></div>}
          </div>
        );
      case "icon":
        return <IconPicker value={value} onChange={onChange} />;
      case "select":
        return (
          <ThemedSelect value={value || field.default || ""} onChange={(e) => onChange(e.target.value)} className="wp-select wp-full">
            <option value="">— Select —</option>
            {(field.options === 'categories' ? dynamicOptions.categories : 
              field.options === 'products' ? dynamicOptions.products :
              field.options === 'blogs' ? dynamicOptions.blogs :
              Array.isArray(field.options) ? field.options : []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </ThemedSelect>
        );
      case "multiselect":
        const selected = Array.isArray(value) ? value : [];
        const opts = field.options === 'categories' ? dynamicOptions.categories : field.options === 'products' ? dynamicOptions.products : field.options === 'blogs' ? dynamicOptions.blogs : field.options || [];
        return (
          <div className="wp-checklist" style={{ maxHeight: 180, overflowY: "auto" }}>
            {opts.length === 0 && <span className="wp-muted">No options available</span>}
            {opts.map(opt => (
              <label key={opt.value} className="wp-check">
                <input
                  type="checkbox"
                  checked={selected.some(v => String(v) === String(opt.value))}
                  onChange={(e) => onChange(e.target.checked ? [...selected, opt.value] : selected.filter(v => String(v) !== String(opt.value)))}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        );
      case "repeater":
        const items = value || [];
        return (
          <div className="flex flex-col gap-2 bg-[#f6f7f7] p-2 sm:p-3 border border-[#dcdcde]">
            {items.map((item, index) => (
              <div key={index} className="bg-white border border-[#dcdcde]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f0f1] px-3 py-1 bg-[#f6f7f7]">
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

  const addSection = (type) => {
    const id = generateId();
    const newSec = { id, type, enabled: true, order: page.sections.length, config: {} };
    setPage(prev => ({ ...prev, sections: [...prev.sections, newSec] }));
    setExpandedSections(prev => ({ ...prev, [id]: true }));
    toast.success(`${SECTION_SCHEMAS[type]?.name || type} Added`);
  };

  const duplicateSection = (section) => {
    const id = generateId();
    // The copy goes right below the original.
    setPage(prev => {
      const at = prev.sections.findIndex(x => x.id === section.id);
      const next = [...prev.sections];
      next.splice(at + 1, 0, { ...JSON.parse(JSON.stringify(section)), id });
      return { ...prev, sections: next.map((x, i) => ({ ...x, order: i })) };
    });
    setExpandedSections(prev => ({ ...prev, [id]: true }));
    toast.success("Section duplicated");
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

  const toggleExpand = (id) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  const availableSections = Object.entries(SECTION_SCHEMAS)
    .filter(([type]) => {
      const templateConfig = TEMPLATE_REGISTRY[page.template || "default"];
      return !templateConfig || !templateConfig.allowedSections || templateConfig.allowedSections.includes(type);
    });

  return (
    <div className="min-h-screen bg-[#f0f0f1] text-[#1d2327] pb-10">
      {/* ── Builder toolbar ── */}
      <div className="bg-white border border-[#c3c4c7] sticky top-11 md:top-8 z-[90] flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 mb-4">
        <Link href="/admin/pages" className="wp-btn shrink-0">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Pages
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[18px] font-normal text-[#1d2327] m-0 truncate" title={page.title}>
            {page.title || "(no title)"}
          </h1>
          <p className="wp-muted wp-small m-0 flex items-center gap-1.5" role="status" aria-live="polite">
            {isSaving ? <Clock className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="w-3.5 h-3.5 text-[#00a32a]" aria-hidden="true" />}
            <span className="whitespace-nowrap">{isSaving ? "Syncing..." : `Synced: ${lastSaved.toLocaleTimeString()}`}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a href={page.slug === 'home' ? '/' : `/${page.slug}`} target="_blank" rel="noopener noreferrer" className="wp-btn">
            <ExternalLink className="w-4 h-4" aria-hidden="true" /> Live Page
          </a>
          <button type="button" onClick={() => savePage(undefined, { manual: true })} disabled={isSaving} className="wp-btn wp-btn-primary">
            <Save className="w-4 h-4" aria-hidden="true" /> {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:grid xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)_260px] gap-4 xl:gap-5 items-start min-w-0">

          {/* ── LEFT COLUMN: EDITOR ── */}
          <div className="flex flex-col gap-4 min-w-0 w-full">
             <section className="wp-postbox" aria-labelledby="builder-settings-title" style={{ marginBottom: 0 }}>
                <div className="wp-postbox-head"><h2 id="builder-settings-title">Page settings</h2></div>
                <div className="wp-inside">
                   <div className="wp-field">
                      <label htmlFor="builder-title" className="wp-label">Internal name</label>
                      <input id="builder-title" type="text" value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} className="wp-input wp-full" placeholder="e.g., About Us Page" />
                   </div>
                   <div className="flex flex-col sm:flex-row gap-3">
                      <div className="wp-field flex-1 min-w-0" style={{ marginBottom: 0 }}>
                         <label htmlFor="builder-slug" className="wp-label">URL slug</label>
                         <div className="flex items-center gap-1">
                            <span className="wp-muted" aria-hidden="true">/</span>
                            <input id="builder-slug" type="text" value={page.slug} readOnly={!!page.isSystem} aria-describedby={page.isSystem ? "builder-slug-locked" : undefined} onChange={(e) => setPage({ ...page, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} className="wp-input flex-1 min-w-0" style={{ fontFamily: "monospace" }} />
                         </div>
                         {page.isSystem && <p id="builder-slug-locked" className="wp-desc">System page: the slug is locked.</p>}
                      </div>
                      <div className="wp-field sm:w-32" style={{ marginBottom: 0 }}>
                         <label htmlFor="builder-status" className="wp-label">Status</label>
                         <ThemedSelect id="builder-status" value={page.status} onChange={(e) => setPage({ ...page, status: e.target.value })} className="wp-select wp-full">
                            <option value="Draft">Draft</option>
                            <option value="Published">Published</option>
                         </ThemedSelect>
                      </div>
                   </div>
                </div>
             </section>

             <div>
               <div className="wp-tabs" role="tablist" aria-label="Builder panels" style={{ marginBottom: 12 }}>
                  <button type="button" role="tab" id="builder-tab-content" aria-selected={activeTab === 'content'} aria-controls="builder-panel" onClick={() => setActiveTab("content")} className="wp-tab">Sections</button>
                  <button type="button" role="tab" id="builder-tab-seo" aria-selected={activeTab === 'seo'} aria-controls="builder-panel" onClick={() => setActiveTab("seo")} className="wp-tab">SEO &amp; Social</button>
               </div>

               <div id="builder-panel" role="tabpanel" aria-labelledby={activeTab === 'content' ? "builder-tab-content" : "builder-tab-seo"}>
               {activeTab === 'content' ? (
                  <div className="flex flex-col gap-3">
                     <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={page.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                           <div>
                              {page.sections.length === 0 && (
                                 <div className="wp-empty border border-dashed border-[#c3c4c7] bg-white p-6 text-center">
                                    <LayoutGrid className="w-8 h-8 text-[#c3c4c7] mx-auto mb-2" aria-hidden="true" />
                                    <p className="wp-muted m-0">No sections added yet.</p>
                                 </div>
                              )}
                              {page.sections.map((s, idx) => (
                                 <SortableSection key={s.id} section={s} isFirst={idx === 0} isLast={idx === page.sections.length - 1} onMove={moveSection} isExpanded={expandedSections[s.id]} onToggleExpand={toggleExpand} onUpdate={updateSection} onDelete={async (id) => { if (await showConfirm("Are you sure you want to remove this section? This cannot be undone.", "Remove section", { confirmText: "Remove", danger: true })) setPage(p => ({ ...p, sections: p.sections.filter(x => x.id !== id) })); }} onDuplicate={duplicateSection} onOpenMediaPicker={(cb) => setMediaPicker({ open: true, onSelect: cb })} renderField={renderField} />
                              ))}
                           </div>
                        </SortableContext>
                     </DndContext>
                     <button type="button" onClick={() => setSectionPickerOpen(true)} className="wp-btn self-start" aria-haspopup="dialog">
                        <Plus className="w-4 h-4" aria-hidden="true" /> Add section
                     </button>
                  </div>
               ) : (
                  <section className="wp-postbox" aria-label="SEO and social settings" style={{ marginBottom: 0 }}>
                     <div className="wp-inside">
                        <div className="wp-field">
                           <label htmlFor="builder-seo-title" className="wp-label">Meta title</label>
                           <input id="builder-seo-title" type="text" value={page.seo?.title || ""} onChange={(e) => setPage({ ...page, seo: { ...page.seo, title: e.target.value } })} className="wp-input wp-full" />
                           <p className="wp-desc">Recommended: 50–60 characters.</p>
                        </div>
                        <div className="wp-field">
                           <label htmlFor="builder-seo-desc" className="wp-label">Meta description</label>
                           <textarea id="builder-seo-desc" value={page.seo?.description || ""} onChange={(e) => setPage({ ...page, seo: { ...page.seo, description: e.target.value } })} className="wp-textarea wp-full" rows={4} />
                           <p className="wp-desc">Recommended: 150–160 characters.</p>
                        </div>
                        <div className="wp-field" style={{ marginBottom: 0 }}>
                           <span className="wp-label" id="builder-og-label">Open Graph image</span>
                           <button type="button" aria-labelledby="builder-og-label" onClick={() => setMediaPicker({ open: true, onSelect: (url) => setPage(prev => ({ ...prev, seo: { ...(prev.seo || {}), ogImage: url } })) })} className="w-full aspect-video bg-[#f6f7f7] border border-dashed border-[#c3c4c7] flex flex-col items-center justify-center cursor-pointer hover:border-[#2271b1] overflow-hidden relative p-0">
                              {page.seo?.ogImage ? <img src={page.seo.ogImage} alt="" className="w-full h-full object-cover" /> : <span className="wp-link">Select preview image</span>}
                           </button>
                        </div>
                     </div>
                  </section>
               )}
               </div>
             </div>
          </div>

          {/* ── CENTER COLUMN: PREVIEW CANVAS ── */}
          <div className="flex flex-col min-w-0 w-full bg-white border border-[#c3c4c7] overflow-hidden relative min-h-[500px] xl:min-h-[800px]">
             <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
                <span className="wp-muted wp-small flex items-center gap-1.5">
                   <span className="w-2 h-2 bg-[#00a32a] rounded-full shrink-0" aria-hidden="true" />
                   Live preview
                </span>
                <div className="wp-seg" role="group" aria-label="Preview device">
                   {[ 
                       {id:'desktop', icon: Monitor, label: 'Desktop'}, 
                       {id:'tablet', icon: Tablet, label: 'Tablet'}, 
                       {id:'mobile', icon: Smartphone, label: 'Mobile'}
                   ].map(m => (
                      <button key={m.id} type="button" onClick={() => setPreviewMode(m.id)} aria-pressed={previewMode === m.id} aria-label={m.label} className="flex items-center gap-1.5">
                         <m.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                         <span className="hidden sm:inline">{m.label}</span>
                      </button>
                   ))}
                </div>
             </div>

             <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f0f0f1] p-2 sm:p-4 flex justify-center items-start">
                <div className={`builder-preview bg-white transition-all duration-500 origin-top max-w-full ${previewMode === 'desktop' ? 'w-full' : previewMode === 'tablet' ? 'w-[768px]' : 'w-[375px]'} min-h-full border border-[#dcdcde] overflow-hidden`}>
                   <SectionRenderer sections={page.sections} />
                </div>
             </div>
          </div>

          {/* ── RIGHT COLUMN: PUBLICATION INFO ── */}
          <div className="flex flex-col gap-4 min-w-0 w-full">
             <section className="wp-postbox" aria-labelledby="builder-pub-title" style={{ marginBottom: 0 }}>
                <div className="wp-postbox-head"><h2 id="builder-pub-title">Publish</h2></div>
                <div className="wp-misc">
                   <div className="wp-misc-row">
                      <span className="wp-muted">Auto-save:</span>
                      <strong className="wp-strong" style={{ color: "#00a32a" }}>Enabled</strong>
                   </div>
                   <div className="wp-misc-row">
                      <span className="wp-muted">Last modified:</span>
                      <strong className="wp-strong">{page.updatedAt ? new Date(page.updatedAt).toLocaleString() : "—"}</strong>
                   </div>
                </div>
             </section>

             <div className="wp-notice wp-notice-warning" style={{ margin: 0 }}>
                <p>Changes made in the builder are live in the preview but only affect the production site after status is set to <strong>Published</strong>.</p>
             </div>
          </div>
      </div>

      {/* ── Add section picker ── */}
      {sectionPickerOpen && (
        <div className="wp-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setSectionPickerOpen(false); }}>
          <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="builder-add-section-title">
            <div className="wp-modal-head">
              <h2 id="builder-add-section-title">Add section</h2>
              <button type="button" onClick={() => setSectionPickerOpen(false)} className="wp-notice-dismiss" aria-label="Close add section dialog"><X className="w-5 h-5" aria-hidden="true" /></button>
            </div>
            <div className="wp-modal-body">
              {availableSections.length === 0 ? (
                <p className="wp-muted m-0">No sections are available for this template.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableSections.map(([type, s]) => (
                    <button key={type} type="button" onClick={() => { addSection(type); setSectionPickerOpen(false); }} className="wp-btn justify-start text-left" style={{ minHeight: 40 }}>
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
        <MediaPickerModal
          open={mediaPicker.open}
          onClose={() => setMediaPicker({ open: false, onSelect: null })}
          onSelect={(item) => {
            // The picker returns a media object (or an array when multiple); fields store its URL.
            const media = Array.isArray(item) ? item[0] : item;
            const url = typeof media === "string" ? media : media?.url;
            if (url && mediaPicker.onSelect) mediaPicker.onSelect(url);
            setMediaPicker({ open: false, onSelect: null });
          }}
          title="Enterprise Asset Library"
        />
      )}
    </div>
  );
}

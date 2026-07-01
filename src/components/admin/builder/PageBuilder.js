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
  LayoutGrid
} from "lucide-react";
import { toast } from "react-hot-toast";
import { SECTION_SCHEMAS } from "@/lib/section-schemas";
import { TEMPLATE_REGISTRY } from "@/lib/templates";
import Link from "next/link";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import SectionRenderer from "@/components/common/SectionRenderer";

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
    <div className="flex flex-col gap-2 border border-[#ccd0d4] bg-[#f6f7f7] p-2 rounded-sm">
      <div className="flex items-center gap-3 p-2 bg-white border border-[#ccd0d4] rounded-sm">
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
      <div className="grid grid-cols-7 gap-1 p-1 max-h-[140px] overflow-y-auto bg-white border border-[#ccd0d4]">
        {filteredIcons.map(iconName => {
          const ItemIcon = LucideIcons[iconName];
          if (!ItemIcon) return null;
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
}

// --- Sortable Section Item ---
const SortableSection = ({
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
    <div ref={setNodeRef} style={style} className={`bg-white border border-[#ccd0d4] mb-2 shadow-sm ${!section.enabled ? 'opacity-60' : ''}`}>
      <div className="px-3 py-2 border-b border-[#ccd0d4] flex items-center justify-between bg-[#f6f7f7] hover:bg-white transition-colors">
        <div className="flex items-center gap-3 flex-1">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-[#646970] hover:text-[#2271b1]">
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 select-none" onClick={() => onToggleExpand(section.id)}>
            <h3 className="text-[13px] font-bold text-[#1d2327]">{schema.name}</h3>
            {!section.enabled && <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter">Hidden</span>}
          </div>
        </div>

        <div className="flex items-center gap-1">
           <button onClick={() => onUpdate(section.id, null, !section.enabled)} className={`p-1.5 rounded hover:bg-gray-100 ${section.enabled ? 'text-green-600' : 'text-gray-400'}`} title={section.enabled ? "Disable" : "Enable"}>
              {section.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
           </button>
           <button onClick={() => onDuplicate(section)} className="p-1.5 rounded hover:bg-gray-100 text-[#2271b1]" title="Duplicate">
              <Copy className="w-4 h-4" />
           </button>
           <button onClick={() => onDelete(section.id)} className="p-1.5 rounded hover:bg-red-50 text-[#d63638]" title="Remove">
              <Trash2 className="w-4 h-4" />
           </button>
           <button onClick={() => onToggleExpand(section.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
           </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-white border-t border-[#f0f0f1]">
          <div className="grid grid-cols-1 gap-6">
            {schema.fields.filter(field => field.dependsOn ? config[field.dependsOn] === field.visibleIf : true).map((field) => (
              <div key={field.name} className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{field.label}</label>
                {renderField(field, config[field.name], (val) => onUpdate(section.id, { [field.name]: val }), onOpenMediaPicker)}
              </div>
            ))}
          </div>
          <div className="mt-6 pt-3 border-t border-gray-100 flex justify-between items-center opacity-40">
             <span className="text-[9px] font-mono tracking-tighter">TYPE: {section.type}</span>
             <span className="text-[9px] font-mono tracking-tighter uppercase">ID: {section.id.slice(0, 8)}...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function PageBuilder({ initialPage }) {
  const [page, setPage] = useState(initialPage);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(new Date());
  const [activeTab, setActiveTab] = useState("content");
  const [expandedSections, setExpandedSections] = useState({});
  const [previewMode, setPreviewMode] = useState("desktop");
  const [mediaPicker, setMediaPicker] = useState({ open: false, onSelect: null });
  const [dynamicOptions, setDynamicOptions] = useState({ categories: [], products: [], blogs: [] });
  
  // PRODUCTION TRACKING: Avoid redundant autosaves
  const lastSavedRef = useRef(JSON.stringify(initialPage));

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("[PageBuilder] Fetching dynamic options...");
        const [catsRes, prodsRes, blogsRes] = await Promise.all([
          fetch("/api/admin/categories"),
          fetch("/api/admin/products"),
          fetch("/api/admin/blogs")
        ]);
        console.log("[PageBuilder] Responses received status:", catsRes.status, prodsRes.status, blogsRes.status);
        const [cats, prods, blogs] = await Promise.all([catsRes.json(), prodsRes.json(), blogsRes.json()]);
        console.log("[PageBuilder] Data parsed:", Array.isArray(cats) ? cats.length : typeof cats, Array.isArray(prods) ? prods.length : typeof prods, Array.isArray(blogs) ? blogs.length : typeof blogs);
        setDynamicOptions({
          categories: Array.isArray(cats) ? cats.map(c => ({ label: c.name, value: c._id })) : [],
          products: Array.isArray(prods) ? prods.map(p => ({ label: p.name, value: p.slug || p._id })) : [],
          blogs: Array.isArray(blogs) ? blogs.map(b => ({ label: b.title, value: b._id })) : []
        });
      } catch (err) { console.error("[PageBuilder] Dynamic options fetch failed", err); }
    };
    fetchData();
  }, []);

  const savePage = useCallback(async (data = page) => {
    const currentDataStr = JSON.stringify(data);
    if (currentDataStr === lastSavedRef.current) return; // SKIP: Already saved this state

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/pages/${data._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: currentDataStr
      });
      if (res.ok) {
        lastSavedRef.current = currentDataStr;
        setLastSaved(new Date());
        toast.success("Changes Saved Automatically", { id: 'save-toast' });
      }
    } catch (err) { 
        toast.error("Auto-save sync failed. Check your connection."); 
    } finally { 
        setIsSaving(false); 
    }
  }, [page]);

  // Optimized Debounced Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      savePage();
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
    const inputClass = "w-full border border-[#8c8f94] px-2 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white transition-all rounded-sm";

    switch (field.type) {
      case "text":
        return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
      case "textarea":
        return <textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${inputClass} resize-none`} />;
      case "number":
        return <input type="number" value={value || 0} onChange={(e) => onChange(Number(e.target.value))} className={inputClass} />;
      case "image":
        return (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} placeholder="External URL or Pick Asset..." />
              <button onClick={() => onOpenMediaPicker(onChange)} className="px-4 bg-white border border-[#2271b1] text-[#2271b1] text-[11px] font-bold uppercase hover:bg-[#f0f6fa] shrink-0 rounded-sm">Pick Asset</button>
            </div>
            {value && <div className="w-full aspect-video border border-gray-100 rounded bg-gray-50 overflow-hidden"><img src={value} className="w-full h-full object-cover" /></div>}
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
      case "multiselect":
        const selected = Array.isArray(value) ? value : [];
        const opts = field.options === 'categories' ? dynamicOptions.categories : field.options === 'products' ? dynamicOptions.products : field.options === 'blogs' ? dynamicOptions.blogs : field.options || [];
        console.log("[PageBuilder] RENDER MULTISELECT:", field.name, "selected:", selected, "options count:", opts.length, "options:", opts);
        return (
          <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto p-2 border border-[#8c8f94] bg-white rounded-sm">
            {opts.length === 0 && <span className="text-[11px] text-gray-400 italic p-2">No options available</span>}
            {opts.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 text-[13px] hover:bg-gray-50 px-2 py-1 cursor-pointer transition-colors rounded">
                <input type="checkbox" className="rounded-sm border-gray-300 text-[#2271b1] focus:ring-[#2271b1]" checked={selected.includes(opt.value)} onChange={(e) => onChange(e.target.checked ? [...selected, opt.value] : selected.filter(v => v !== opt.value))} />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        );
      case "repeater":
        const items = value || [];
        return (
          <div className="space-y-3 bg-[#f0f0f1] p-3 border border-[#ccd0d4] rounded-sm">
            {items.map((item, index) => (
              <div key={index} className="bg-white border border-[#ccd0d4] p-3 relative shadow-sm rounded-sm">
                <div className="flex items-center justify-between border-b border-[#f0f0f1] pb-2 mb-3">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">SUB-ITEM {index + 1}</span>
                  <button onClick={() => { const n = [...items]; n.splice(index, 1); onChange(n); }} className="text-[#d63638] text-[10px] font-bold hover:underline">REMOVE</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {field.fields.map(sf => (
                    <div key={sf.name} className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-600">{sf.label}</label>
                      {renderField(sf, item[sf.name], (v) => { const n = [...items]; n[index] = { ...item, [sf.name]: v }; onChange(n); }, onOpenMediaPicker)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => onChange([...items, {}])} className="w-full py-2 bg-white border border-[#2271b1] text-[#2271b1] text-[10px] font-black uppercase tracking-widest hover:bg-[#2271b1] hover:text-white transition-all rounded-sm">+ Add Item</button>
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
    const newSec = { ...JSON.parse(JSON.stringify(section)), id, order: page.sections.length };
    setPage(prev => ({ ...prev, sections: [...prev.sections, newSec] }));
    setExpandedSections(prev => ({ ...prev, [id]: true }));
    toast.success("Section duplicated");
  };

  const toggleExpand = (id) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen bg-[#f0f0f1] text-[#1d2327] font-sans pb-40">
      {/* ── Admin Bar ── */}
      <div className="bg-[#1d2327] h-8 flex items-center px-4 justify-between sticky top-0 z-[100]">
        <div className="flex items-center gap-4">
          <Link href="/admin/pages" className="text-[#c3c4c7] hover:text-[#72aee6] text-[11px] font-medium flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back to List
          </Link>
          <div className="w-px h-3 bg-white/10" />
          <span className="text-[#72aee6] text-[11px] font-bold uppercase tracking-wider">{page.title}</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-[#c3c4c7]">
             {isSaving ? <Clock className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-green-500" />}
             <span className="text-[10px] font-black uppercase tracking-tighter">{isSaving ? "Syncing..." : `Synced: ${lastSaved.toLocaleTimeString()}`}</span>
          </div>
          <a href={`/${page.slug}`} target="_blank" className="text-[#c3c4c7] hover:text-[#72aee6] text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-white/10 px-2 py-0.5 rounded transition-all">
            <ExternalLink className="w-3 h-3" /> Live Page
          </a>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-[420px,1fr,300px] gap-8">
          
          {/* ── LEFT COLUMN: ARCHITECTURAL EDITOR ── */}
          <div className="flex flex-col gap-6">
             <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-sm">
                <div className="px-4 py-2 border-b border-[#ccd0d4] bg-[#f6f7f7] font-black text-[10px] uppercase tracking-[0.2em] text-gray-500">Core Page Settings</div>
                <div className="p-4 space-y-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Internal Name</label>
                      <input type="text" value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} className="w-full text-lg font-bold border-none p-0 focus:ring-0 placeholder:text-gray-200" placeholder="e.g., About Us Page" />
                   </div>
                   <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 uppercase">URL Slug</label>
                         <div className="flex items-center border border-gray-300 rounded-sm bg-gray-50 px-2">
                            <span className="text-gray-400 text-[11px]">/</span>
                            <input type="text" value={page.slug} onChange={(e) => setPage({ ...page, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} className="w-full border-none bg-transparent py-1.5 text-[12px] font-medium focus:ring-0" />
                         </div>
                      </div>
                      <div className="w-24 space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 uppercase">Status</label>
                         <select value={page.status} onChange={(e) => setPage({ ...page, status: e.target.value })} className="w-full border border-gray-300 py-1.5 text-[12px] font-bold rounded-sm focus:ring-0 cursor-pointer">
                            <option value="Draft">Draft</option>
                            <option value="Published">Published</option>
                         </select>
                      </div>
                   </div>
                </div>
             </div>

             <div className="flex border border-[#ccd0d4] bg-white shadow-sm rounded-sm overflow-hidden">
                <button onClick={() => setActiveTab("content")} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${activeTab === 'content' ? 'border-[#2271b1] text-[#2271b1] bg-white' : 'border-transparent text-gray-400 bg-[#f6f7f7]'}`}>Section Manager</button>
                <button onClick={() => setActiveTab("seo")} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${activeTab === 'seo' ? 'border-[#2271b1] text-[#2271b1] bg-white' : 'border-transparent text-gray-400 bg-[#f6f7f7]'}`}>SEO & Social</button>
             </div>

             {activeTab === 'content' ? (
                <div className="space-y-4">
                   <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={page.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                         <div className="space-y-2">
                            {page.sections.length === 0 && (
                               <div className="p-12 border-2 border-dashed border-gray-200 rounded text-center space-y-2 bg-white">
                                  <LayoutGrid className="w-8 h-8 text-gray-200 mx-auto" />
                                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">No Sections Added Yet</p>
                               </div>
                            )}
                            {page.sections.map((s) => (
                               <SortableSection key={s.id} section={s} isExpanded={expandedSections[s.id]} onToggleExpand={toggleExpand} onUpdate={updateSection} onDelete={(id) => { if(confirm("Are you sure you want to remove this section? This cannot be undone.")) setPage(p => ({ ...p, sections: p.sections.filter(x => x.id !== id) })); }} onDuplicate={duplicateSection} onOpenMediaPicker={(cb) => setMediaPicker({ open: true, onSelect: cb })} renderField={renderField} />
                            ))}
                         </div>
                      </SortableContext>
                   </DndContext>
                   <div className="bg-white border border-[#ccd0d4] p-4 rounded-sm shadow-sm">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 border-b border-gray-100 pb-2">Add Content Module</h4>
                      <div className="grid grid-cols-2 gap-2">
                         {Object.entries(SECTION_SCHEMAS)
                           .filter(([type]) => {
                             const templateConfig = TEMPLATE_REGISTRY[page.template || "default"];
                             return !templateConfig || !templateConfig.allowedSections || templateConfig.allowedSections.includes(type);
                           })
                           .map(([type, s]) => (
                            <button key={type} onClick={() => addSection(type)} className="text-left px-3 py-2.5 bg-[#f6f7f7] border border-[#ccd0d4] text-[10px] font-bold uppercase tracking-wider hover:bg-white hover:border-[#2271b1] hover:text-[#2271b1] transition-all rounded-sm flex items-center gap-2"><Plus className="w-3 h-3" /> {s.name}</button>
                         ))}
                      </div>
                   </div>
                </div>
             ) : (
                <div className="space-y-4">
                   <div className="bg-white border border-[#ccd0d4] p-4 space-y-6 rounded-sm shadow-sm">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#646970]">Meta Title</label>
                         <input type="text" value={page.seo?.title || ""} onChange={(e) => setPage({ ...page, seo: { ...page.seo, title: e.target.value } })} className="w-full border border-[#ccd0d4] p-2 text-[13px] font-medium outline-none focus:border-[#2271b1]" placeholder="Recommended: 50-60 characters" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#646970]">Meta Description</label>
                         <textarea value={page.seo?.description || ""} onChange={(e) => setPage({ ...page, seo: { ...page.seo, description: e.target.value } })} className="w-full border border-[#ccd0d4] p-2 text-[13px] resize-none outline-none focus:border-[#2271b1]" rows={4} placeholder="Recommended: 150-160 characters" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#646970]">Open Graph Image</label>
                         <div onClick={() => setMediaPicker({ open: true, onSelect: (url) => setPage({ ...page, seo: { ...page.seo, ogImage: url } }) })} className="aspect-video bg-[#f6f7f7] border-2 border-dashed border-[#ccd0d4] flex flex-col items-center justify-center cursor-pointer hover:bg-white transition-all overflow-hidden relative rounded-sm">
                            {page.seo?.ogImage ? <img src={page.seo.ogImage} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-[#2271b1] uppercase tracking-widest">Select Preview Image</span>}
                         </div>
                      </div>
                   </div>
                </div>
             )}
          </div>

          {/* ── CENTER COLUMN: PRODUCTION PREVIEW ── */}
          <div className="flex flex-col h-full bg-gray-200 border border-[#ccd0d4] overflow-hidden rounded-xl shadow-2xl relative min-h-[800px]">
             <div className="bg-white border-b border-[#ccd0d4] px-5 py-3.5 flex items-center justify-between shrink-0 z-20">
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[9px] uppercase font-black border border-green-200">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      Production Sync Active
                   </div>
                </div>
                
                <div className="flex items-center bg-[#f0f0f1] p-1 rounded-lg border border-[#ccd0d4]">
                   {[ 
                       {id:'desktop', icon: Monitor, label: 'Desktop'}, 
                       {id:'tablet', icon: Tablet, label: 'Tablet'}, 
                       {id:'mobile', icon: Smartphone, label: 'Mobile'}
                   ].map(m => (
                      <button key={m.id} onClick={() => setPreviewMode(m.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all ${previewMode === m.id ? 'bg-white shadow-sm text-[#2271b1]' : 'text-gray-400 hover:text-black'}`}>
                         <m.icon className="w-4 h-4" />
                         <span className="text-[10px] font-bold uppercase tracking-tighter">{m.label}</span>
                      </button>
                   ))}
                </div>
             </div>

             <div className="flex-1 overflow-y-auto bg-[#f0f0f1] p-8 flex justify-center items-start scrollbar-hide">
                <div className={`bg-white shadow-2xl transition-all duration-700 ease-[0.22, 1, 0.36, 1] origin-top ${previewMode === 'desktop' ? 'w-full' : previewMode === 'tablet' ? 'w-[768px]' : 'w-[375px]'} min-h-full rounded-2xl overflow-hidden ring-1 ring-black/5`}>
                   <SectionRenderer sections={page.sections} />
                </div>
             </div>
          </div>

          {/* ── RIGHT COLUMN: SYSTEM METADATA ── */}
          <div className="flex flex-col gap-4">
             <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-sm">
                <div className="px-3 py-2 border-b border-[#ccd0d4] bg-[#f6f7f7] font-black text-[10px] uppercase tracking-widest text-gray-500">Publication Information</div>
                <div className="p-4 space-y-4">
                   <div className="space-y-3">
                      <div className="flex items-center justify-between text-[11px]">
                         <span className="text-gray-400 font-medium">Auto-Save:</span>
                         <span className="text-green-600 font-black">ENABLED</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                         <span className="text-gray-400 font-medium">Revisions:</span>
                         <span className="text-gray-600 font-bold">14 Active</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                         <span className="text-gray-400 font-medium">Last Modified:</span>
                         <span className="text-gray-600 font-bold">{new Date(page.updatedAt).toLocaleDateString()}</span>
                      </div>
                   </div>
                   <button onClick={() => savePage()} disabled={isSaving} className="w-full bg-[#2271b1] text-white py-2.5 rounded-sm text-[11px] font-black uppercase tracking-[0.2em] hover:bg-[#135e96] shadow-[0_1px_0_#135e96] active:translate-y-px transition-all disabled:opacity-50">
                      {isSaving ? "Syncing Logic..." : "Force Commit"}
                   </button>
                </div>
             </div>

             <div className="bg-orange-50 border border-orange-200 p-4 rounded-sm flex gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Enterprise Note</p>
                   <p className="text-[11px] text-orange-700/80 leading-relaxed font-medium">Changes made in the builder are live in the preview but only affect the production site after status is set to <strong>PUBLISHED</strong>.</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {mediaPicker.open && (
        <MediaPickerModal onClose={() => setMediaPicker({ open: false, onSelect: null })} onSelect={(url) => { mediaPicker.onSelect(url); setMediaPicker({ open: false, onSelect: null }); }} title="Enterprise Asset Library" />
      )}
    </div>
  );
}

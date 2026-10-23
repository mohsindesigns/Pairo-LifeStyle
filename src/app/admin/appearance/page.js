"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Palette,
  Plus,
  Copy,
  Trash2,
  ExternalLink,
  Eye,
  Type,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader, Postbox, Skeleton } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";

// Read a JSON error message from a failed response, falling back to `fallback`.
async function errorMessage(res, fallback) {
  try {
    const data = await res.json();
    return data?.error || data?.message || fallback;
  } catch {
    return fallback;
  }
}

export default function AppearanceManagement() {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTheme, setEditingTheme] = useState(null);
  // JSON snapshot of the config when the customizer was opened (dirty check).
  const originalConfigRef = useRef(null);
  const { showConfirm, showPrompt } = usePopup();

  const SUPPORTED_FONTS = [
    "Inter",
    "Space Grotesk",
    "Manrope",
    "Outfit",
    "Playfair Display",
    "Roboto",
    "Lora",
    "Poppins",
    "Montserrat",
    "Open Sans",
    "Lato",
    "Oswald",
    "Raleway",
    "Nunito",
    "Ubuntu"
  ];

  const fetchThemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/themes");
      const data = await res.json();
      if (res.ok) setThemes(data);
    } catch (err) {
      toast.error("Failed to load themes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchThemes();
    });
  }, [fetchThemes]);

  const activateTheme = async (id) => {
    try {
      const res = await fetch("/api/admin/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACTIVATE", id })
      });
      if (res.ok) {
        toast.success("Theme activated successfully");
        fetchThemes();
      } else {
        toast.error(await errorMessage(res, "Activation failed"));
      }
    } catch (err) {
      toast.error("Activation failed");
    }
  };

  const duplicateTheme = async (theme, newName) => {
    try {
      const { _id, isActive, isSystem, createdAt, updatedAt, ...configOnly } = theme;
      const res = await fetch("/api/admin/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...configOnly, 
          name: newName || `${theme.name} (Copy)`, 
          slug: `${theme.slug}-copy-${Date.now()}`,
          isActive: false,
          isSystem: false
        })
      });
      if (res.ok) {
        toast.success(newName ? "Theme created" : "Theme duplicated");
        fetchThemes();
      } else {
        toast.error(await errorMessage(res, "Duplication failed"));
      }
    } catch (err) {
      toast.error("Duplication failed");
    }
  };

  // "Add New Theme": a new theme is a named copy of the active (or default) theme.
  const addNewTheme = async () => {
    const base = themes.find(t => t.isActive) || themes.find(t => t.isSystem) || themes[0];
    if (!base) {
      toast.error("No theme available to start from");
      return;
    }
    const name = await showPrompt(
      `The new theme starts as a copy of "${base.name}".`,
      `${base.name} (Copy)`,
      "Add new theme",
      { inputLabel: "Theme name", confirmText: "Create theme" }
    );
    if (name === null || name === undefined) return;
    const trimmed = String(name).trim();
    if (!trimmed) {
      toast.error("Theme name is required");
      return;
    }
    duplicateTheme(base, trimmed);
  };

  const deleteTheme = async (theme) => {
    if (theme.isSystem || theme.isActive) return;
    const ok = await showConfirm(
      `Delete the theme "${theme.name}"? This cannot be undone.`,
      "Delete theme",
      { confirmText: "Delete", danger: true }
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/themes/${theme._id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Theme deleted");
        fetchThemes();
      } else {
        toast.error(await errorMessage(res, "Delete failed"));
      }
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const openCustomizer = (theme) => {
    originalConfigRef.current = JSON.stringify(theme.config);
    setEditingTheme(theme);
  };

  const closeCustomizer = useCallback(async () => {
    if (!editingTheme) return;
    const dirty = JSON.stringify(editingTheme.config) !== originalConfigRef.current;
    if (dirty) {
      const ok = await showConfirm(
        "You have unsaved colour or font changes. Close the customizer and discard them?",
        "Discard changes?",
        { confirmText: "Discard changes", danger: true }
      );
      if (!ok) return;
    }
    setEditingTheme(null);
  }, [editingTheme, showConfirm]);

  // Escape closes the customizer (same path as the X button).
  useEffect(() => {
    if (!editingTheme) return;
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // Leave Escape alone while a popup (e.g. the discard confirm) is open.
      if (document.getElementById("global-popup-title")) return;
      closeCustomizer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingTheme, closeCustomizer]);

  const saveThemeChanges = async () => {
    if (editingTheme.isSystem) {
      toast.error("System themes cannot be modified. Please duplicate it first.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/themes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTheme._id, config: editingTheme.config })
      });
      if (res.ok) {
        toast.success("Theme updated successfully");
        fetchThemes();
        setEditingTheme(null);
      } else {
        toast.error(await errorMessage(res, "Update failed"));
      }
    } catch (err) {
      toast.error("Failed to save changes");
    }
  };

  if (loading) return (
    <Page>
      <PageHeader title="Appearance" />
      <div className="wp-postbox wp-inside space-y-3" aria-busy="true">
        <span className="sr-only">Loading appearance settings...</span>
        <Skeleton height={140} width="100%" />
        <Skeleton height={20} width="40%" />
      </div>
    </Page>
  );

  const colorRow = (key, value) => (
    <div key={key} className="flex items-center gap-2 py-1.5 border-b border-[#f0f0f1] last:border-b-0">
      <label htmlFor={`theme-color-${key}`} className="flex-1 min-w-0 capitalize text-[#1d2327]">{key}</label>
      <span
        className="relative w-[30px] h-[30px] max-[782px]:w-10 max-[782px]:h-10 border border-[#8c8f94] rounded-[3px] overflow-hidden shrink-0 focus-within:shadow-[0_0_0_2px_#2271b1]"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, colors: {...editingTheme.config.colors, [key]: e.target.value}}})}
          aria-label={`${key} colour picker`}
          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
        />
      </span>
      <input
        id={`theme-color-${key}`}
        type="text"
        value={value}
        onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, colors: {...editingTheme.config.colors, [key]: e.target.value}}})}
        className="wp-input font-mono uppercase w-[96px] shrink-0"
        spellCheck={false}
      />
    </div>
  );

  return (
    <RequirePermission permission="settings.view">
    <Page>
      <PageHeader
        title="Appearance"
        actions={<span className="wp-muted">Manage your site&apos;s visual identity</span>}
      />
      <div className="wp-cols">

        {/* Main Content: Theme List */}
        <div className="wp-col-main">
          <h2 className="sr-only">Themes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {themes.map((theme) => (
              <div
                key={theme._id}
                className={`bg-white border ${theme.isActive ? 'border-[#1d2327]' : 'border-[#c3c4c7]'} shadow-[0_1px_1px_rgba(0,0,0,0.04)] flex flex-col min-w-0`}
              >
                {/* Visual Preview Area (storefront colours) */}
                <div className="aspect-[16/10] bg-[#f0f0f1] relative group border-b border-[#dcdcde]">
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div
                      className="w-12 h-12 rounded-full border-2 border-white shadow-md mb-3"
                      style={{ background: `linear-gradient(45deg, ${theme.config.colors.background} 50%, ${theme.config.colors.primary} 50%)` }}
                      aria-hidden="true"
                    />
                    <span className="wp-muted">Heading font: {theme.config.typography.headingFont}</span>
                  </div>

                  {/* WP-Style Actions (always visible on touch, hover/focus on desktop) */}
                  <div className="absolute inset-0 bg-white/90 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-2 p-2">
                     {!theme.isActive && (
                        <button
                          type="button"
                          onClick={() => activateTheme(theme._id)}
                          className="wp-btn"
                          aria-label={`Activate ${theme.name}`}
                        >
                          Activate
                        </button>
                     )}
                     <button
                      type="button"
                      onClick={() => openCustomizer(theme)}
                      className="wp-btn wp-btn-primary"
                      aria-label={`Customize ${theme.name}`}
                     >
                       Customize
                     </button>
                  </div>
                </div>

                {/* Info Bar */}
                <div className={`px-3 py-2 flex items-center gap-2 min-h-[48px] ${theme.isActive ? 'bg-[#1d2327] text-white' : 'bg-white'}`}>
                  <h3 className={`flex-1 min-w-0 truncate m-0 text-[14px] font-semibold ${theme.isActive ? 'text-white' : 'text-[#1d2327]'}`}>
                    {theme.isActive && <span className="font-normal">Active: </span>}{theme.name}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => duplicateTheme(theme)} className={`inline-flex items-center justify-center w-[30px] h-[30px] max-[782px]:w-10 max-[782px]:h-10 rounded-[3px] ${theme.isActive ? 'text-[#72aee6] hover:bg-white/10' : 'text-[#2271b1] hover:bg-[#f0f0f1]'}`} title="Duplicate" aria-label={`Duplicate ${theme.name}`}>
                      <Copy className="w-4 h-4" aria-hidden="true" />
                    </button>
                    {!theme.isSystem && !theme.isActive && (
                      <button type="button" onClick={() => deleteTheme(theme)} className="inline-flex items-center justify-center w-[30px] h-[30px] max-[782px]:w-10 max-[782px]:h-10 rounded-[3px] text-[#b32d2e] hover:bg-[#fcf0f1]" title="Delete" aria-label={`Delete ${theme.name}`}>
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Add New Placeholder */}
            <button
              type="button"
              onClick={addNewTheme}
              className="border-2 border-dashed border-[#c3c4c7] aspect-[16/10] flex flex-col items-center justify-center text-[#646970] hover:border-[#2271b1] hover:text-[#2271b1] focus-visible:border-[#2271b1] focus-visible:text-[#2271b1] transition-colors cursor-pointer p-3 bg-transparent w-full"
            >
               <Plus className="w-8 h-8 mb-2" aria-hidden="true" />
               <span className="text-[14px] font-semibold">Add New Theme</span>
            </button>
          </div>
        </div>

        {/* Sidebar: Help & Info */}
        <div className="wp-col-side">
          <Postbox title="About appearance">
             <p className="mt-0 mb-3 leading-relaxed">
               This screen allows you to manage the visual themes for your public storefront.
               <strong> Note:</strong> Changes made here only affect the public website, not the admin dashboard.
             </p>
             <ul className="m-0 p-0 list-none space-y-1">
                <li>
                  <a href="/" target="_blank" rel="noopener noreferrer" className="wp-link flex items-center gap-2 min-h-[30px] hover:underline">
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" /> Preview your site
                  </a>
                </li>
                <li>
                  <a href="/" target="_blank" rel="noopener noreferrer" className="wp-link flex items-center gap-2 min-h-[30px] hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Visit site
                  </a>
                </li>
             </ul>
          </Postbox>

          <Postbox title="Site identity">
             <div className="wp-kv">
                <span className="wp-kv-k wp-muted">Active theme</span>
                <span className="wp-kv-v">{themes.find(t => t.isActive)?.name || 'Default'}</span>
             </div>
             <div className="wp-kv">
                <span className="wp-kv-k wp-muted">Version</span>
                <span className="wp-muted">1.0.0</span>
             </div>
          </Postbox>
        </div>
      </div>

      {/* WordPress-Style Theme Customizer */}
      {editingTheme && (
        <div className="fixed inset-0 z-[100] bg-black/55 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="theme-customizer-title">
           <div className="w-full max-w-5xl bg-[#f0f0f1] shadow-[0_5px_15px_rgba(0,0,0,0.3)] flex flex-col h-[94dvh] sm:h-[90vh] overflow-hidden border border-[#c3c4c7]">

              <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                 {/* Left Sidebar: Controls */}
                 <div className="w-full md:w-[300px] max-[767px]:max-h-[50%] bg-[#f0f0f1] border-b md:border-b-0 md:border-r border-[#c3c4c7] flex flex-col min-h-0 shrink-0">

                    {/* Customizer header: close + publish */}
                    <div className="flex items-center gap-2 px-2 py-2 bg-white border-b border-[#dcdcde] shrink-0">
                       <button type="button" onClick={closeCustomizer} className="inline-flex items-center justify-center w-10 h-10 rounded-[3px] text-[#646970] hover:text-[#1d2327] hover:bg-[#f0f0f1] shrink-0" title="Close" aria-label="Close customizer">
                          <X className="w-5 h-5" aria-hidden="true" />
                       </button>
                       <span className="flex-1" />
                       <button
                        type="button"
                        onClick={saveThemeChanges}
                        className="wp-btn wp-btn-primary"
                       >
                         Publish changes
                       </button>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                       <div className="px-4 py-3 bg-white border-b border-[#dcdcde]">
                          <span className="wp-muted wp-small block">You are customizing</span>
                          <h2 id="theme-customizer-title" className="m-0 text-[18px] font-semibold text-[#1d2327] truncate">{editingTheme.name}</h2>
                       </div>

                       {/* Colors */}
                       <section className="bg-white border-b border-[#dcdcde] mt-3" aria-labelledby="theme-colors-title">
                          <h3 id="theme-colors-title" className="flex items-center gap-2 m-0 px-4 py-3 border-b border-[#f0f0f1] text-[14px] font-semibold text-[#1d2327]">
                             <Palette className="w-4 h-4 text-[#646970]" aria-hidden="true" /> Colors
                          </h3>
                          <div className="px-4 py-2">
                             {Object.entries(editingTheme.config.colors).map(([key, value]) => colorRow(key, value))}
                          </div>
                       </section>

                       {/* Typography */}
                       <section className="bg-white border-y border-[#dcdcde] mt-3 mb-3" aria-labelledby="theme-type-title">
                          <h3 id="theme-type-title" className="flex items-center gap-2 m-0 px-4 py-3 border-b border-[#f0f0f1] text-[14px] font-semibold text-[#1d2327]">
                             <Type className="w-4 h-4 text-[#646970]" aria-hidden="true" /> Typography
                          </h3>
                          <div className="px-4 py-3">
                             <div className="wp-field">
                                <label className="wp-label" htmlFor="theme-heading-font">Heading font</label>
                                <select
                                  id="theme-heading-font"
                                  value={editingTheme.config.typography.headingFont}
                                  onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, typography: {...editingTheme.config.typography, headingFont: e.target.value}}})}
                                  className="wp-select wp-full"
                                >
                                  {SUPPORTED_FONTS.map(font => (
                                    <option key={font} value={font}>{font}</option>
                                  ))}
                                </select>
                             </div>
                             <div className="wp-field">
                                <label className="wp-label" htmlFor="theme-body-font">Body font</label>
                                <select
                                  id="theme-body-font"
                                  value={editingTheme.config.typography.bodyFont}
                                  onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, typography: {...editingTheme.config.typography, bodyFont: e.target.value}}})}
                                  className="wp-select wp-full"
                                >
                                  {SUPPORTED_FONTS.map(font => (
                                    <option key={font} value={font}>{font}</option>
                                  ))}
                                </select>
                             </div>
                             <div className="mb-0">
                                <label className="wp-label" htmlFor="theme-heading-scale">Heading scale</label>
                                <select
                                  id="theme-heading-scale"
                                  value={editingTheme.config.typography.headingScale}
                                  onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, typography: {...editingTheme.config.typography, headingScale: parseFloat(e.target.value)}}})}
                                  className="wp-select wp-full"
                                >
                                  <option value="1.125">1.125x (Subtle)</option>
                                  <option value="1.200">1.200x (Minor Third)</option>
                                  <option value="1.250">1.250x (Major Third)</option>
                                  <option value="1.333">1.333x (Perfect Fourth)</option>
                                  <option value="1.414">1.414x (Augmented Fourth)</option>
                                </select>
                             </div>
                          </div>
                       </section>
                    </div>
                 </div>

                 {/* Right: Live Preview Frame (storefront theme) */}
                 <div className="flex-1 min-h-0 min-w-0 bg-[#dcdcde] p-2 sm:p-4 md:p-6 flex items-center justify-center">
                    <div className="w-full h-full bg-white shadow-xl overflow-hidden flex flex-col border border-[#c3c4c7]">
                       <div className="bg-white border-b border-[#dcdcde] px-3 py-1.5 flex items-center justify-between shrink-0">
                          <div className="flex gap-1.5" aria-hidden="true">
                             <div className="w-2.5 h-2.5 rounded-full bg-[#dcdcde]" />
                             <div className="w-2.5 h-2.5 rounded-full bg-[#dcdcde]" />
                             <div className="w-2.5 h-2.5 rounded-full bg-[#dcdcde]" />
                          </div>
                          <span className="wp-muted wp-small">Storefront preview</span>
                       </div>

                       <div className="flex-1 overflow-y-auto relative" style={{ backgroundColor: editingTheme.config.colors.background }}>
                          {/* Inject Dynamic Google Fonts Link for Preview */}
                          <link 
                            rel="stylesheet" 
                            href={`https://fonts.googleapis.com/css2?family=${editingTheme.config.typography.headingFont.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&family=${editingTheme.config.typography.bodyFont.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&display=swap`} 
                          />
                          
                          {/* Mini Header */}
                          <div className="sticky top-0 z-10 border-b shadow-sm flex items-center justify-between px-8 py-4" style={{ backgroundColor: editingTheme.config.colors.card || editingTheme.config.colors.background, borderColor: editingTheme.config.colors.border }}>
                             <div style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.headingFont, fontSize: '18px', fontWeight: '900', letterSpacing: '-0.5px' }}>STOREFRONT</div>
                             <div className="flex gap-6">
                                <span style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '13px', opacity: 0.8, cursor: 'pointer' }}>Home</span>
                                <span style={{ color: editingTheme.config.colors.primary, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>Shop</span>
                                <span style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '13px', opacity: 0.8, cursor: 'pointer' }}>About</span>
                             </div>
                          </div>

                          <div className="p-12 max-w-2xl mx-auto space-y-16">
                             {/* Hero Section */}
                             <div className="space-y-6 text-center">
                                <span style={{ color: editingTheme.config.colors.primary, fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: editingTheme.config.typography.bodyFont }}>New Collection</span>
                                <h1 style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.headingFont, fontSize: '48px', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-1px' }}>
                                  Experience Pure Luxury
                                </h1>
                                <p style={{ color: editingTheme.config.colors.foreground, opacity: 0.7, fontSize: '16px', lineHeight: '1.6', fontFamily: editingTheme.config.typography.bodyFont, maxWidth: '400px', margin: '0 auto' }}>
                                  This is a live simulation of your public storefront using the selected typography, colors, and borders.
                                </p>
                                <div className="pt-4 flex items-center justify-center gap-4">
                                   <div className="h-11 px-8 rounded flex items-center justify-center font-bold text-[14px] cursor-pointer shadow-lg hover:opacity-90 transition-opacity" 
                                        style={{ backgroundColor: editingTheme.config.colors.primary, color: editingTheme.config.colors.background, fontFamily: editingTheme.config.typography.bodyFont }}>
                                      Shop Now
                                   </div>
                                   <div className="h-11 px-8 rounded flex items-center justify-center font-bold text-[14px] cursor-pointer border" 
                                        style={{ borderColor: editingTheme.config.colors.border, color: editingTheme.config.colors.foreground, backgroundColor: 'transparent', fontFamily: editingTheme.config.typography.bodyFont }}>
                                      Learn More
                                   </div>
                                </div>
                             </div>

                             {/* Product Grid Simulation */}
                             <div className="space-y-6">
                                <h2 style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.headingFont, fontSize: '24px', fontWeight: 'bold' }}>Featured Products</h2>
                                <div className="grid grid-cols-2 gap-6">
                                   {[1, 2].map((i) => (
                                     <div key={i} className="rounded-lg overflow-hidden border transition-transform hover:-translate-y-1" style={{ backgroundColor: editingTheme.config.colors.card || editingTheme.config.colors.background, borderColor: editingTheme.config.colors.border }}>
                                        <div className="aspect-[4/3] w-full" style={{ backgroundColor: editingTheme.config.colors.muted }}></div>
                                        <div className="p-5 space-y-3">
                                           <h3 style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.headingFont, fontSize: '16px', fontWeight: 'bold' }}>Sample Product {i}</h3>
                                           <div className="flex items-center justify-between">
                                              <span style={{ color: editingTheme.config.colors.foreground, opacity: 0.7, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '15px' }}>$199.00</span>
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer" style={{ backgroundColor: editingTheme.config.colors.secondary, color: editingTheme.config.colors.primary }}>
                                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                                              </div>
                                           </div>
                                        </div>
                                     </div>
                                   ))}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

           </div>
        </div>
      )}
    </Page>
    </RequirePermission>
  );
}

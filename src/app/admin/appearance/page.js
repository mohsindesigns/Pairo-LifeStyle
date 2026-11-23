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
import { Page, PageHeader, Postbox, Skeleton, Notice } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import { useRBAC } from "@/hooks/useRBAC";
import ThemedSelect from "@/components/ui/ThemedSelect";

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
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null);
  const { can } = useRBAC();
  const canManage = can("settings.manage");
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
    setLoadError("");
    try {
      const res = await fetch("/api/admin/themes", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        // Active theme first, then the user's own themes, then the built-in ones.
        setThemes([...data].sort((a, b) => (b.isActive - a.isActive) || (a.isSystem - b.isSystem)));
      } else {
        setLoadError(data?.error || "Failed to load themes.");
      }
    } catch (err) {
      setLoadError("Failed to load themes. Check your connection and try again.");
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
    setBusyId(id);
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
    } finally {
      setBusyId(null);
    }
  };

  // The server copies the colours/fonts as an inactive, non-system theme with a unique "-copy" slug.
  // Returns the new theme (or null) so "Duplicate to customize" can open it straight away.
  const duplicateTheme = async (theme, newName) => {
    setBusyId(theme._id);
    try {
      const res = await fetch(`/api/admin/themes/${theme._id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newName ? { name: newName } : {})
      });
      if (res.ok) {
        const created = await res.json().catch(() => null);
        toast.success(newName ? "Theme created" : "Theme duplicated");
        fetchThemes();
        return created;
      }
      toast.error(await errorMessage(res, "Duplication failed"));
    } catch (err) {
      toast.error("Duplication failed");
    } finally {
      setBusyId(null);
    }
    return null;
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
    setBusyId(theme._id);
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
    } finally {
      setBusyId(null);
    }
  };

  const snapshot = (theme) => JSON.stringify({ name: theme.name, config: theme.config });

  const openCustomizer = (theme) => {
    originalConfigRef.current = snapshot(theme);
    setEditingTheme(JSON.parse(JSON.stringify(theme)));
  };

  // System themes are read-only: copy it, then open the copy in the customizer.
  const duplicateAndCustomize = async () => {
    const created = await duplicateTheme(editingTheme);
    if (created?._id) openCustomizer(created);
  };

  const closeCustomizer = useCallback(async () => {
    if (!editingTheme) return;
    const dirty = !editingTheme.isSystem && JSON.stringify({ name: editingTheme.name, config: editingTheme.config }) !== originalConfigRef.current;
    if (dirty) {
      const ok = await showConfirm(
        "You have unsaved changes to this theme. Close the customizer and discard them?",
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
    if (!String(editingTheme.name || "").trim()) {
      toast.error("Theme name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/themes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTheme._id, name: editingTheme.name.trim(), config: editingTheme.config })
      });
      if (res.ok) {
        toast.success(editingTheme.isActive ? "Theme updated — changes are live" : "Theme saved");
        fetchThemes();
        setEditingTheme(null);
      } else {
        toast.error(await errorMessage(res, "Update failed"));
      }
    } catch (err) {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !!editingTheme?.isSystem || !canManage;
  const activeTheme = themes.find(t => t.isActive);
  const swatchKeys = ["background", "foreground", "primary", "accent", "muted", "secondary"];

  const colorRow = (key, value) => (
    <div key={key} className="flex items-center gap-2 py-1.5 border-b border-[#f0f0f1] last:border-b-0">
      <label htmlFor={`theme-color-${key}`} className="flex-1 min-w-0 capitalize text-[#1d2327]">{key}</label>
      <span
        className="relative w-[30px] h-[30px] max-[782px]:w-10 max-[782px]:h-10 border border-[#8c8f94] rounded-[3px] overflow-hidden shrink-0 focus-within:shadow-[0_0_0_2px_#2271b1]"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#000000"}
          onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, colors: {...editingTheme.config.colors, [key]: e.target.value}}})}
          disabled={readOnly}
          aria-label={`${key} colour picker`}
          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
        />
      </span>
      <input
        id={`theme-color-${key}`}
        type="text"
        value={value}
        onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, colors: {...editingTheme.config.colors, [key]: e.target.value}}})}
        readOnly={readOnly}
        className="wp-input font-mono uppercase w-[110px] shrink-0"
        spellCheck={false}
      />
    </div>
  );

  return (
    <RequirePermission permission="settings.view">
    <Page>
      <PageHeader
        title="Themes"
        actions={canManage && !loading && themes.length > 0 ? <button type="button" className="wp-btn" onClick={addNewTheme}>Add New Theme</button> : null}
      />
      <p className="wp-muted" style={{ marginTop: 0, marginBottom: 16 }}>Themes set the colours and fonts of your public storefront. The admin dashboard is not affected.</p>

      {loadError && (
        <Notice type="error">
          {loadError} <button type="button" className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", textDecoration: "underline" }} onClick={fetchThemes}>Try again</button>
        </Notice>
      )}

      <div className="wp-cols">

        {/* Main Content: Theme List */}
        <div className="wp-col-main">
          <h2 className="sr-only">Themes</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" aria-busy="true">
              <span className="sr-only">Loading themes…</span>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="bg-white border border-[#c3c4c7]">
                  <Skeleton height={120} width="100%" />
                  <div className="p-3"><Skeleton height={16} width="60%" /><Skeleton height={32} width="80%" style={{ marginTop: 10 }} /></div>
                </div>
              ))}
            </div>
          ) : themes.length === 0 && !loadError ? (
            <div className="bg-white border border-[#c3c4c7] p-6 text-center">
              <p className="wp-muted" style={{ marginTop: 0 }}>No themes found.</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {themes.map((theme) => {
              const c = theme.config?.colors || {};
              const t = theme.config?.typography || {};
              const busy = busyId === theme._id;
              return (
              <article
                key={theme._id}
                aria-label={`${theme.name}${theme.isActive ? " (active)" : ""}`}
                className={`bg-white border ${theme.isActive ? 'border-[#2271b1] shadow-[0_0_0_1px_#2271b1]' : 'border-[#c3c4c7]'} flex flex-col min-w-0`}
              >
                {/* Preview: the theme's own colours and heading font */}
                <button
                  type="button"
                  onClick={() => openCustomizer(theme)}
                  className="block w-full p-0 border-0 border-b border-[#dcdcde] cursor-pointer text-left"
                  style={{ backgroundColor: c.background || "#fff" }}
                  aria-label={`${canManage && !theme.isSystem ? "Customize" : "Preview"} ${theme.name}`}
                >
                  <div className="px-4 pt-4 pb-3 min-h-[110px] flex flex-col justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate" style={{ color: c.foreground, fontFamily: t.headingFont, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>Aa — {t.headingFont || "Default"}</div>
                      <div className="truncate" style={{ color: c.foreground, opacity: 0.7, fontFamily: t.bodyFont, fontSize: 13, marginTop: 4 }}>Body: {t.bodyFont || "Default"}</div>
                    </div>
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                      {swatchKeys.map(k => (
                        <span key={k} title={k} className="w-6 h-6 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: c[k] }} />
                      ))}
                      <span className="ml-auto h-7 px-3 rounded flex items-center text-[12px] font-semibold" style={{ backgroundColor: c.primary, color: c.background }}>Button</span>
                    </div>
                  </div>
                </button>

                {/* Name, badges and actions */}
                <div className="px-3 py-2.5 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <h3 className="m-0 min-w-0 flex-1 text-[14px] font-semibold text-[#1d2327] break-words">{theme.name}</h3>
                    {theme.isActive && <span className="wp-pill wp-pill-sm wp-st-published">Active</span>}
                    {theme.isSystem && <span className="wp-pill wp-pill-sm wp-st-draft">Built-in</span>}
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                      {!theme.isActive && (
                        <button type="button" onClick={() => activateTheme(theme._id)} disabled={busy} className="wp-btn wp-btn-primary" aria-label={`Activate ${theme.name}`}>Activate</button>
                      )}
                      <button type="button" onClick={() => openCustomizer(theme)} disabled={busy} className="wp-btn" aria-label={`${theme.isSystem ? "Preview" : "Customize"} ${theme.name}`}>{theme.isSystem ? "Preview" : "Customize"}</button>
                      <button type="button" onClick={() => duplicateTheme(theme)} disabled={busy} className="wp-btn" aria-label={`Duplicate ${theme.name}`}>
                        <Copy className="w-4 h-4" aria-hidden="true" /> Duplicate
                      </button>
                      {!theme.isSystem && !theme.isActive && (
                        <button type="button" onClick={() => deleteTheme(theme)} disabled={busy} className="wp-btn inline-flex items-center justify-center min-w-[40px]" style={{ color: "#b32d2e" }} title="Delete" aria-label={`Delete ${theme.name}`}>
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
              );
            })}

            {canManage && themes.length > 0 && (
              <button
                type="button"
                onClick={addNewTheme}
                className="border-2 border-dashed border-[#c3c4c7] min-h-[180px] flex flex-col items-center justify-center text-[#646970] hover:border-[#2271b1] hover:text-[#2271b1] focus-visible:border-[#2271b1] focus-visible:text-[#2271b1] transition-colors cursor-pointer p-3 bg-transparent w-full"
              >
                 <Plus className="w-8 h-8 mb-2" aria-hidden="true" />
                 <span className="text-[14px] font-semibold">Add New Theme</span>
              </button>
            )}
          </div>
          )}
        </div>

        {/* Sidebar: Help & Info */}
        <div className="wp-col-side">
          <Postbox title="Active theme">
             <div className="wp-kv">
                <span className="wp-kv-k wp-muted">Theme</span>
                <span className="wp-kv-v break-words text-right">{loading ? "…" : activeTheme?.name || "Default"}</span>
             </div>
             <div className="wp-kv">
                <span className="wp-kv-k wp-muted">Fonts</span>
                <span className="wp-kv-v break-words text-right">{activeTheme ? `${activeTheme.config?.typography?.headingFont} / ${activeTheme.config?.typography?.bodyFont}` : "—"}</span>
             </div>
             <ul className="m-0 p-0 list-none" style={{ marginTop: 8 }}>
                <li>
                  <a href="/" target="_blank" rel="noopener noreferrer" className="wp-link inline-flex items-center gap-2 min-h-[36px] hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Visit site
                  </a>
                </li>
             </ul>
          </Postbox>
          <Postbox title="About themes">
             <p className="m-0 leading-relaxed">
               Built-in themes can&apos;t be changed — duplicate one to make your own copy, then customize it.
               The active theme can&apos;t be deleted; activate another theme first.
             </p>
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
                       {readOnly ? (
                         canManage && (
                           <button type="button" onClick={duplicateAndCustomize} disabled={busyId === editingTheme._id} className="wp-btn wp-btn-primary">
                             Duplicate to customize
                           </button>
                         )
                       ) : (
                         <button
                          type="button"
                          onClick={saveThemeChanges}
                          disabled={saving}
                          className="wp-btn wp-btn-primary"
                         >
                           {saving ? "Saving…" : editingTheme.isActive ? "Publish changes" : "Save theme"}
                         </button>
                       )}
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                       <div className="px-4 py-3 bg-white border-b border-[#dcdcde]">
                          <span className="wp-muted wp-small block">{readOnly ? "You are previewing" : "You are customizing"}</span>
                          <h2 id="theme-customizer-title" className="m-0 text-[18px] font-semibold text-[#1d2327] break-words">{editingTheme.name}</h2>
                          {editingTheme.isActive && <span className="wp-pill wp-pill-sm wp-st-published" style={{ marginTop: 6 }}>Active — saving changes updates the live site</span>}
                       </div>
                       {editingTheme.isSystem && (
                          <div className="px-4 pt-3">
                             <div className="wp-notice wp-notice-info" style={{ margin: 0 }}>
                                <p>This is a built-in theme and can&apos;t be changed. Use <strong>Duplicate to customize</strong> to make your own copy.</p>
                             </div>
                          </div>
                       )}
                       {!readOnly && (
                          <div className="px-4 py-3 bg-white border-b border-[#dcdcde] mt-3">
                             <label className="wp-label" htmlFor="theme-name-input">Theme name</label>
                             <input
                               id="theme-name-input"
                               type="text"
                               maxLength={100}
                               value={editingTheme.name || ""}
                               onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
                               className="wp-input wp-full"
                             />
                          </div>
                       )}

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
                                <ThemedSelect
                                  id="theme-heading-font"
                                  value={editingTheme.config.typography.headingFont}
                                  onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, typography: {...editingTheme.config.typography, headingFont: e.target.value}}})}
                                  className="wp-select wp-full"
                                  disabled={readOnly}
                                >
                                  {SUPPORTED_FONTS.map(font => (
                                    <option key={font} value={font}>{font}</option>
                                  ))}
                                </ThemedSelect>
                             </div>
                             <div className="wp-field">
                                <label className="wp-label" htmlFor="theme-body-font">Body font</label>
                                <ThemedSelect
                                  id="theme-body-font"
                                  value={editingTheme.config.typography.bodyFont}
                                  onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, typography: {...editingTheme.config.typography, bodyFont: e.target.value}}})}
                                  className="wp-select wp-full"
                                  disabled={readOnly}
                                >
                                  {SUPPORTED_FONTS.map(font => (
                                    <option key={font} value={font}>{font}</option>
                                  ))}
                                </ThemedSelect>
                             </div>
                             <div className="mb-0">
                                <label className="wp-label" htmlFor="theme-heading-scale">Heading scale</label>
                                <ThemedSelect
                                  id="theme-heading-scale"
                                  value={editingTheme.config.typography.headingScale}
                                  onChange={(e) => setEditingTheme({...editingTheme, config: {...editingTheme.config, typography: {...editingTheme.config.typography, headingScale: parseFloat(e.target.value)}}})}
                                  className="wp-select wp-full"
                                  disabled={readOnly}
                                >
                                  <option value="1.125">1.125x (Subtle)</option>
                                  <option value="1.200">1.200x (Minor Third)</option>
                                  <option value="1.250">1.250x (Major Third)</option>
                                  <option value="1.333">1.333x (Perfect Fourth)</option>
                                  <option value="1.414">1.414x (Augmented Fourth)</option>
                                </ThemedSelect>
                             </div>
                          </div>
                       </section>
                    </div>
                 </div>

                 {/* Right: Live Preview Frame (storefront theme) */}
                 <div className="flex-1 min-h-[220px] min-w-0 bg-[#dcdcde] p-2 sm:p-4 md:p-6 flex items-center justify-center">
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
                          <div className="sticky top-0 z-10 border-b shadow-sm flex items-center justify-between gap-3 px-4 sm:px-8 py-3 sm:py-4" style={{ backgroundColor: editingTheme.config.colors.card || editingTheme.config.colors.background, borderColor: editingTheme.config.colors.border }}>
                             <div style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.headingFont, fontSize: '18px', fontWeight: '900', letterSpacing: '-0.5px' }}>STOREFRONT</div>
                             <div className="flex gap-3 sm:gap-6">
                                <span style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '13px', opacity: 0.8, cursor: 'pointer' }}>Home</span>
                                <span style={{ color: editingTheme.config.colors.primary, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>Shop</span>
                                <span style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.bodyFont, fontSize: '13px', opacity: 0.8, cursor: 'pointer' }}>About</span>
                             </div>
                          </div>

                          <div className="p-5 sm:p-12 max-w-2xl mx-auto space-y-10 sm:space-y-16">
                             {/* Hero Section */}
                             <div className="space-y-6 text-center">
                                <span style={{ color: editingTheme.config.colors.primary, fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: editingTheme.config.typography.bodyFont }}>New Collection</span>
                                <h1 style={{ color: editingTheme.config.colors.foreground, fontFamily: editingTheme.config.typography.headingFont, fontSize: 'clamp(28px, 6vw, 48px)', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-1px' }}>
                                  Experience Pure Luxury
                                </h1>
                                <p style={{ color: editingTheme.config.colors.foreground, opacity: 0.7, fontSize: '16px', lineHeight: '1.6', fontFamily: editingTheme.config.typography.bodyFont, maxWidth: '400px', margin: '0 auto' }}>
                                  This is a live simulation of your public storefront using the selected typography, colors, and borders.
                                </p>
                                <div className="pt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
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
                                <div className="grid grid-cols-2 gap-3 sm:gap-6">
                                   {[1, 2].map((i) => (
                                     <div key={i} className="rounded-lg overflow-hidden border transition-transform hover:-translate-y-1" style={{ backgroundColor: editingTheme.config.colors.card || editingTheme.config.colors.background, borderColor: editingTheme.config.colors.border }}>
                                        <div className="aspect-[4/3] w-full" style={{ backgroundColor: editingTheme.config.colors.muted }}></div>
                                        <div className="p-3 sm:p-5 space-y-3">
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

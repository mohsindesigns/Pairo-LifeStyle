"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import {
  Save, Plus, X, Loader2, Check, Pencil, Download, Upload,
} from "lucide-react";
import { Page, PageHeader } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import { inp } from "@/components/admin/tax/taxStyles";
import TaxRateRow from "@/components/admin/tax/TaxRateRow";
import RequirePermission from "@/components/admin/RequirePermission";
import ShippingTaxTabs from "@/components/admin/settings/ShippingTaxTabs";
import ThemedSelect from "@/components/ui/ThemedSelect";

const defaultSettings = {
  enabled: false,
  calculationMethod: "exclusive",
  taxRoundingMode: "round",
  priceDisplaySuffix: "",
  taxClasses: [],
};

const blankRow = () => ({
  country: "", state: "", postcode: "", city: "",
  rate: 0, name: "Tax", priority: 1, compound: false, shipping: true,
});


// ─── Label-left settings row ───────────────────────────────────────────────────
function SettingsRow({ label, htmlFor, hint: hintText, children }) {
  return (
    <div className="wp-frow">
      {htmlFor ? (
        <label className="wp-flabel" htmlFor={htmlFor}>{label}</label>
      ) : (
        <span className="wp-flabel">{label}</span>
      )}
      <div className="min-w-0" style={{ flex: "1 1 320px", maxWidth: 420 }}>{children}</div>
      {hintText && <p className="wp-hint">{hintText}</p>}
    </div>
  );
}

// ─── WordPress Style Toggle (switch) ───────────────────────────────────────────
function Toggle({ on, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-busy={disabled || undefined}
      onClick={onChange}
      disabled={disabled}
      className={`inline-flex items-center min-h-[40px] bg-transparent border-0 p-0 ${disabled ? "cursor-wait opacity-60" : "cursor-pointer"}`}
    >
      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? "bg-[#2271b1]" : "bg-[#8c8f94]"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
      </span>
    </button>
  );
}

// ─── Inline click-to-rename tax class name ──────────────────────────────────────
function ClassNameEditor({ name, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const commit = () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== name) onRename(trimmed);
    else setDraft(name);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(name); setEditing(false); }
        }}
        className={inp}
        style={{ maxWidth: 260 }}
        aria-label="Tax class name"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 min-h-[30px] max-[782px]:min-h-[40px] bg-transparent border-0 p-0 cursor-pointer text-[#1d2327] hover:text-[#2271b1] text-[16px] font-semibold"
      title="Click to rename"
      aria-label={`Rename tax class ${name}`}
    >
      &ldquo;{name}&rdquo; tax rates
      <Pencil className="w-3.5 h-3.5 text-[#8c8f94]" aria-hidden="true" />
    </button>
  );
}

// Serialises everything the "Save changes" button persists, except `enabled`
// (the switch saves that on its own), so it can be compared for dirtiness.
function snapshotOf(s) {
  return JSON.stringify({
    calculationMethod: s.calculationMethod,
    taxRoundingMode: s.taxRoundingMode,
    priceDisplaySuffix: s.priceDisplaySuffix,
    taxClasses: s.taxClasses,
  });
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "") || "class";
}

export default function TaxSettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [activeClassKey, setActiveClassKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingTaxes, setTogglingTaxes] = useState(false);
  // Last state confirmed by the server (minus `enabled`, which the switch saves
  // on its own) — used to tell whether the form has unsaved edits.
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [addingClass, setAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const fileInputRef = useRef(null);
  const importModeRef = useRef("replace");
  const { showConfirm } = usePopup();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/tax", { cache: "no-store" });
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings({ ...defaultSettings, ...data.settings });
          setSavedSnapshot(snapshotOf({ ...defaultSettings, ...data.settings }));
          setActiveClassKey(data.settings.taxClasses?.[0]?.key ?? null);
        } else {
          toast.error(data.error || "Failed to load tax settings.");
        }
      } catch {
        toast.error("Failed to load tax settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isDirty = savedSnapshot !== null && snapshotOf(settings) !== savedSnapshot;
  const set = (k, v) => setSettings((p) => ({ ...p, [k]: v }));
  const activeClass = settings.taxClasses.find((c) => c.key === activeClassKey) || settings.taxClasses[0] || null;

  // ── Tax classes ─────────────────────────────────────────────────────────────
  const handleAddClass = () => {
    const name = newClassName.trim();
    if (!name) return;
    const existingKeys = new Set(settings.taxClasses.map((c) => c.key));
    let key = slugify(name);
    if (existingKeys.has(key)) {
      let n = 2;
      while (existingKeys.has(`${key}-${n}`)) n++;
      key = `${key}-${n}`;
    }
    setSettings((p) => ({ ...p, taxClasses: [...p.taxClasses, { key, name, isDefault: false, rates: [] }] }));
    setActiveClassKey(key);
    setNewClassName("");
    setAddingClass(false);
  };

  const renameClass = (key, name) => {
    setSettings((p) => ({ ...p, taxClasses: p.taxClasses.map((c) => (c.key === key ? { ...c, name } : c)) }));
  };

  const handleDeleteClass = async (cls) => {
    if (!cls || cls.isDefault || settings.taxClasses.length <= 1) return;
    const ok = await showConfirm(
      `Delete tax class "${cls.name}"? This removes its ${cls.rates.length} rate row(s). The change only takes effect once you save.`,
      "Delete Tax Class"
    );
    if (!ok) return;
    const remaining = settings.taxClasses.filter((c) => c.key !== cls.key);
    setSettings((p) => ({ ...p, taxClasses: remaining }));
    if (activeClassKey === cls.key) setActiveClassKey(remaining[0]?.key ?? null);
  };

  // ── Rate rows (active class) ────────────────────────────────────────────────
  const updateActiveRates = (updater) => {
    setSettings((p) => ({
      ...p,
      taxClasses: p.taxClasses.map((c) => (c.key === activeClassKey ? { ...c, rates: updater(c.rates) } : c)),
    }));
  };
  const addRow = () => updateActiveRates((rates) => [...rates, blankRow()]);
  const updateRow = (idx, patch) => updateActiveRates((rates) => rates.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const deleteRow = (idx) => updateActiveRates((rates) => rates.filter((_, i) => i !== idx));

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        enabled: settings.enabled,
        calculationMethod: settings.calculationMethod,
        taxRoundingMode: settings.taxRoundingMode,
        priceDisplaySuffix: settings.priceDisplaySuffix,
        taxClasses: settings.taxClasses,
      };
      const res = await fetch("/api/admin/tax", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSettings({ ...defaultSettings, ...data.settings });
      setSavedSnapshot(snapshotOf({ ...defaultSettings, ...data.settings }));
      if (!data.settings.taxClasses?.some((c) => c.key === activeClassKey)) {
        setActiveClassKey(data.settings.taxClasses?.[0]?.key ?? null);
      }
      toast.success("Tax settings saved.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── CSV export / import ─────────────────────────────────────────────────────
  const handleExport = async (classKey) => {
    try {
      const res = await fetch(`/api/admin/tax/export?classKey=${encodeURIComponent(classKey)}`, { credentials: "same-origin" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `tax-rates-${classKey}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const triggerImport = (mode) => {
    if (!activeClass) return;
    importModeRef.current = mode;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeClass) return;
    const mode = importModeRef.current;
    const message = mode === "replace"
      ? `Replace all ${activeClass.rates.length} existing rate row(s) in "${activeClass.name}" with the rows from "${file.name}"?`
      : `Append the rows from "${file.name}" to the ${activeClass.rates.length} existing rate row(s) in "${activeClass.name}"?`;
    const ok = await showConfirm(message, mode === "replace" ? "Replace Rates" : "Append Rates");
    if (!ok) return;
    try {
      const csv = await file.text();
      const res = await fetch("/api/admin/tax/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classKey: activeClass.key, csv, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");
      setSettings({ ...defaultSettings, ...data.settings });
      setSavedSnapshot(snapshotOf({ ...defaultSettings, ...data.settings }));
      toast.success(`Imported ${data.imported} rate row(s).`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Saves ONLY the enabled flag (PATCH) — any unsaved class/rate/option edits
  // stay local and unsaved. Reverts the switch if the request fails.
  const handleToggleTaxes = async () => {
    if (togglingTaxes) return;
    const prevVal = settings.enabled;
    const nextVal = !prevVal;
    setTogglingTaxes(true);
    set("enabled", nextVal);
    try {
      const res = await fetch("/api/admin/tax", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextVal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update tax status.");
      toast.success(nextVal ? "Tax module enabled." : "Tax module disabled.");
    } catch (e) {
      set("enabled", prevVal);
      toast.error(e.message || "Failed to update tax status.");
    } finally {
      setTogglingTaxes(false);
    }
  };

  if (loading) {
    return (
      <RequirePermission permission="settings.view">
      <Page>
        <PageHeader title="Tax" />
        <p className="wp-muted flex items-center gap-2 py-6">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading tax settings…
        </p>
      </Page>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission permission="settings.view">
    <Page>
      <PageHeader title="Tax" />
      <ShippingTaxTabs activeTab="tax" />

      {/* ── 1. Tax options ─────────────────────── */}
      <section className="wp-postbox" aria-labelledby="tax-options-title">
        <div className="wp-postbox-head"><h2 id="tax-options-title">Tax options</h2></div>
        <div className="wp-inside" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <SettingsRow label="Enable taxes" hint="Enable tax rates and calculations on the storefront cart and checkout pages. This switch saves immediately.">
            <div className="flex items-center gap-3">
              <Toggle on={settings.enabled} onChange={handleToggleTaxes} label="Enable taxes" disabled={togglingTaxes} />
              <span className={settings.enabled ? "wp-strong" : "wp-muted"}>{settings.enabled ? "Active" : "Inactive"}</span>
            </div>
          </SettingsRow>

          {settings.enabled && (
            <>
              <SettingsRow label="Calculation method" htmlFor="tax-calc" hint="Inclusive means prices already include tax. Exclusive adds tax on top of your prices.">
                <ThemedSelect
                  id="tax-calc"
                  className="wp-select wp-full"
                  value={settings.calculationMethod}
                  onChange={(e) => set("calculationMethod", e.target.value)}
                >
                  <option value="exclusive">Exclusive — tax added on top of product prices</option>
                  <option value="inclusive">Inclusive — tax is included in product prices</option>
                </ThemedSelect>
              </SettingsRow>

              <SettingsRow label="Rounding mode" htmlFor="tax-rounding" hint="Determines how fractional cents are rounded in tax calculations.">
                <ThemedSelect
                  id="tax-rounding"
                  className="wp-select wp-full"
                  value={settings.taxRoundingMode}
                  onChange={(e) => set("taxRoundingMode", e.target.value)}
                >
                  <option value="round">Round to nearest (standard)</option>
                  <option value="floor">Floor (always round down)</option>
                  <option value="ceil">Ceil (always round up)</option>
                </ThemedSelect>
              </SettingsRow>

              <SettingsRow label="Price display suffix" htmlFor="tax-suffix" hint="Optional text appended after displayed prices, e.g. 'excl. tax' — cosmetic only, purely for how prices are labeled once tax is live.">
                <input
                  id="tax-suffix"
                  type="text"
                  className={inp}
                  value={settings.priceDisplaySuffix}
                  onChange={(e) => set("priceDisplaySuffix", e.target.value)}
                  placeholder="e.g. excl. tax"
                />
              </SettingsRow>
            </>
          )}
        </div>
      </section>

      {!settings.enabled ? (
        /* ── Tax Module OFF View: Show inactive status notice, hide tax classes ── */
        <div className="wp-notice wp-notice-warning">
          <p>
            <strong className="wp-strong">Taxes are turned off.</strong> No taxes will be calculated or added to orders on the storefront cart and checkout pages. Turn taxes on above to configure tax calculation options and rate classes.
          </p>
        </div>
      ) : (
        /* ── Tax Module ON View: Classes & Rates ── */
        <>
          {/* ── Staged-rollout notice: tax config is not yet wired into checkout ── */}
          <div className="wp-notice wp-notice-info">
            <p>
              <strong className="wp-strong">Not yet applied at checkout.</strong> Tax rates configured here are not
              yet applied to checkout totals. This screen prepares your tax configuration for when tax calculation
              goes live.
            </p>
          </div>

          {/* ── 2. Tax classes (WooCommerce-style section links) ── */}
          <h2 className="text-[18px] font-normal text-[#1d2327] m-0 mt-2">Tax classes</h2>
          <p className="wp-muted" style={{ margin: "2px 0 0" }}>
            Each class has its own rate table. Products are assigned a tax class; unassigned products use the default class.
          </p>

          <div className="wp-subsub" role="tablist" aria-label="Tax classes">
            {settings.taxClasses.map((cls, i) => (
              <span key={cls.key} className="inline-flex items-center">
                {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
                <button
                  type="button"
                  role="tab"
                  aria-selected={cls.key === activeClassKey}
                  className={`max-[782px]:min-h-[40px] ${cls.key === activeClassKey ? "is-current" : ""}`}
                  onClick={() => setActiveClassKey(cls.key)}
                >
                  {cls.name}{cls.isDefault && <span className="wp-count"> (default)</span>}
                </button>
              </span>
            ))}

            {settings.taxClasses.length > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            {addingClass ? (
              <span className="inline-flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddClass();
                    if (e.key === "Escape") { setAddingClass(false); setNewClassName(""); }
                  }}
                  placeholder="Class name"
                  aria-label="New tax class name"
                  className="wp-input"
                  style={{ width: 170 }}
                />
                <button type="button" onClick={handleAddClass} className="wp-btn" aria-label="Confirm new class" style={{ padding: "0 8px" }}>
                  <Check className="w-4 h-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => { setAddingClass(false); setNewClassName(""); }} className="wp-btn" aria-label="Cancel new class" style={{ padding: "0 8px" }}>
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setAddingClass(true)} className="inline-flex items-center gap-1 max-[782px]:min-h-[40px]">
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add tax class
              </button>
            )}
          </div>

          {!activeClass ? (
            <p className="wp-muted">No tax classes configured.</p>
          ) : (
            <>
              {/* Class header */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <ClassNameEditor key={activeClass.key} name={activeClass.name} onRename={(name) => renameClass(activeClass.key, name)} />
                {activeClass.isDefault && <span className="wp-pill wp-pill-sm">Default class</span>}
              </div>
              <p className="wp-muted" style={{ margin: "2px 0 0" }}>
                Define tax rates for countries and states below. Leave location fields blank to match any value.
              </p>

              {/* Toolbar */}
              <div className="wp-toolbar">
                <button type="button" onClick={addRow} className="wp-btn">
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Insert row
                </button>
                <button type="button" onClick={() => triggerImport("replace")} className="wp-btn">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" /> Import CSV (replace)
                </button>
                <button type="button" onClick={() => triggerImport("append")} className="wp-btn">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" /> Import CSV (append)
                </button>
                <button type="button" onClick={() => handleExport(activeClass.key)} className="wp-btn">
                  <Download className="w-3.5 h-3.5" aria-hidden="true" /> Export CSV
                </button>
                {!activeClass.isDefault && settings.taxClasses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClass(activeClass)}
                    className="wp-btn"
                    style={{ color: "#b32d2e", borderColor: "#b32d2e" }}
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" /> Delete class
                  </button>
                )}
              </div>

              {/* Rate table — scrolls horizontally inside its box on small screens */}
              <div className="wp-table-box">
                <table className="wp-list-table" style={{ minWidth: 1040 }}>
                  <thead>
                    <tr>
                      <th scope="col">Country code</th>
                      <th scope="col">State code</th>
                      <th scope="col">Postcode / ZIP</th>
                      <th scope="col">City</th>
                      <th scope="col">Rate %</th>
                      <th scope="col">Tax name</th>
                      <th scope="col" title="Rows sharing a priority are summed together; a higher-priority compound row stacks on top">Priority</th>
                      <th scope="col" className="text-center">Compound</th>
                      <th scope="col" className="text-center" title="Applies this rate to the shipping cost too">Shipping</th>
                      <th scope="col"><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeClass.rates.length === 0 ? (
                      <tr>
                        <td colSpan={10}>
                          <span className="wp-strong">No tax rates in this class yet.</span>{" "}
                          <span className="wp-muted">Click Insert row to add one, or Import CSV to bulk-load rates.</span>
                        </td>
                      </tr>
                    ) : (
                      activeClass.rates.map((row, i) => (
                        <TaxRateRow
                          key={row._id || `new-${i}`}
                          row={row}
                          onChange={(patch) => updateRow(i, patch)}
                          onDelete={() => deleteRow(i)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelected} />

      {/* Save bar — sticks to the bottom of the viewport while scrolling */}
      <div className="wp-box-foot sticky bottom-0 z-30 mt-5" style={{ border: "1px solid #c3c4c7", boxShadow: "0 -1px 3px rgba(0,0,0,0.06)" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || togglingTaxes}
          className="wp-btn wp-btn-primary"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
          {saving ? "Saving changes…" : "Save changes"}
        </button>
        <span className={isDirty ? "wp-strong wp-small" : "wp-muted wp-small"}>
          {isDirty ? "You have unsaved changes." : "Make sure to save changes for settings to take effect."}
        </span>
      </div>
    </Page>
    </RequirePermission>
  );
}

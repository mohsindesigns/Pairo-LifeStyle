"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import {
  Save, ReceiptText, Plus, X, Loader2, Info, Check, Pencil, Download, Upload,
} from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { usePopup } from "@/context/PopupContext";
import { inp, hint } from "@/components/admin/tax/taxStyles";
import TaxRateRow from "@/components/admin/tax/TaxRateRow";

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

// ─── WordPress Navigation Tabs ──────────────────────────────────────────────────
// Kept in sync with the copy on the Shipping settings page — same active/
// inactive class logic for all three tabs so the nav bar matches regardless
// of which settings page an admin lands on first.
function NavTabs({ activeTab }) {
  const tabClass = (key) =>
    `px-4 py-2 text-[14px] font-semibold border-t-2 border-x border-b transition-all ${
      activeTab === key
        ? "bg-[#f0f2f1] border-t-[#2271b1] border-x-[#c3c4c7] border-b-transparent translate-y-[1px] text-[#1d2327]"
        : "bg-white border-t-transparent border-x-transparent border-b-[#c3c4c7] text-[#2271b1] hover:text-[#135e96] hover:bg-[#fafafa]"
    }`;
  return (
    <div className="flex border-b border-[#c3c4c7] mb-6 mt-1 gap-1">
      <Link href="/admin/settings/shipping" className={tabClass("shipping")}>Shipping</Link>
      <Link href="/admin/settings/tax" className={tabClass("tax")}>Tax Settings</Link>
      <Link href="/admin/settings/shipping/pickup-locations" className={tabClass("pickup")}>Pickup Locations</Link>
    </div>
  );
}

// ─── WordPress Postbox (Metabox) ────────────────────────────────────────────────
function Postbox({ title, subtitle, children, dim, action }) {
  return (
    <div className={`bg-white border border-[#c3c4c7] shadow-sm mb-5 rounded-none transition-opacity ${dim ? "opacity-55 pointer-events-none select-none" : ""}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#c3c4c7] bg-white">
        <h2 className="text-[14px] font-bold text-[#1d2327] m-0">{title}</h2>
        {action}
      </div>
      {subtitle && <div className="px-4 py-2 bg-[#f6f7f7] border-b border-[#c3c4c7] text-[12px] text-[#646970] italic">{subtitle}</div>}
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── WordPress Settings Row (Table Format) ──────────────────────────────────────
function SettingsRow({ label, hint: hintText, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-x-6 gap-y-2 py-4 border-b border-[#f0f0f1] last:border-b-0 items-start text-[13px]">
      <div className="font-semibold text-[#1d2327] pt-1.5">{label}</div>
      <div>
        {children}
        {hintText && <p className={hint}>{hintText}</p>}
      </div>
    </div>
  );
}

// ─── WordPress Style Toggle (Check Switch) ──────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${on ? "bg-[#2271b1]" : "bg-[#c3c4c7]"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

// ─── Scoped tax-class tab button (mirrors NavTabs styling) ─────────────────────
function ClassTabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-[13px] font-semibold border-t-2 border-x border-b transition-all whitespace-nowrap cursor-pointer ${
        active
          ? "bg-white border-t-[#2271b1] border-x-[#c3c4c7] border-b-white translate-y-[1px] text-[#1d2327] relative z-10"
          : "bg-[#f6f7f7] border-t-transparent border-x-transparent border-b-[#c3c4c7] text-[#2271b1] hover:text-[#135e96] hover:bg-[#fafafa]"
      }`}
    >
      {children}
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
        className={`${inp} max-w-[240px] text-[14px] font-bold py-1`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-[15px] font-bold text-[#1d2327] hover:text-[#2271b1] flex items-center gap-1.5 group cursor-pointer"
      title="Click to rename"
    >
      {name}
      <Pencil className="w-3 h-3 text-[#a7aaad] group-hover:text-[#2271b1]" />
    </button>
  );
}

const smallBtn = "inline-flex items-center gap-1 px-2.5 py-1.5 border rounded-[3px] text-[11.5px] font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap";

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "") || "class";
}

export default function TaxSettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [activeClassKey, setActiveClassKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingClass, setAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const fileInputRef = useRef(null);
  const importModeRef = useRef("replace");
  const { showConfirm } = usePopup();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/tax");
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings({ ...defaultSettings, ...data.settings });
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
      toast.success(`Imported ${data.imported} rate row(s).`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <AdminPageLayout title="Tax" breadcrumbs={[{ label: "Settings" }, { label: "Tax" }]}>
        <div className="flex items-center justify-center py-20 gap-2 text-[13px] text-[#646970]">
          <Loader2 className="w-4 h-4 animate-spin" />Loading tax settings…
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout title="Tax settings" breadcrumbs={[{ label: "Settings" }, { label: "Tax" }]}>
      <NavTabs activeTab="tax" />

      <div className="space-y-6 pb-28">

        {/* ── 1. Enable / Disable Section ─────────────────────── */}
        <div className="bg-white border border-[#c3c4c7] shadow-sm p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[3px] bg-[#f0f6fb] flex items-center justify-center border border-[#c3c4c7]">
              <ReceiptText className="w-4 h-4 text-[#2271b1]" />
            </div>
            <div>
              <p className="text-[13.5px] font-bold text-[#1d2327]">Enable Taxes</p>
              <p className="text-[11.5px] text-[#646970]">Toggle tax calculations on the storefront cart and checkout pages.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[12px] font-bold ${settings.enabled ? "text-green-600" : "text-[#646970]"}`}>
              {settings.enabled ? "ACTIVE" : "INACTIVE"}
            </span>
            <Toggle on={settings.enabled} onChange={() => set("enabled", !settings.enabled)} />
          </div>
        </div>

        {/* ── Staged-rollout notice: tax config is not yet wired into checkout ── */}
        <div className="bg-[#f0f6fb] border-l-4 border-[#72aee6] shadow-sm p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-[#2271b1] mt-0.5 shrink-0" />
          <p className="text-[12.5px] text-[#1d2327] leading-relaxed">
            <span className="font-semibold">Not yet applied at checkout.</span> Tax rates configured here are not
            yet applied to checkout totals. This screen prepares your tax configuration for when tax calculation
            goes live.
          </p>
        </div>

        {/* ── 2. Tax Options Postbox ──────────────────────────── */}
        <Postbox title="Tax Options" subtitle="Global tax calculation behavior" dim={!settings.enabled}>
          <div className="divide-y divide-[#f0f0f1]">
            <SettingsRow label="Calculation Method" hint="Inclusive means prices already include tax. Exclusive adds tax on top of your prices.">
              <select
                className={`${inp} max-w-[350px] cursor-pointer`}
                value={settings.calculationMethod}
                onChange={(e) => set("calculationMethod", e.target.value)}
              >
                <option value="exclusive">Exclusive — tax added on top of product prices</option>
                <option value="inclusive">Inclusive — tax is included in product prices</option>
              </select>
            </SettingsRow>

            <SettingsRow label="Rounding Mode" hint="Determines how fractional cents are rounded in tax calculations.">
              <select
                className={`${inp} max-w-[350px] cursor-pointer`}
                value={settings.taxRoundingMode}
                onChange={(e) => set("taxRoundingMode", e.target.value)}
              >
                <option value="round">Round to nearest (standard)</option>
                <option value="floor">Floor (always round down)</option>
                <option value="ceil">Ceil (always round up)</option>
              </select>
            </SettingsRow>

            <SettingsRow label="Price Display Suffix" hint="Optional text appended after displayed prices, e.g. 'excl. tax' — cosmetic only, purely for how prices are labeled once tax is live.">
              <input
                type="text"
                className={`${inp} max-w-[350px]`}
                value={settings.priceDisplaySuffix}
                onChange={(e) => set("priceDisplaySuffix", e.target.value)}
                placeholder="e.g. excl. tax"
              />
            </SettingsRow>
          </div>
        </Postbox>

        {/* ── 3. Tax Classes ──────────────────────────────────── */}
        <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-none">
          <div className="px-4 pt-3">
            <h2 className="text-[14px] font-bold text-[#1d2327] m-0">Tax Classes</h2>
            <p className="text-[12px] text-[#646970] italic mt-1 mb-2">
              Each class has its own rate table. Products are assigned a tax class; unassigned products use the default class.
            </p>
          </div>

          <div className="flex items-end gap-1 px-3 border-b border-[#c3c4c7] overflow-x-auto">
            {settings.taxClasses.map((cls) => (
              <ClassTabButton key={cls.key} active={cls.key === activeClassKey} onClick={() => setActiveClassKey(cls.key)}>
                {cls.name}
                {cls.isDefault && <span className="ml-1.5 text-[9px] font-bold text-[#646970]">(default)</span>}
              </ClassTabButton>
            ))}

            {addingClass ? (
              <div className="flex items-center gap-1 px-2 py-1.5">
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
                  className={`${inp} w-[160px] text-[12px] py-1`}
                />
                <button type="button" onClick={handleAddClass} className="text-[#2271b1] hover:text-[#135e96] p-1 cursor-pointer" aria-label="Confirm new class">
                  <Check className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => { setAddingClass(false); setNewClassName(""); }} className="text-[#646970] hover:text-[#d63638] p-1 cursor-pointer" aria-label="Cancel new class">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingClass(true)}
                className="px-3 py-2 text-[12px] font-bold text-[#2271b1] hover:text-[#135e96] flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Tax Class
              </button>
            )}
          </div>

          <div className="p-5">
            {!activeClass ? (
              <p className="text-[13px] text-[#646970]">No tax classes configured.</p>
            ) : (
              <>
                {/* Class header row */}
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4 pb-4 border-b border-[#f0f0f1]">
                  <div className="flex items-center gap-2">
                    <ClassNameEditor key={activeClass.key} name={activeClass.name} onRename={(name) => renameClass(activeClass.key, name)} />
                    {activeClass.isDefault && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[3px] border border-[#c3c4c7] bg-[#f6f7f7] text-[#50575e]">
                        Default class
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleExport(activeClass.key)}
                      className={`${smallBtn} bg-white border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fb]`}
                    >
                      <Download className="w-3 h-3" /> Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerImport("replace")}
                      className={`${smallBtn} bg-white border-[#8c8f94] text-[#50575e] hover:bg-[#f6f7f7]`}
                    >
                      <Upload className="w-3 h-3" /> Import (Replace)
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerImport("append")}
                      className={`${smallBtn} bg-white border-[#8c8f94] text-[#50575e] hover:bg-[#f6f7f7]`}
                    >
                      <Upload className="w-3 h-3" /> Import (Append)
                    </button>
                    {!activeClass.isDefault && settings.taxClasses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(activeClass)}
                        className={`${smallBtn} bg-white border-[#d63638] text-[#d63638] hover:bg-[#fcf0f1]`}
                      >
                        <X className="w-3 h-3" /> Delete Class
                      </button>
                    )}
                  </div>
                </div>

                {/* Rate table */}
                {activeClass.rates.length === 0 ? (
                  <div className="border border-dashed border-[#c3c4c7] p-8 text-center bg-[#fcfcfc]">
                    <Info className="w-8 h-8 text-[#ccd0d4] mx-auto mb-2" />
                    <p className="text-[13px] font-bold text-[#1d2327] mb-1">No tax rates in this class yet</p>
                    <p className="text-[11.5px] text-[#646970]">Click Insert Row to add one, or Import CSV to bulk-load rates.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="wp-list-table widefat fixed striped posts w-full border border-[#c3c4c7] border-collapse bg-white text-left text-[13px] min-w-[1000px]">
                      <thead>
                        <tr className="bg-[#f6f7f7] border-b border-[#c3c4c7] text-[#2c3338]">
                          <th className="px-2 py-2 font-bold">Country</th>
                          <th className="px-2 py-2 font-bold">State</th>
                          <th className="px-2 py-2 font-bold">Postcode</th>
                          <th className="px-2 py-2 font-bold">City</th>
                          <th className="px-2 py-2 font-bold">Rate %</th>
                          <th className="px-2 py-2 font-bold">Tax Name</th>
                          <th className="px-2 py-2 font-bold" title="Rows sharing a priority are summed together; a higher-priority compound row stacks on top">Priority</th>
                          <th className="px-2 py-2 font-bold text-center">Compound</th>
                          <th className="px-2 py-2 font-bold text-center" title="Applies this rate to the shipping cost too">Shipping</th>
                          <th className="px-2 py-2 font-bold w-[36px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeClass.rates.map((row, i) => (
                          <TaxRateRow
                            key={row._id || `new-${i}`}
                            row={row}
                            onChange={(patch) => updateRow(i, patch)}
                            onDelete={() => deleteRow(i)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={addRow}
                    className="bg-white border border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fb] px-3 py-1.5 rounded-[3px] text-[12px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Insert Row
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelected} />

      <div className="fixed bottom-0 left-[160px] right-0 z-40 bg-white border-t border-[#c3c4c7] shadow-lg">
        <div className="w-full flex items-center justify-between px-6 py-3.5">
          <p className="text-[12px] text-[#646970] italic">Make sure to save changes for settings to take effect instantly.</p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-[#2271b1] border border-[#2271b1] text-white text-[13px] font-bold rounded-[3px] hover:bg-[#135e96] hover:border-[#135e96] shadow-sm disabled:opacity-60 transition-colors cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving Changes…" : "Save Changes"}
          </button>
        </div>
      </div>
    </AdminPageLayout>
  );
}

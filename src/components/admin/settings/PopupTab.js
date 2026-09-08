"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Sparkles, Image as ImageIcon, Eye,
  ArrowRight, X, CheckCircle2, AlertCircle
} from "lucide-react";
import MediaPickerModal from "@/components/admin/MediaPickerModal";

const inputClass = "w-full border border-[#8c8f94] rounded-[3px] px-3 py-[7px] text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white";
const labelClass = "block text-[13px] font-semibold text-[#1d2327] mb-[4px]";
const descClass = "text-[12px] text-[#646970] mt-[2px]";
const sectionTitle = "text-[14px] font-bold text-[#1d2327] pb-2 mb-4 border-b border-[#c3c4c7]";

export default function PopupTab({ config, onChange }) {
  const popup = {
    enabled: false,
    bannerUrl: "",
    badgeText: "",
    title: "",
    description: "",
    buttonLabel: "",
    buttonLink: "",
    openInNewTab: false,
    delaySeconds: 1,
    frequency: "session",
    ...(config.popup || {})
  };

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);

  const update = (key, val) => {
    onChange({
      ...config,
      popup: {
        ...popup,
        [key]: val
      }
    });
  };

  // Safe string coercion
  const bannerUrl = String(popup.bannerUrl || "").trim();
  const badgeText = String(popup.badgeText || "").trim();
  const title = String(popup.title || "").trim();
  const description = String(popup.description || "").trim();
  const buttonLabel = String(popup.buttonLabel || "").trim();
  const rawButtonLink = String(popup.buttonLink || "").trim();

  // Resolved link logic matching storefront
  let resolvedLink = rawButtonLink;
  if (
    resolvedLink &&
    !resolvedLink.startsWith("http://") &&
    !resolvedLink.startsWith("https://") &&
    !resolvedLink.startsWith("//") &&
    !resolvedLink.startsWith("mailto:") &&
    !resolvedLink.startsWith("tel:") &&
    !resolvedLink.startsWith("#") &&
    !resolvedLink.startsWith("/")
  ) {
    if (resolvedLink.startsWith("www.")) {
      resolvedLink = `https://${resolvedLink}`;
    } else {
      resolvedLink = `/${resolvedLink}`;
    }
  }

  const hasBanner = Boolean(bannerUrl);
  const hasBadge = Boolean(badgeText);
  const hasTitle = Boolean(title);
  const hasDesc = Boolean(description);
  const hasButton = Boolean(buttonLabel && resolvedLink);
  const hasAnyContent = Boolean(hasBanner || hasBadge || hasTitle || hasDesc || hasButton);

  // Close test modal on ESC key
  useEffect(() => {
    if (!testModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setTestModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [testModalOpen]);

  // Lock body scroll when test modal is open
  useEffect(() => {
    if (testModalOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [testModalOpen]);

  return (
    <div className="space-y-8">
      {/* ── Status Card ── */}
      <div className="bg-white border border-[#c3c4c7] rounded-[3px] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              popup.enabled ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-[15px] font-bold text-[#1d2327]">Storefront Popup</h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  popup.enabled
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-neutral-100 text-neutral-600 border border-neutral-300"
                }`}>
                  {popup.enabled ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Live on Storefront
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" /> Disabled
                    </>
                  )}
                </span>
              </div>
              <p className="text-[12px] text-[#646970] mt-1">
                Show an announcement or promotional modal to visitors when they load the website.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setTestModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold text-[#2271b1] border border-[#2271b1] hover:bg-[#f0f6fb] rounded-[3px] transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview Popup
            </button>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(popup.enabled)}
                onChange={(e) => update("enabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2271b1]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Form & Live Preview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Settings Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Banner Image Section */}
          <div className="bg-white border border-[#c3c4c7] rounded-[3px] p-5 shadow-sm">
            <h4 className={sectionTitle}>Banner Image</h4>
            <p className={descClass + " mb-4"}>
              Optional top banner image. If left empty, the popup will gracefully display in a sleek text-centered luxury style.
            </p>

            <div className="space-y-3">
              {hasBanner && (
                <div className="relative rounded-lg overflow-hidden border border-[#c3c4c7] bg-neutral-50 max-w-md aspect-[16/9] group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bannerUrl}
                    alt="Popup Banner"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMediaPickerOpen(true)}
                      className="px-3 py-1.5 bg-white text-[#1d2327] rounded text-[12px] font-medium hover:bg-neutral-100 shadow cursor-pointer"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => update("bannerUrl", "")}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-[12px] font-medium hover:bg-red-700 shadow cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMediaPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 border border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fb] px-3 py-1.5 rounded-[3px] text-[12px] font-medium transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {hasBanner ? "Replace from Media Library" : "Select from Media Library"}
                </button>
                {hasBanner && (
                  <button
                    type="button"
                    onClick={() => update("bannerUrl", "")}
                    className="text-red-600 hover:text-red-800 text-[12px] font-medium hover:underline cursor-pointer"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              <div className="pt-2">
                <label className="block text-[11px] font-medium text-[#646970] mb-1">
                  Or paste direct image URL
                </label>
                <input
                  type="url"
                  value={popup.bannerUrl || ""}
                  onChange={(e) => update("bannerUrl", e.target.value)}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="bg-white border border-[#c3c4c7] rounded-[3px] p-5 shadow-sm space-y-4">
            <h4 className={sectionTitle}>Popup Content</h4>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-[3px] text-[12px] text-amber-800">
              💡 <strong>Tip:</strong> Any field left empty (badge, title, description, or button) will <strong>not</strong> be displayed on the storefront popup.
            </div>

            <div>
              <label className={labelClass}>Badge / Eyebrow Text (Optional)</label>
              <input
                type="text"
                value={popup.badgeText || ""}
                onChange={(e) => update("badgeText", e.target.value)}
                placeholder="e.g. EXCLUSIVE OFFER, NEW ARRIVALS, VIP ACCESS"
                className={inputClass}
              />
              <p className={descClass}>Small uppercase label displayed above the title. Leave blank to hide.</p>
            </div>

            <div>
              <label className={labelClass}>Popup Title (Optional)</label>
              <input
                type="text"
                value={popup.title || ""}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Experience Pure Luxury Shearling"
                className={inputClass}
              />
              <p className={descClass}>Main headline of the popup. Leave blank to hide.</p>
            </div>

            <div>
              <label className={labelClass}>Description / Message (Optional)</label>
              <textarea
                rows={4}
                value={popup.description || ""}
                onChange={(e) => update("description", e.target.value)}
                placeholder="e.g. Subscribe today to receive our seasonal lookbook and enjoy complimentary bespoke monogramming on your first handcrafted shearling jacket."
                className={`${inputClass} resize-y min-h-[90px]`}
              />
              <p className={descClass}>Supporting promotional or informative text. Leave blank to hide.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className={labelClass}>Button Label (Optional)</label>
                <input
                  type="text"
                  value={popup.buttonLabel || ""}
                  onChange={(e) => update("buttonLabel", e.target.value)}
                  placeholder="e.g. Shop Collection, Claim Discount"
                  className={inputClass}
                />
                <p className={descClass}>Text on the main call-to-action button. Leave blank to hide button.</p>
              </div>

              <div>
                <label className={labelClass}>Button Link (Optional)</label>
                <input
                  type="text"
                  value={popup.buttonLink || ""}
                  onChange={(e) => update("buttonLink", e.target.value)}
                  placeholder="e.g. /shop, /custom-jacket, https://..."
                  className={inputClass}
                />
                <p className={descClass}>Destination URL. If empty, the button will not appear.</p>
              </div>
            </div>

            <div className="pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(popup.openInNewTab)}
                  onChange={(e) => update("openInNewTab", e.target.checked)}
                  className="rounded border-[#8c8f94] text-[#2271b1] focus:ring-[#2271b1]"
                />
                <span className="text-[13px] text-[#1d2327]">Open link in a new tab</span>
              </label>
            </div>
          </div>

          {/* Behavior & Display Rules */}
          <div className="bg-white border border-[#c3c4c7] rounded-[3px] p-5 shadow-sm space-y-4">
            <h4 className={sectionTitle}>Display Rules & Timing</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Display Frequency</label>
                <select
                  value={popup.frequency || "session"}
                  onChange={(e) => update("frequency", e.target.value)}
                  className={inputClass}
                >
                  <option value="session">Once per session (Recommended)</option>
                  <option value="daily">Once every 24 hours</option>
                  <option value="always">Every page load (Testing mode)</option>
                </select>
                <p className={descClass}>
                  Controls how frequently the popup appears to the same visitor.
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  Display Delay ({popup.delaySeconds ?? 1} second{(popup.delaySeconds ?? 1) === 1 ? "" : "s"})
                </label>
                <div className="flex items-center gap-3 mt-1.5">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={Number.isFinite(Number(popup.delaySeconds)) ? Number(popup.delaySeconds) : 1}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      update("delaySeconds", isNaN(val) ? 1 : Math.max(0, val));
                    }}
                    className="flex-1 accent-[#2271b1]"
                  />
                  <span className="text-[13px] font-mono font-bold w-12 text-right text-[#1d2327]">
                    {popup.delaySeconds ?? 1}s
                  </span>
                </div>
                <p className={descClass}>
                  Time to wait after the page loads before revealing the popup.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <div className="bg-white border border-[#c3c4c7] rounded-[3px] p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#c3c4c7]">
              <div>
                <h4 className="text-[13px] font-bold uppercase tracking-wider text-[#1d2327]">
                  Live Preview
                </h4>
                <p className="text-[11px] text-[#646970]">
                  Updates in real time as you edit
                </p>
              </div>
              <span className="text-[11px] px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded font-medium text-neutral-600">
                Customer View
              </span>
            </div>

            {/* Preview Box Simulation */}
            <div className="bg-neutral-900/80 p-4 sm:p-6 rounded-xl flex items-center justify-center min-h-[360px]">
              {hasAnyContent ? (
                <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-black/10 transition-all">
                  {/* Top Image if present */}
                  {hasBanner && (
                    <div className="relative w-full aspect-[16/9] bg-neutral-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bannerUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/90">
                        <X className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  )}

                  <div className="p-6">
                    {/* Close button if no banner */}
                    {!hasBanner && (
                      <div className="flex justify-end -mt-2 -mr-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                          <X className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}

                    {/* Badge if present */}
                    {hasBadge && (
                      <div className="mb-3">
                        <span className="inline-block px-2.5 py-1 rounded-full bg-black text-white text-[9px] font-bold tracking-[0.2em] uppercase max-w-full truncate">
                          {badgeText}
                        </span>
                      </div>
                    )}

                    {/* Title if present */}
                    {hasTitle && (
                      <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-neutral-900 mb-2 leading-tight break-words">
                        {title}
                      </h3>
                    )}

                    {/* Description if present */}
                    {hasDesc && (
                      <p className="text-xs text-neutral-600 leading-relaxed mb-5 whitespace-pre-line break-words">
                        {description}
                      </p>
                    )}

                    {/* Button if present */}
                    {hasButton && (
                      <div className="space-y-2">
                        <div className="w-full h-11 bg-black text-white rounded-xl text-[11px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-sm px-3">
                          <span className="truncate">{buttonLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                        </div>
                        <p className="text-center text-[10px] text-neutral-400">
                          Maybe later
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 text-white/60 text-xs">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Enter a title, description, image, or button to see the preview.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#f0f0f1] text-[11px] text-[#646970] space-y-1">
              <p>• Empty elements automatically collapse and hide.</p>
              <p>• Clicking &quot;Save Changes&quot; in the bottom bar will publish updates live.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Media Picker Modal ── */}
      {mediaPickerOpen && (
        <MediaPickerModal
          open
          title="Select Banner Image"
          onClose={() => setMediaPickerOpen(false)}
          onSelect={(item) => {
            const url = item?.url || "";
            update("bannerUrl", url);
            setMediaPickerOpen(false);
          }}
        />
      )}

      {/* ── Full Interactive Test Modal (Simulates storefront experience) ── */}
      {testModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            onClick={() => setTestModalOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />

          {/* Dialog Container */}
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-black/10 overflow-hidden transform transition-all duration-300 z-10 scale-100 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            {/* Banner Image */}
            {hasBanner && (
              <div className="relative w-full aspect-[16/9] bg-neutral-100 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerUrl}
                  alt="Banner"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-all cursor-pointer shadow-lg"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="p-6 sm:p-8 overflow-y-auto">
              {/* Close Button if no image */}
              {!hasBanner && (
                <div className="flex justify-end -mt-3 -mr-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setTestModalOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Badge */}
              {hasBadge && (
                <div className="mb-3.5">
                  <span className="inline-block px-3 py-1 rounded-full bg-black text-white text-[10px] font-bold tracking-[0.2em] uppercase max-w-full truncate">
                    {badgeText}
                  </span>
                </div>
              )}

              {/* Title */}
              {hasTitle && (
                <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-neutral-900 mb-2.5 leading-tight break-words">
                  {title}
                </h2>
              )}

              {/* Description */}
              {hasDesc && (
                <p className="text-sm text-neutral-600 leading-relaxed mb-6 whitespace-pre-line break-words">
                  {description}
                </p>
              )}

              {/* Action Button */}
              {hasButton && (
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTestModalOpen(false);
                      toast.success(`Preview Action: would navigate to "${resolvedLink}"${popup.openInNewTab ? " in a new tab" : ""}`);
                    }}
                    className="w-full h-12 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer px-4"
                  >
                    <span className="truncate">{buttonLabel}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestModalOpen(false)}
                    className="w-full text-center text-xs text-neutral-400 hover:text-neutral-700 py-1 transition-colors cursor-pointer"
                  >
                    Maybe later
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

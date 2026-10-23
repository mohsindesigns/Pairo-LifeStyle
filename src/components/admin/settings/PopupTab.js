"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Sparkles, Image as ImageIcon, Eye,
  ArrowRight, X, CheckCircle2, AlertCircle
} from "lucide-react";
import MediaPickerModal from "@/components/admin/MediaPickerModal";

import { Postbox, Notice } from "@/components/admin/ui";

const ctrlWrap = { flex: "1 1 320px", minWidth: 0 };

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
    <div>
      {/* ── Status ── */}
      <Postbox
        title="Storefront popup"
        aside={
          <span className={`wp-pill wp-pill-sm ${popup.enabled ? "wp-st-published" : "wp-st-draft"}`}>
            {popup.enabled ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" aria-hidden="true" /> Live on storefront
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Disabled
              </>
            )}
          </span>
        }
      >
        <div className="wp-frow">
          <span className="wp-flabel">Popup</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2" style={ctrlWrap}>
            <label className="wp-check" htmlFor="popup-enabled">
              <input
                id="popup-enabled"
                type="checkbox"
                checked={Boolean(popup.enabled)}
                onChange={(e) => update("enabled", e.target.checked)}
              />
              Show the popup on the storefront
            </label>
            <button
              type="button"
              onClick={() => setTestModalOpen(true)}
              className="wp-btn"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              Preview popup
            </button>
          </div>
          <p className="wp-hint">Show an announcement or promotional modal to visitors when they load the website.</p>
        </div>
      </Postbox>

      {/* ── Main Layout: Form & Live Preview ── */}
      <div className="wp-cols">
        {/* Left Column: Settings Form */}
        <div className="wp-col-main">
          {/* Banner Image Section */}
          <Postbox title="Banner image">
            <p className="wp-desc mt-0 mb-3">
              Optional top banner image. If left empty, the popup will gracefully display in a sleek text-centered luxury style.
            </p>

            {hasBanner && (
              <div className="relative overflow-hidden border border-[#c3c4c7] bg-[#f0f0f1] max-w-md aspect-[16/9] group mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerUrl}
                  alt="Popup Banner"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMediaPickerOpen(true)}
                    className="wp-btn"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => update("bannerUrl", "")}
                    className="wp-btn" style={{ color: "#b32d2e", borderColor: "#b32d2e" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <div className="wp-frow">
              <span className="wp-flabel">Media library</span>
              <div className="flex flex-wrap items-center gap-3" style={ctrlWrap}>
                <button
                  type="button"
                  onClick={() => setMediaPickerOpen(true)}
                  className="wp-btn"
                >
                  <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  {hasBanner ? "Replace from Media Library" : "Select from Media Library"}
                </button>
                {hasBanner && (
                  <button
                    type="button"
                    onClick={() => update("bannerUrl", "")}
                    className="inline-flex items-center min-h-[30px] max-[782px]:min-h-10 px-1 text-[#b32d2e] hover:underline"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>

            <div className="wp-frow">
              <label className="wp-flabel" htmlFor="popup-banner-url">Or image URL</label>
              <input
                id="popup-banner-url"
                type="url"
                value={popup.bannerUrl || ""}
                onChange={(e) => update("bannerUrl", e.target.value)}
                placeholder="https://..."
                className="wp-input"
              />
              <p className="wp-hint">Paste a direct image URL instead of choosing from the library.</p>
            </div>
          </Postbox>

          {/* Content Section */}
          <Postbox title="Popup content">
            <Notice type="info">
              <strong>Tip:</strong> Any field left empty (badge, title, description, or button) will <strong>not</strong> be displayed on the storefront popup.
            </Notice>

            <div className="wp-frow">
              <label className="wp-flabel" htmlFor="popup-badge">Badge / eyebrow text</label>
              <input
                id="popup-badge"
                type="text"
                value={popup.badgeText || ""}
                onChange={(e) => update("badgeText", e.target.value)}
                placeholder="e.g. EXCLUSIVE OFFER, NEW ARRIVALS, VIP ACCESS"
                className="wp-input"
              />
              <p className="wp-hint">Optional. Small uppercase label displayed above the title. Leave blank to hide.</p>
            </div>

            <div className="wp-frow">
              <label className="wp-flabel" htmlFor="popup-title">Popup title</label>
              <input
                id="popup-title"
                type="text"
                value={popup.title || ""}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Experience Pure Luxury Shearling"
                className="wp-input"
              />
              <p className="wp-hint">Optional. Main headline of the popup. Leave blank to hide.</p>
            </div>

            <div className="wp-frow items-start">
              <label className="wp-flabel pt-1" htmlFor="popup-description">Description / message</label>
              <div style={ctrlWrap}>
                <textarea
                  id="popup-description"
                  rows={4}
                  value={popup.description || ""}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="e.g. Subscribe today to receive our seasonal lookbook and enjoy complimentary bespoke monogramming on your first handcrafted shearling jacket."
                  className="wp-textarea min-h-[90px] max-w-[520px]"
                />
              </div>
              <p className="wp-hint">Optional. Supporting promotional or informative text. Leave blank to hide.</p>
            </div>

            <div className="wp-frow">
              <label className="wp-flabel" htmlFor="popup-button-label">Button label</label>
              <input
                id="popup-button-label"
                type="text"
                value={popup.buttonLabel || ""}
                onChange={(e) => update("buttonLabel", e.target.value)}
                placeholder="e.g. Shop Collection, Claim Discount"
                className="wp-input"
              />
              <p className="wp-hint">Optional. Text on the main call-to-action button. Leave blank to hide button.</p>
            </div>

            <div className="wp-frow">
              <label className="wp-flabel" htmlFor="popup-button-link">Button link</label>
              <input
                id="popup-button-link"
                type="text"
                value={popup.buttonLink || ""}
                onChange={(e) => update("buttonLink", e.target.value)}
                placeholder="e.g. /shop, /custom-jacket, https://..."
                className="wp-input"
              />
              <p className="wp-hint">Optional. Destination URL. If empty, the button will not appear.</p>
            </div>

            <div className="wp-frow">
              <span className="wp-flabel">Link target</span>
              <div style={ctrlWrap}>
                <label className="wp-check" htmlFor="popup-new-tab">
                  <input
                    id="popup-new-tab"
                    type="checkbox"
                    checked={Boolean(popup.openInNewTab)}
                    onChange={(e) => update("openInNewTab", e.target.checked)}
                  />
                  Open link in a new tab
                </label>
              </div>
            </div>
          </Postbox>

          {/* Behavior & Display Rules */}
          <Postbox title="Display rules and timing">
            <div className="wp-frow">
              <label className="wp-flabel" htmlFor="popup-frequency">Display frequency</label>
              <select
                id="popup-frequency"
                value={popup.frequency || "session"}
                onChange={(e) => update("frequency", e.target.value)}
                className="wp-select"
              >
                <option value="session">Once per session (Recommended)</option>
                <option value="daily">Once every 24 hours</option>
                <option value="always">Every page load (Testing mode)</option>
              </select>
              <p className="wp-hint">Controls how frequently the popup appears to the same visitor.</p>
            </div>

            <div className="wp-frow">
              <label className="wp-flabel" htmlFor="popup-delay">
                Display delay ({popup.delaySeconds ?? 1} second{(popup.delaySeconds ?? 1) === 1 ? "" : "s"})
              </label>
              <div className="flex items-center gap-3 min-h-10" style={{ ...ctrlWrap, maxWidth: 360 }}>
                <input
                  id="popup-delay"
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={Number.isFinite(Number(popup.delaySeconds)) ? Number(popup.delaySeconds) : 1}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    update("delaySeconds", isNaN(val) ? 1 : Math.max(0, val));
                  }}
                  className="flex-1 min-w-0 accent-[#2271b1]"
                />
                <span className="wp-strong font-mono w-12 text-right" aria-hidden="true">
                  {popup.delaySeconds ?? 1}s
                </span>
              </div>
              <p className="wp-hint">Time to wait after the page loads before revealing the popup.</p>
            </div>
          </Postbox>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div className="wp-col-side lg:sticky lg:top-6">
          <Postbox title="Live preview" aside="Customer view">
            <p className="wp-desc mt-0 mb-3">Updates in real time as you edit.</p>

            {/* Preview Box Simulation */}
            <div className="bg-neutral-900/80 p-4 sm:p-6 rounded-xl flex items-center justify-center min-h-[360px]">
              {hasAnyContent ? (
                <div className={`w-full ${hasBanner ? 'max-w-md' : 'max-w-xs'} bg-white rounded-2xl shadow-2xl overflow-hidden border border-black/10 transition-all flex flex-col`}>
                  {/* Banner Image */}
                  {hasBanner && (
                    <div className="relative w-full h-36 shrink-0 bg-neutral-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bannerUrl}
                        alt="Preview"
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                  )}

                  <div className="p-4 flex-1 min-w-0 flex flex-col justify-between relative">
                    {/* Close button indicator */}
                    <div className="flex justify-end -mt-1 -mr-1 mb-2">
                      <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                        <X className="w-3 h-3" />
                      </div>
                    </div>

                    <div>
                      {/* Badge if present */}
                      {hasBadge && (
                        <div className="mb-2">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-black text-white text-[9px] font-bold tracking-[0.2em] uppercase max-w-full truncate">
                            {badgeText}
                          </span>
                        </div>
                      )}

                      {/* Title if present */}
                      {hasTitle && (
                        <h3 className="text-base font-bold uppercase tracking-tight text-neutral-900 mb-1.5 leading-tight break-words">
                          {title}
                        </h3>
                      )}

                      {/* Description if present */}
                      {hasDesc && (
                        <p className="text-xs text-neutral-600 leading-relaxed mb-4 whitespace-pre-line break-words line-clamp-4">
                          {description}
                        </p>
                      )}
                    </div>

                    {/* Button if present */}
                    {hasButton && (
                      <div className="space-y-1.5 pt-1 mt-auto">
                        <div className="w-full h-10 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-sm px-3">
                          <span className="truncate">{buttonLabel}</span>
                          <ArrowRight className="w-3 h-3 shrink-0" />
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

            <ul className="wp-desc mt-3 mb-0 pl-4 list-disc space-y-1">
              <li>Empty elements automatically collapse and hide.</li>
              <li>Click &quot;Save changes&quot; below to publish updates live.</li>
            </ul>
          </Postbox>
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
          <div className={`relative w-full ${hasBanner ? 'max-w-[480px] md:max-w-[760px] md:h-[440px]' : 'max-w-[440px] md:h-[360px]'} bg-white rounded-2xl shadow-2xl border border-black/10 overflow-hidden transform transition-all duration-300 z-10 scale-100 animate-in zoom-in-95 max-h-[88vh] md:max-h-[460px] flex flex-col ${hasBanner ? 'md:flex-row' : ''}`}>
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setTestModalOpen(false)}
              className="absolute top-3 right-3 z-30 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white md:bg-black/10 md:hover:bg-black/20 md:text-neutral-800 transition-all cursor-pointer shadow-sm"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Banner Image — TOP on mobile, LEFT on desktop */}
            {hasBanner && (
              <div className="relative w-full h-44 sm:h-52 md:h-full md:w-[44%] lg:w-[46%] shrink-0 bg-neutral-100 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerUrl}
                  alt="Banner"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            )}

            {/* Modal Content Body — BOTTOM on mobile, RIGHT on desktop */}
            <div className="p-5 sm:p-7 md:p-8 lg:p-9 flex-1 min-w-0 overflow-y-auto flex flex-col justify-between">
              <div>
                {/* Badge */}
                {hasBadge && (
                  <div className="mb-2 sm:mb-3">
                    <span className="inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-black text-white text-[9px] sm:text-[10px] font-bold tracking-[0.15em] sm:tracking-[0.2em] uppercase max-w-full truncate">
                      {badgeText}
                    </span>
                  </div>
                )}

                {/* Title */}
                {hasTitle && (
                  <h2 className="text-base sm:text-xl md:text-2xl font-bold uppercase tracking-tight text-neutral-900 mb-2 leading-tight break-words">
                    {title}
                  </h2>
                )}

                {/* Description */}
                {hasDesc && (
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed mb-4 whitespace-pre-line break-words">
                    {description}
                  </p>
                )}
              </div>

              {/* Action Button */}
              {hasButton && (
                <div className="space-y-2 pt-2 mt-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setTestModalOpen(false);
                      toast.success(`Preview Action: would navigate to "${resolvedLink}"${popup.openInNewTab ? " in a new tab" : ""}`);
                    }}
                    className="w-full h-10 sm:h-11 md:h-12 bg-black text-white rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer px-3 sm:px-4"
                  >
                    <span className="truncate">{buttonLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestModalOpen(false)}
                    className="w-full text-center text-[10px] sm:text-xs text-neutral-400 hover:text-neutral-700 py-0.5 transition-colors cursor-pointer"
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

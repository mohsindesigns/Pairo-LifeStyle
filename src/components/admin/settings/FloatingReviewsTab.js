"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { Postbox, Notice } from "@/components/admin/ui";

const ctrlWrap = { flex: "1 1 320px", minWidth: 0 };

export default function FloatingReviewsTab({ config, onChange }) {
  const fr = {
    enabled: true,
    label: "Google Reviews",
    topOffset: 50,
    ...(config.floatingReviews || {}),
  };

  const update = (key, val) => {
    onChange({ ...config, floatingReviews: { ...fr, [key]: val } });
  };

  const offset = Number.isFinite(Number(fr.topOffset)) ? Number(fr.topOffset) : 50;

  return (
    <div>
      <Postbox
        title="Floating reviews tab"
        aside={
          <span className={`wp-pill wp-pill-sm ${fr.enabled ? "wp-st-published" : "wp-st-draft"}`}>
            {fr.enabled ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" aria-hidden="true" /> Live on storefront
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Hidden
              </>
            )}
          </span>
        }
      >
        <Notice type="info">
          A tab fixed to the right edge of the storefront. Clicking it opens a side panel listing all customer reviews
          from the Testimonials section. It is hidden automatically when there are no reviews.
        </Notice>

        <div className="wp-frow">
          <span className="wp-flabel">Reviews tab</span>
          <div style={ctrlWrap}>
            <label className="wp-check" htmlFor="floating-reviews-enabled">
              <input
                id="floating-reviews-enabled"
                type="checkbox"
                checked={Boolean(fr.enabled)}
                onChange={(e) => update("enabled", e.target.checked)}
              />
              Show the floating reviews tab on the storefront
            </label>
          </div>
        </div>

        <div className="wp-frow">
          <label className="wp-flabel" htmlFor="floating-reviews-label">Tab label</label>
          <input
            id="floating-reviews-label"
            type="text"
            value={fr.label || ""}
            onChange={(e) => update("label", e.target.value)}
            placeholder="Google Reviews"
            className="wp-input"
            maxLength={40}
          />
          <p className="wp-hint">Text shown vertically on the tab. Defaults to &quot;Google Reviews&quot; when empty.</p>
        </div>

        <div className="wp-frow">
          <label className="wp-flabel" htmlFor="floating-reviews-offset">Vertical position ({offset}%)</label>
          <div className="flex items-center gap-3 min-h-10" style={{ ...ctrlWrap, maxWidth: 360 }}>
            <input
              id="floating-reviews-offset"
              type="range"
              min="10"
              max="90"
              step="5"
              value={offset}
              onChange={(e) => update("topOffset", parseInt(e.target.value, 10) || 50)}
              className="flex-1 min-w-0 accent-[#2271b1]"
            />
            <span className="wp-strong font-mono w-12 text-right" aria-hidden="true">{offset}%</span>
          </div>
          <p className="wp-hint">Distance from the top of the screen. 50% is vertically centered.</p>
        </div>

        <p className="wp-desc mt-3 mb-0">Click &quot;Save changes&quot; below to publish updates live.</p>
      </Postbox>
    </div>
  );
}

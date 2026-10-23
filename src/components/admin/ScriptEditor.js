"use client";

import React, { useState } from "react";
import { Postbox } from "@/components/admin/ui";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function ScriptEditor({ initialData = null, isEdit = false }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => {
    const data = initialData ? JSON.parse(JSON.stringify(initialData)) : {
      name: "",
      type: "custom",
      location: "head",
      loadStrategy: "afterInteractive",
      priority: 10,
      isActive: true,
      code: "",
      templateConfig: {
        trackingId: "",
        pixelId: "",
        verificationId: "",
        verificationProvider: "google"
      },
      targeting: {
        type: "all",
        routes: []
      }
    };
    if (data.templateConfig && !data.templateConfig.verificationProvider) {
      data.templateConfig.verificationProvider = "google";
    }
    return data;
  });

  const templates = {
    ga4: {
      title: "Google Analytics 4 (GA4)",
      description: "Injects the Global Site Tag (gtag.js) for GA4 measurement.",
      help: "Enter your Measurement ID (e.g., G-XXXXXXXXXX)",
      placeholder: "G-XXXXXXXXXX",
      field: "trackingId"
    },
    gtm: {
      title: "Google Tag Manager",
      description: "Injects the GTM container code into the head and body.",
      help: "Enter your Container ID (e.g., GTM-XXXXXXX)",
      placeholder: "GTM-XXXXXXX",
      field: "trackingId"
    },
    meta_pixel: {
      title: "Meta (Facebook) Pixel",
      description: "Injects the standard Meta Pixel tracking code.",
      help: "Enter your Pixel ID (numeric only)",
      placeholder: "1234567890",
      field: "pixelId"
    },
    verification: {
      title: "Site Verification Meta Tag",
      description: "Adds a <meta> tag for site ownership verification (Google, Pinterest, Bing, Facebook).",
      help: "Enter the verification string / token",
      placeholder: "abc123xyz...",
      field: "verificationId"
    },
    tiktok_pixel: {
      title: "TikTok Pixel",
      description: "Injects the standard TikTok Pixel base code for conversion tracking.",
      help: "Enter your Pixel ID",
      placeholder: "C4A1B2C3D4E5F6G7H8I9",
      field: "pixelId"
    },
    pinterest: {
      title: "Pinterest Tag",
      description: "Loads the Pinterest base tag and auto-fires conversion events (add to cart, checkout) at checkout. Enable/disable here to control all Pinterest tracking.",
      help: "Enter your Pinterest Tag ID (numeric)",
      placeholder: "2612345678901",
      field: "pixelId"
    },
    hotjar: {
      title: "Hotjar",
      description: "Injects the Hotjar tracking code for heatmaps and session recordings.",
      help: "Enter your Hotjar Site ID",
      placeholder: "1234567",
      field: "trackingId"
    },
    clarity: {
      title: "Microsoft Clarity",
      description: "Injects the Microsoft Clarity tracking code for heatmaps and session recordings.",
      help: "Enter your Clarity Project ID",
      placeholder: "abcd1234ef",
      field: "trackingId"
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const url = isEdit ? `/api/admin/scripts/${initialData._id}` : "/api/admin/scripts";
      const method = isEdit ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        toast.success(isEdit ? "Script updated" : "Script created successfully");
        router.push("/admin/settings/scripts");
        router.refresh();
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to save");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const tpl = templates[formData.type];
  const MONO = 'Menlo, Consolas, Monaco, "Liberation Mono", monospace';

  return (
    <div className="wp-cols">
      {/* Primary Configuration */}
      <div className="wp-col-main">
        <form id="script-form" onSubmit={handleSave}>

          <Postbox title="Script configuration">
            <div className="wp-frow">
              <label htmlFor="script-name" className="wp-flabel">Name <span className="wp-muted">(required)</span></label>
              <input
                id="script-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Google Analytics 4"
                className="wp-input"
              />
              <span className="wp-hint">Use a descriptive name to identify this script in the audit logs.</span>
            </div>
            <div className="wp-frow">
              <label htmlFor="script-type" className="wp-flabel">Type</label>
              <select
                id="script-type"
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="wp-select"
              >
                 <option value="custom">Custom Snippet (HTML/JS/CSS)</option>
                 <option value="ga4">GA4 Template</option>
                 <option value="gtm">GTM Template</option>
                 <option value="meta_pixel">Meta Pixel Template</option>
                 <option value="tiktok_pixel">TikTok Pixel Template</option>
                 <option value="pinterest">Pinterest Tag Template</option>
                 <option value="verification">Verification Meta Tag</option>
                 <option value="hotjar">Hotjar Template</option>
                 <option value="clarity">MS Clarity Template</option>
              </select>
            </div>
            <div className="wp-frow">
              <label htmlFor="script-location" className="wp-flabel">Placement</label>
              <select
                id="script-location"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="wp-select"
              >
                 <option value="head">Header (&lt;head&gt;)</option>
                 <option value="body_top">Body Start (&lt;body&gt;)</option>
                 <option value="body_bottom">Body End (Footer)</option>
              </select>
            </div>
            <div className="wp-frow">
              <span className="wp-flabel" id="script-status-label">Status</span>
              <label className="wp-check">
                <input
                  type="checkbox"
                  aria-labelledby="script-status-label"
                  checked={Boolean(formData.isActive)}
                  onChange={() => setFormData({...formData, isActive: !formData.isActive})}
                />
                <span>{formData.isActive ? 'Active on store' : 'Paused'}</span>
              </label>
            </div>
          </Postbox>

          <Postbox title="Script content" aside={formData.type !== 'custom' ? "Auto-generated" : undefined}>
            {formData.type === 'custom' ? (
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-1" style={{ marginBottom: 6 }}>
                  <label htmlFor="script-code" className="wp-label" style={{ margin: 0 }}>Code</label>
                  <span className="wp-muted wp-small">Supports &lt;script&gt;, &lt;style&gt;, &lt;meta&gt;</span>
                </div>
                <textarea
                  id="script-code"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  placeholder="<!-- Paste your tracking script here -->"
                  spellCheck={false}
                  className="wp-textarea"
                  style={{ fontFamily: MONO, fontSize: 13, minHeight: 280, background: "#f6f7f7", whiteSpace: "pre", overflow: "auto", tabSize: 2 }}
                />
              </div>
            ) : tpl ? (
              <div>
                <p className="wp-strong" style={{ margin: "0 0 2px" }}>{tpl.title}</p>
                <p className="wp-muted" style={{ margin: "0 0 10px" }}>{tpl.description}</p>
                {formData.type === 'verification' && (
                  <div className="wp-frow">
                    <label htmlFor="script-verification-provider" className="wp-flabel">Verification provider</label>
                    <select
                      id="script-verification-provider"
                      value={formData.templateConfig.verificationProvider || 'google'}
                      onChange={(e) => setFormData({
                        ...formData,
                        templateConfig: {
                          ...formData.templateConfig,
                          verificationProvider: e.target.value
                        }
                      })}
                      className="wp-select"
                    >
                      <option value="google">Google Search Console (google-site-verification)</option>
                      <option value="pinterest">Pinterest (p:domain_verify)</option>
                      <option value="bing">Bing Webmaster (msvalidate.01)</option>
                      <option value="facebook">Facebook Domain Verification (facebook-domain-verification)</option>
                    </select>
                  </div>
                )}
                <div className="wp-frow">
                  <label htmlFor="script-template-id" className="wp-flabel">ID</label>
                  <input
                    id="script-template-id"
                    type="text"
                    placeholder={tpl.placeholder}
                    value={formData.templateConfig[tpl.field] || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      templateConfig: {
                        ...formData.templateConfig,
                        [tpl.field]: e.target.value
                      }
                    })}
                    className="wp-input"
                    style={{ fontFamily: MONO }}
                  />
                  <span className="wp-hint">{tpl.help}</span>
                </div>
              </div>
            ) : (
              <p className="wp-empty" style={{ margin: 0 }}>
                Selected template configuration coming soon. Use &apos;Custom Snippet&apos; for now.
              </p>
            )}
          </Postbox>

          <Postbox title="Route targeting">
            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend className="sr-only">Where to load this script</legend>
              <label className="wp-check">
                <input
                  type="radio"
                  name="script-targeting"
                  checked={formData.targeting.type === 'all'}
                  onChange={() => setFormData({...formData, targeting: {...formData.targeting, type: 'all'}})}
                />
                <span>Load on all pages</span>
              </label>
              <label className="wp-check">
                <input
                  type="radio"
                  name="script-targeting"
                  checked={formData.targeting.type === 'specific'}
                  onChange={() => setFormData({...formData, targeting: {...formData.targeting, type: 'specific'}})}
                />
                <span>Specific routes only</span>
              </label>
            </fieldset>
            {formData.targeting.type === 'specific' && (
              <div style={{ marginTop: 10 }}>
                <label htmlFor="script-routes" className="wp-label">Routes</label>
                <textarea
                  id="script-routes"
                  rows={4}
                  placeholder="/checkout\n/cart\n/products/*"
                  value={formData.targeting.routes.join('\n')}
                  onChange={(e) => setFormData({...formData, targeting: {...formData.targeting, routes: e.target.value.split('\n')}})}
                  className="wp-textarea"
                  style={{ fontFamily: MONO }}
                />
                <p className="wp-desc">Enter one route per line. Use * for wildcards (e.g., /blog/*).</p>
              </div>
            )}
          </Postbox>
        </form>
      </div>

      {/* Sidebar Controls */}
      <div className="wp-col-side">
        <Postbox
          title="Publish"
          flush
          footer={
            <>
              <button
                type="button"
                onClick={() => router.back()}
                className="wp-link"
                style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "#b32d2e", minHeight: 30 }}
              >
                Cancel
              </button>
              <span className="wp-spacer" />
              <button
                type="submit"
                form="script-form"
                disabled={loading}
                className="wp-btn wp-btn-primary"
              >
                {loading ? "Saving…" : (isEdit ? 'Update' : 'Publish')}
              </button>
            </>
          }
        >
          <div className="wp-misc">
            <div className="wp-misc-row">
              <span className="wp-muted">Status:</span>
              <span className="wp-strong">{formData.isActive ? 'Active' : 'Paused'}</span>
            </div>
            <div className="wp-misc-row">
              <span className="wp-muted">Visibility:</span>
              <span className="wp-strong">Public</span>
            </div>
          </div>
        </Postbox>

        <Postbox title="Advanced placement">
          <div className="wp-field">
            <label htmlFor="script-load-strategy" className="wp-label">Load strategy</label>
            <select
              id="script-load-strategy"
              value={formData.loadStrategy}
              onChange={(e) => setFormData({...formData, loadStrategy: e.target.value})}
              className="wp-select wp-full"
            >
               <option value="afterInteractive">After Interactive (Default)</option>
               <option value="beforeInteractive">Before Interactive (Critical)</option>
               <option value="lazyOnload">Lazy Onload (Non-critical)</option>
               <option value="async">Native Async</option>
               <option value="defer">Native Defer</option>
            </select>
          </div>
          <div className="wp-field" style={{ marginBottom: 0 }}>
            <label htmlFor="script-priority" className="wp-label">Execution priority</label>
            <input
              id="script-priority"
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
              className="wp-input wp-full"
            />
            <p className="wp-desc">Lower numbers load first (e.g., 0 loads before 10).</p>
          </div>
        </Postbox>

        <div className="wp-notice wp-notice-warning">
          <p>
            <span className="wp-strong">Security warning:</span> Scripts have full access to your DOM. Never paste code from untrusted sources. All injections are audited and signed.
          </p>
        </div>
      </div>
    </div>
  );
}

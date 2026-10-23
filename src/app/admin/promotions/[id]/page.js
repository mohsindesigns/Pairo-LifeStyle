"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { Page, PageHeader, Postbox, Notice, Skeleton } from "@/components/admin/ui";
import usePromotionEditor from "@/components/admin/promotions/usePromotionEditor";
import RuleGroupBlock from "@/components/admin/promotions/RuleBuilder/RuleGroupBlock";
import ActionBlock from "@/components/admin/promotions/ActionBuilder/ActionBlock";
import SimulationPanel from "@/components/admin/promotions/Simulator/SimulationPanel";
import Validator from "@/lib/promotionEngine/Validator";

import RevisionHistory from "@/components/admin/promotions/History/RevisionHistory";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";
import { toLocalDateInput, fromLocalDateInput, parsePriority } from "@/components/admin/promotions/promotionEditorUtils";

export default function PromotionEditor({ isNew = false } = {}) {
  const params = useParams();
  const id = isNew ? "new" : (params?.id || "new");
  const router = useRouter();
  const { 
    formData, setFormData, updateField, updateCondition, 
    addRule, removeRule, addAction, removeAction, updateAction 
  } = usePromotionEditor();
  
  const [loading, setLoading] = useState(id !== "new");
  // "notfound" when the id doesn't exist (or is malformed), otherwise an error message.
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [revisionCount, setRevisionCount] = useState(null);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    fetch("/api/admin/products")
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setProducts(data); })
      .catch(err => console.error("Error loading products", err));

    fetch("/api/admin/categories?type=product")
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setCategories(data); })
      .catch(err => console.error("Error loading categories", err));

    fetch("/api/admin/categories?type=collection")
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setCollections(data); })
      .catch(err => console.error("Error loading collections", err));
  }, []);

  const handleRollback = (updatedPromo) => {
    setFormData(updatedPromo);
  };

  useEffect(() => {
    if (!id || id === "new") return;
    let active = true;
    fetch(`/api/admin/promotions/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (res.status === 404) {
          setLoadError("notfound");
        } else if (!res.ok || !data || typeof data !== "object") {
          setLoadError(data?.error || "Failed to load this promotion.");
        } else {
          // Older records may lack actions/conditions; the editor needs both shapes.
          setFormData({
            ...data,
            actions: Array.isArray(data.actions) ? data.actions : [],
            conditions: data.conditions && typeof data.conditions === "object" ? data.conditions : {},
            usageLimits: data.usageLimits || { maxTotalUses: null, maxUsesPerCustomer: 1 },
          });
        }
      })
      .catch(err => {
        console.error("Load failed:", err);
        if (active) setLoadError("Failed to load this promotion.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, setFormData]);

  const validation = useMemo(() => Validator.validate(formData), [formData]);

  const handleSave = async ({ asDraft = false } = {}) => {
    if (!validation.isValid) {
        toast.error("Please fix the errors before saving.");
        return;
    }
    const priority = parsePriority(formData.priority);
    if (!priority.ok) {
        toast.error(priority.error);
        return;
    }
    setSaving(true);
    try {
      const method = id === "new" ? "POST" : "PUT";
      const url = id === "new" ? "/api/admin/promotions" : `/api/admin/promotions/${id}`;
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, priority: priority.value, ...(asDraft ? { adminStatus: "Draft" } : {}) })
      });

      if (res.ok) {
        const saved = await res.json();
        if (saved.stripeSyncStatus === "error") {
          // Promotion saved fine in the app, but the Stripe Coupon/PromotionCode
          // create call failed — surface it instead of silently navigating away,
          // otherwise the admin has no way to know Stripe never got the code.
          setFormData(saved);
          toast.error(`Saved, but Stripe sync failed: ${saved.stripeSyncError || "unknown error"}`);
        } else {
          toast.success(asDraft ? "Promotion saved as a draft" : "Promotion saved");
          router.push("/admin/promotions");
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody.error || "Failed to save promotion.");
      }
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save promotion.");
    } finally {
      setSaving(false);
    }
  };

  const priorityCheck = parsePriority(formData.priority);

  if (loading) {
    return (
      <Page>
        <PageHeader title="Edit Promotion" />
        <div className="wp-postbox">
          <div className="wp-inside space-y-3">
            <span className="sr-only">Loading promotion…</span>
            <Skeleton height={34} />
            <Skeleton height={14} width="60%" />
            <Skeleton height={14} />
            <Skeleton height={14} width="80%" />
          </div>
        </div>
      </Page>
    );
  }

  if (loadError) {
    return (
      <RequirePermission permission="promotions.view">
      <Page>
        <PageHeader
          title="Edit Promotion"
          actions={<Link href="/admin/promotions" className="wp-btn">All promotions</Link>}
        />
        <Notice type="error">
          {loadError === "notfound"
            ? "This promotion was not found. It may have been deleted permanently, or the link is wrong."
            : loadError}
        </Notice>
      </Page>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission permission="promotions.manage">
    <Page>
      <PageHeader
        title={id === "new" ? "Create New Promotion" : "Edit Promotion"}
        actions={
          <>
            {id !== "new" && <Link href="/admin/promotions/new" className="wp-btn">Add new</Link>}
            <Link href="/admin/promotions" className="wp-btn">All promotions</Link>
          </>
        }
      />

      <div className="wp-cols">

        {/* Main column */}
        <div className="wp-col-main">
          {formData.adminStatus === "Archived" && id !== "new" && (
            <Notice type="warning">
              This promotion is archived and does not run. Restore it from the Archived list, or change its status in the Publish box and save.
            </Notice>
          )}
          <div className="wp-field">
            <label htmlFor="promo-title" className="sr-only">Promotion title</label>
            <input
              id="promo-title"
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Promotion title, e.g. Summer Flash Sale 2026"
              className="wp-title-input"
            />
          </div>

          <Postbox id="promo-general" title="General">
            <div className="wp-frow">
              <label htmlFor="promo-code" className="wp-flabel">Coupon code</label>
              <input
                id="promo-code"
                type="text"
                value={formData.code}
                onChange={(e) => updateField('code', e.target.value)}
                placeholder="e.g. SUMMER50"
                className="wp-input uppercase"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              />
              <span className="wp-hint">Optional. Leave empty for automatic application.</span>
            </div>
            <div className="wp-frow">
              <label htmlFor="promo-priority" className="wp-flabel">Priority (0–1000)</label>
              <input
                id="promo-priority"
                type="number"
                min="0"
                max="1000"
                step="1"
                value={formData.priority ?? ""}
                onChange={(e) => updateField('priority', e.target.value)}
                aria-invalid={!priorityCheck.ok}
                aria-describedby={!priorityCheck.ok ? "promo-priority-error" : undefined}
                className="wp-input"
              />
              {!priorityCheck.ok && (
                <span id="promo-priority-error" className="wp-hint" style={{ color: "var(--wp-danger)" }}>{priorityCheck.error}</span>
              )}
            </div>
            <div className="wp-frow">
              <span className="wp-flabel">Combining</span>
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <label htmlFor="exclusive" className="wp-check">
                  <input type="checkbox" id="exclusive" checked={formData.exclusive} onChange={(e) => updateField('exclusive', e.target.checked)} />
                  <span>Exclusive promotion</span>
                </label>
                <p className="wp-desc" style={{ marginTop: 0, marginBottom: 6 }}>If active, other promotions will be blocked.</p>
                <label htmlFor="stackable" className="wp-check">
                  <input type="checkbox" id="stackable" checked={formData.stackable} onChange={(e) => updateField('stackable', e.target.checked)} />
                  <span>Allow stacking</span>
                </label>
                <p className="wp-desc" style={{ marginTop: 0 }}>Can be combined with other stackable offers.</p>
              </div>
            </div>
            <div className="wp-frow">
              <label htmlFor="promo-max-total" className="wp-flabel">Max total uses</label>
              <input
                id="promo-max-total"
                type="number"
                min="1"
                value={formData.usageLimits?.maxTotalUses ?? ""}
                onChange={(e) => updateField('usageLimits', {
                  ...formData.usageLimits,
                  maxTotalUses: e.target.value === "" ? null : parseInt(e.target.value)
                })}
                placeholder="Unlimited"
                className="wp-input"
              />
              <span className="wp-hint">Total redemptions across all customers. Leave blank for unlimited.</span>
            </div>
            <div className="wp-frow">
              <label htmlFor="promo-max-customer" className="wp-flabel">Max uses per customer</label>
              <input
                id="promo-max-customer"
                type="number"
                min="1"
                value={formData.usageLimits?.maxUsesPerCustomer ?? ""}
                onChange={(e) => updateField('usageLimits', {
                  ...formData.usageLimits,
                  maxUsesPerCustomer: e.target.value === "" ? null : parseInt(e.target.value)
                })}
                placeholder="Unlimited"
                className="wp-input"
              />
              <span className="wp-hint">
                How many times one customer can redeem this. Leave blank for unlimited.
                <br />
                <span style={{ color: "var(--wp-warn)" }}>Enforced at checkout on this site. Stripe itself can&rsquo;t cap redemptions per customer, so this isn&rsquo;t enforced if someone pays via an admin-generated Payment Link and types the code in directly on Stripe&rsquo;s page.</span>
              </span>
            </div>
          </Postbox>

          <Postbox id="promo-conditions" title="Conditions" aside="Who and what qualifies">
            <RuleGroupBlock
              group={formData.conditions}
              onUpdate={updateCondition}
              onAdd={addRule}
              onRemove={removeRule}
              catalogData={{ products, categories, collections }}
            />
          </Postbox>

          <section className="wp-postbox" aria-labelledby="promo-actions-title">
            <div className="wp-postbox-head">
              <h2 id="promo-actions-title">Actions</h2>
              <button type="button" onClick={addAction} className="wp-btn">Add action</button>
            </div>
            <div className="wp-inside">
              {formData.actions.map((action, idx) => (
                <ActionBlock
                  key={idx}
                  action={action}
                  index={idx}
                  onUpdate={updateAction}
                  onRemove={removeAction}
                  catalogData={{ products, categories, collections }}
                />
              ))}
              {formData.actions.length === 0 && (
                <p className="wp-empty" style={{ textAlign: "center", border: "1px dashed var(--wp-border)", background: "var(--wp-alt)" }}>
                  No actions defined. A promotion must do something to be valid.
                </p>
              )}
            </div>
          </section>

          <SimulationPanel promotionData={formData} />

          {/* Revision History */}
          {id !== 'new' && (
            <RevisionHistory
              promotionId={id}
              onRollback={handleRollback}
              onCountChange={setRevisionCount}
            />
          )}
        </div>

        {/* Side column */}
        <div className="wp-col-side">
          <Postbox
            id="promo-publish"
            title="Publish"
            flush
            footer={
              <>
                <Link href="/admin/promotions" className="wp-link" style={{ color: "var(--wp-danger)" }}>Cancel</Link>
                <span className="wp-spacer" />
                <button
                  type="button"
                  onClick={() => handleSave({ asDraft: true })}
                  disabled={saving || !validation.isValid}
                  className="wp-btn"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving || !validation.isValid}
                  className="wp-btn wp-btn-primary"
                >
                  {saving ? "Saving…" : formData.adminStatus === "Active" ? "Publish" : "Save"}
                </button>
              </>
            }
          >
            <div className="wp-misc">
              <div className="wp-misc-row">
                <label htmlFor="promo-status">Status:</label>
                <select
                  id="promo-status"
                  value={formData.adminStatus}
                  onChange={(e) => updateField('adminStatus', e.target.value)}
                  className="wp-select"
                >
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <div className="wp-misc-row">
                <span>Visibility:</span>
                <span className="wp-strong">{formData.code ? 'Code-Required' : 'Automatic'}</span>
              </div>
              <div className="wp-misc-row" title={formData.stripeSyncStatus === 'error' ? formData.stripeSyncError : undefined}>
                <span>Stripe:</span>
                {formData.stripeSyncStatus === 'synced' && (
                  <span className="wp-strong inline-flex items-center gap-1" style={{ color: "var(--wp-ok)" }}><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Synced</span>
                )}
                {formData.stripeSyncStatus === 'error' && (
                  <span className="wp-strong inline-flex items-center gap-1" style={{ color: "var(--wp-danger)" }}><AlertTriangle className="w-4 h-4" aria-hidden="true" /> Sync failed</span>
                )}
                {formData.stripeSyncStatus === 'unsupported' && (
                  <span className="wp-muted">Not applicable</span>
                )}
                {(!formData.stripeSyncStatus || formData.stripeSyncStatus === 'pending') && (
                  <span className="wp-muted">Save to sync</span>
                )}
              </div>
              {formData.stripeSyncStatus === 'error' && formData.stripeSyncError && (
                <p className="wp-desc" style={{ marginTop: 0, color: "var(--wp-danger)", wordBreak: "break-word" }}>{formData.stripeSyncError}</p>
              )}
              <div className="wp-misc-row">
                <span>History:</span>
                <span className="wp-strong">
                  {id === "new"
                    ? "No revisions"
                    : revisionCount === null
                      ? "Loading…"
                      : revisionCount === undefined
                        ? "Unavailable"
                      : revisionCount === 0
                        ? "No revisions"
                        : `${revisionCount} revision${revisionCount === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--wp-border-2)", padding: "10px 12px 2px" }}>
              <div className="wp-field">
                <label htmlFor="promo-start" className="wp-label">Start date</label>
                <input
                  id="promo-start"
                  type="date"
                  value={toLocalDateInput(formData.startDate)}
                  onChange={(e) => updateField('startDate', fromLocalDateInput(e.target.value))}
                  className="wp-input wp-full"
                />
                <p className="wp-desc">Leave blank to start immediately.</p>
              </div>
              <div className="wp-field">
                <label htmlFor="promo-end" className="wp-label">End date</label>
                <input
                  id="promo-end"
                  type="date"
                  value={toLocalDateInput(formData.endDate)}
                  onChange={(e) => updateField('endDate', fromLocalDateInput(e.target.value, { endOfDay: true }))}
                  className="wp-input wp-full"
                />
                <p className="wp-desc">Leave blank to run indefinitely.</p>
              </div>
            </div>
          </Postbox>

          <Postbox id="promo-validation" title="Validation">
            {validation.errors.length === 0 && validation.warnings.length === 0 && (
              <p className="inline-flex items-center gap-2" style={{ margin: 0, color: "var(--wp-ok)" }}>
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>Configuration looks solid.</span>
              </p>
            )}
            {validation.errors.map((err, i) => (
              <div key={i} className="wp-notice wp-notice-error" style={{ margin: "0 0 8px", boxShadow: "none" }}>
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" style={{ color: "#d63638" }} />
                <p>{err.message}</p>
              </div>
            ))}
            {validation.warnings.map((warn, i) => (
              <div key={i} className="wp-notice wp-notice-warning" style={{ margin: "0 0 8px", boxShadow: "none" }}>
                <Info className="w-4 h-4 shrink-0" aria-hidden="true" style={{ color: "#996800" }} />
                <p>{warn.message}</p>
              </div>
            ))}
          </Postbox>
        </div>

      </div>
    </Page>
    </RequirePermission>
  );
}

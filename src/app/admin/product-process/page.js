"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import MediaPicker from "@/components/admin/MediaPicker";
import { GripVertical, ImageIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader, Postbox, Notice, Skeleton, formatDate } from "@/components/admin/ui";
import { reindexSteps, duplicateStepIn, trashStepIn, restoreStepIn, validateProcessSteps } from "@/lib/admin-products-utils";

// Unique id for a new process step (crypto.randomUUID where available).
function makeStepId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

export default function AdminProductProcessPage() {
  const { showConfirm } = usePopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("Our Craftsmanship Process");
  const [subtitle, setSubtitle] = useState("How we create our signature shearling masterpiece garments");
  const [steps, setSteps] = useState([]);
  const [trashedSteps, setTrashedSteps] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  // Id of a step added but never confirmed with "Update step": Cancel removes it again.
  const [newStepId, setNewStepId] = useState(null);
  
  // Step editing modal or inline form state
  const [editingStepId, setEditingStepId] = useState(null);
  const [editImage, setEditImage] = useState("");
  const [editHeading, setEditHeading] = useState("");
  const [editSubheading, setEditSubheading] = useState("");
  const [editDescription, setEditDescription] = useState("");


  const fetchProcess = async () => {
    try {
      const res = await fetch("/api/admin/product-process");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load the product process");
      applyServerData(data);
      setLoadError("");
    } catch (error) {
      console.error(error);
      setLoadError(error.message || "Failed to load the product process");
    } finally {
      setLoading(false);
    }
  };

  const snapshotOf = (t, st, sub, tr) => JSON.stringify({ t, st, sub, tr });

  const applyServerData = (data) => {
    // Every step needs a stable id (row key + duplicate/trash target); very old rows may lack one
    const withId = (s) => (s.id ? s : { ...s, id: String(s._id || makeStepId()) });
    const nextSteps = reindexSteps((data.steps || []).map(withId));
    const nextTrash = (data.trashedSteps || []).map(withId);
    setTitle(data.title || "");
    setSubtitle(data.subtitle || "");
    setSteps(nextSteps);
    setTrashedSteps(nextTrash);
    setSavedSnapshot(snapshotOf(data.title || "", nextSteps, data.subtitle || "", nextTrash));
  };

  useEffect(() => {
    // Load once on mount (deferred so no state is set synchronously inside the effect)
    Promise.resolve().then(fetchProcess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = useMemo(
    () => !loading && savedSnapshot !== snapshotOf(title, steps, subtitle, trashedSteps),
    [loading, savedSnapshot, title, steps, subtitle, trashedSteps]
  );

  // Applies the step form that is still open (so "Save Changes" never drops typed edits).
  const stepsWithOpenEdit = () => {
    if (!editingStepId) return steps;
    return steps.map((s) => s.id === editingStepId
      ? { ...s, image: editImage, heading: editHeading, subheading: editSubheading, description: editDescription }
      : s);
  };

  const handleSave = async () => {
    const toSave = stepsWithOpenEdit();
    const stepError = validateProcessSteps(toSave);
    if (stepError) {
      setSaveError(stepError);
      toast.error(stepError);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/admin/product-process", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitle, steps: toSave, trashedSteps })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save the product process");
      cancelEditing();
      applyServerData(data);
      toast.success("Product process saved");
    } catch (error) {
      console.error(error);
      setSaveError(error.message || "Failed to save the product process");
      toast.error(error.message || "Failed to save the product process");
    } finally {
      setSaving(false);
    }
  };

  // Add Step
  const handleAddStep = () => {
    const newStep = {
      id: makeStepId(),
      image: "",
      heading: "",
      subheading: "",
      description: "",
      order: steps.length
    };
    // Close (and keep) any step that is still open before starting a new one
    const base = stepsWithOpenEdit();
    setSteps([...base, newStep]);
    startEditing(newStep);
    setNewStepId(newStep.id);
  };

  const handleDuplicateStep = (id) => {
    const base = stepsWithOpenEdit();
    cancelEditing();
    setSteps(duplicateStepIn(base, id, makeStepId));
    toast.success("Step duplicated (remember to Save Changes)");
  };

  // Trash / restore / delete permanently (all kept locally until Save Changes)
  const handleTrashStep = (id) => {
    const base = editingStepId === id ? steps : stepsWithOpenEdit();
    if (editingStepId) cancelEditing();
    // A brand-new empty step has nothing worth keeping: drop it instead of trashing it
    const step = base.find((s) => s.id === id);
    if (id === newStepId && step && !step.heading && !step.image) {
      setSteps(reindexSteps(base.filter((s) => s.id !== id)));
      return;
    }
    const next = trashStepIn(base, trashedSteps, id);
    setSteps(next.steps);
    setTrashedSteps(next.trashed);
    toast.success("Step moved to trash (remember to Save Changes)");
  };

  const handleRestoreStep = (id) => {
    const next = restoreStepIn(steps, trashedSteps, id);
    setSteps(next.steps);
    setTrashedSteps(next.trashed);
    toast.success("Step restored (remember to Save Changes)");
  };

  const handleDeleteStepPermanently = async (id) => {
    const step = trashedSteps.find((s) => s.id === id);
    const ok = await showConfirm(
      `Permanently delete "${step?.heading || "this step"}"? It is removed for good when you click Save Changes.`,
      "Delete permanently",
      { confirmText: "Delete permanently", danger: true }
    );
    if (!ok) return;
    setTrashedSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleEmptyTrash = async () => {
    if (trashedSteps.length === 0) return;
    const ok = await showConfirm(
      `Permanently delete all ${trashedSteps.length} trashed step${trashedSteps.length === 1 ? "" : "s"}? They are removed for good when you click Save Changes.`,
      "Empty trash",
      { confirmText: "Empty trash", danger: true }
    );
    if (ok) setTrashedSteps([]);
  };

  // Start Editing Step
  const startEditing = (step) => {
    setEditingStepId(step.id);
    setEditImage(step.image);
    setEditHeading(step.heading);
    setEditSubheading(step.subheading);
    setEditDescription(step.description);
  };

  // Save Step Edit
  const saveStepEdit = (id) => {
    if (!editImage) {
      toast.error("Image is required for the step");
      return;
    }
    if (!editHeading.trim()) {
      toast.error("Step Heading is required");
      return;
    }

    const updated = steps.map(s => {
      if (s.id === id) {
        return {
          ...s,
          image: editImage,
          heading: editHeading,
          subheading: editSubheading,
          description: editDescription
        };
      }
      return s;
    });
    setSteps(updated);
    cancelEditing();
    toast.success("Step updated (remember to click Save Changes)");
  };

  // Cancel the step form; a new step that was never confirmed is removed again
  const handleCancelStep = () => {
    if (editingStepId && editingStepId === newStepId) {
      setSteps((prev) => reindexSteps(prev.filter((s) => s.id !== newStepId)));
    }
    cancelEditing();
  };

  const cancelEditing = () => {
    setNewStepId(null);
    setEditingStepId(null);
    setEditImage("");
    setEditHeading("");
    setEditSubheading("");
    setEditDescription("");
  };

  // Reorder up
  const moveUp = (index) => {
    if (index === 0) return;
    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[index - 1];
    newSteps[index - 1] = temp;
    // Re-index
    const reindexed = newSteps.map((s, i) => ({ ...s, order: i }));
    setSteps(reindexed);
  };

  // Reorder down
  const moveDown = (index) => {
    if (index === steps.length - 1) return;
    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[index + 1];
    newSteps[index + 1] = temp;
    // Re-index
    const reindexed = newSteps.map((s, i) => ({ ...s, order: i }));
    setSteps(reindexed);
  };

  // HTML5 Drag and Drop
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newSteps = [...steps];
    const draggedItem = newSteps[draggedIndex];
    
    // Remove and insert
    newSteps.splice(draggedIndex, 1);
    newSteps.splice(index, 0, draggedItem);
    
    // Update state and temp index
    setDraggedIndex(index);
    setSteps(newSteps.map((s, i) => ({ ...s, order: i })));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const openStep = (step) => {
    // Keep whatever was typed into the step that is currently open
    if (editingStepId && editingStepId !== step.id) setSteps(stepsWithOpenEdit());
    setNewStepId(null);
    startEditing(step);
  };

  if (loading) {
    return (
      <RequirePermission permission="products.view">
      <Page>
        <PageHeader title="Product Process" />
        <div className="wp-cols" aria-busy="true" aria-label="Loading product process">
          <div className="wp-col-main">
            <Postbox title="Section heading"><Skeleton height={30} /><div style={{ height: 12 }} /><Skeleton height={30} /></Postbox>
            <Postbox title="Process steps">{[0, 1, 2].map((i) => <Skeleton key={i} height={52} style={{ marginBottom: 8 }} />)}</Postbox>
          </div>
          <div className="wp-col-side"><Postbox title="Publish"><Skeleton height={40} /></Postbox></div>
        </div>
      </Page>
      </RequirePermission>
    );
  }

  if (loadError) {
    return (
      <RequirePermission permission="products.view">
      <Page>
        <PageHeader title="Product Process" aside={<Link href="/admin/products" className="wp-link">← Products</Link>} />
        <Notice type="error">{loadError}</Notice>
        <button type="button" className="wp-btn" onClick={() => { setLoading(true); fetchProcess(); }}>Try again</button>
      </Page>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission permission="products.view">
    <Page>
      <PageHeader
        title="Product Process"
        aside={<Link href="/admin/products" className="wp-link">← Products</Link>}
      />
      <p className="wp-desc" style={{ marginTop: 0, marginBottom: 12 }}>Configure the craftsmanship process section shown on all product pages.</p>

      <div className="wp-cols">
        <div className="wp-col-main">
          <Postbox title="Section heading" id="pp-general">
            <div className="wp-field">
              <label htmlFor="pp-title" className="wp-label">Section title</label>
              <input
                id="pp-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="wp-input wp-full"
                placeholder="e.g., The Craftsmanship Behind Pairo"
              />
            </div>
            <div className="wp-field" style={{ marginBottom: 0 }}>
              <label htmlFor="pp-subtitle" className="wp-label">Section subtitle</label>
              <input
                id="pp-subtitle"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="wp-input wp-full"
                placeholder="e.g., Each jacket is handcrafted through a rigorous master process."
              />
            </div>
          </Postbox>

          <Postbox
            title={`Process steps (${steps.length})`}
            id="pp-steps"
            aside={
              <button type="button" onClick={handleAddStep} className="wp-btn">
                Add process step
              </button>
            }
          >
            {steps.length === 0 ? (
              <p className="wp-empty" style={{ margin: 0, padding: 0 }}>No steps yet. Click &ldquo;Add process step&rdquo; to add the first one. With no steps, the section is hidden on product pages.</p>
            ) : (
              <>
                <p className="wp-desc" style={{ marginTop: 0, marginBottom: 10 }}>Drag steps by their bar to reorder, or use Move up / Move down.</p>
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {steps.map((step, index) => {
                    const isEditing = editingStepId === step.id;
                    return (
                      <li
                        key={step.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        style={{
                          border: `1px solid ${isEditing ? "#2271b1" : "#dcdcde"}`,
                          boxShadow: isEditing ? "0 0 0 1px #2271b1" : undefined,
                          background: "#fff",
                        }}
                      >
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f6f7f7", cursor: "move", minWidth: 0 }}
                        >
                          <GripVertical className="w-4 h-4" style={{ color: "#8c8f94", flex: "none" }} aria-hidden="true" />
                          <span className="wp-muted wp-small" style={{ flex: "none", minWidth: 18 }}>{index + 1}.</span>
                          <div className="wp-thumb">
                            {step.image ? <img src={step.image} alt="" /> : <ImageIcon className="w-4 h-4" aria-hidden="true" />}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="wp-strong" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.heading || "(No title)"}</div>
                            {step.subheading && <div className="wp-muted wp-small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.subheading}</div>}
                            <div className="wp-row-actions" style={{ visibility: "visible" }}>
                              <span><button type="button" onClick={() => moveUp(index)} disabled={index === 0} style={index === 0 ? { color: "#a7aaad", cursor: "default" } : undefined} aria-label={`Move step ${index + 1} up`}>Move up</button></span>
                              <span><button type="button" onClick={() => moveDown(index)} disabled={index === steps.length - 1} style={index === steps.length - 1 ? { color: "#a7aaad", cursor: "default" } : undefined} aria-label={`Move step ${index + 1} down`}>Move down</button></span>
                              {!isEditing ? (
                                <span><button type="button" onClick={() => openStep(step)}>Edit</button></span>
                              ) : null}
                              <span><button type="button" onClick={() => handleDuplicateStep(step.id)}>Duplicate</button></span>
                              <span><button type="button" onClick={() => handleTrashStep(step.id)} className="is-danger">Trash</button></span>
                            </div>
                          </div>
                        </div>

                        {isEditing && (
                          <div style={{ padding: 12, borderTop: "1px solid #dcdcde" }}>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="md:col-span-1">
                                <MediaPicker
                                  value={editImage}
                                  onChange={(url) => setEditImage(url)}
                                  label="Step Image"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
                                  <div className="wp-field">
                                    <label htmlFor={`pp-heading-${step.id}`} className="wp-label">Step heading</label>
                                    <input
                                      id={`pp-heading-${step.id}`}
                                      type="text"
                                      value={editHeading}
                                      onChange={(e) => setEditHeading(e.target.value)}
                                      className="wp-input wp-full"
                                    />
                                  </div>
                                  <div className="wp-field">
                                    <label htmlFor={`pp-subheading-${step.id}`} className="wp-label">Step subheading</label>
                                    <input
                                      id={`pp-subheading-${step.id}`}
                                      type="text"
                                      value={editSubheading}
                                      onChange={(e) => setEditSubheading(e.target.value)}
                                      className="wp-input wp-full"
                                    />
                                  </div>
                                </div>
                                <div className="wp-field">
                                  <label htmlFor={`pp-desc-${step.id}`} className="wp-label">Description</label>
                                  <textarea
                                    id={`pp-desc-${step.id}`}
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    rows={3}
                                    className="wp-textarea wp-full"
                                  />
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #f0f0f1", paddingTop: 10 }}>
                              <button type="button" onClick={handleCancelStep} className="wp-btn">
                                Cancel
                              </button>
                              <button type="button" onClick={() => saveStepEdit(step.id)} className="wp-btn wp-btn-primary">
                                Update step
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </Postbox>

          {trashedSteps.length > 0 && (
            <Postbox
              title={`Trash (${trashedSteps.length})`}
              id="pp-trash"
              aside={<button type="button" onClick={handleEmptyTrash} className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "#b32d2e" }}>Empty trash</button>}
            >
              <p className="wp-desc" style={{ marginTop: 0, marginBottom: 10 }}>Trashed steps are not shown on product pages. Restore puts a step back at the end of the list.</p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {trashedSteps.map((step) => (
                  <li key={step.id} className="wp-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #dcdcde", background: "#f6f7f7", minWidth: 0 }}>
                    <div className="wp-thumb">
                      {step.image ? <img src={step.image} alt="" /> : <ImageIcon className="w-4 h-4" aria-hidden="true" />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="wp-strong" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.heading || "(No title)"}</div>
                      {step.deletedAt && <div className="wp-muted wp-small">Trashed {formatDate(step.deletedAt)}</div>}
                      <div className="wp-row-actions" style={{ visibility: "visible" }}>
                        <span><button type="button" onClick={() => handleRestoreStep(step.id)}>Restore</button></span>
                        <span><button type="button" onClick={() => handleDeleteStepPermanently(step.id)} className="is-danger">Delete permanently</button></span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Postbox>
          )}
        </div>

        <div className="wp-col-side">
          <Postbox
            title="Publish"
            id="pp-publish"
            footer={
              <>
                <span className="wp-spacer" />
                <button type="button" onClick={handleSave} disabled={saving} className="wp-btn wp-btn-primary">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </>
            }
          >
            {saveError && <Notice type="error" onDismiss={() => setSaveError("")}>{saveError}</Notice>}
            <p className="wp-muted" style={{ margin: 0 }}>
              {steps.length} step{steps.length === 1 ? "" : "s"}{trashedSteps.length ? `, ${trashedSteps.length} in trash` : ""}.
            </p>
            <p className="wp-small" style={{ margin: "6px 0 0", color: isDirty ? "#996800" : "#646970" }} role="status">
              {isDirty ? "You have unsaved changes. Step edits, duplicates and trash are saved when you click Save Changes." : "All changes saved."}
            </p>
          </Postbox>
        </div>
      </div>
    </Page>
    </RequirePermission>
  );
}

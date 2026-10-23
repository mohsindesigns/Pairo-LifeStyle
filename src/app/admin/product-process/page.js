"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import MediaPicker from "@/components/admin/MediaPicker";
import { GripVertical, ImageIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader, Postbox } from "@/components/admin/ui";

export default function AdminProductProcessPage() {
  const { showConfirm } = usePopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("Our Craftsmanship Process");
  const [subtitle, setSubtitle] = useState("How we create our signature shearling masterpiece garments");
  const [steps, setSteps] = useState([]);
  
  // Step editing modal or inline form state
  const [editingStepId, setEditingStepId] = useState(null);
  const [editImage, setEditImage] = useState("");
  const [editHeading, setEditHeading] = useState("");
  const [editSubheading, setEditSubheading] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    fetchProcess();
  }, []);

  const fetchProcess = async () => {
    try {
      const res = await fetch("/api/admin/product-process");
      if (!res.ok) throw new Error("Failed to fetch product process");
      const data = await res.json();
      setTitle(data.title);
      setSubtitle(data.subtitle);
      setSteps(data.steps || []);
    } catch (error) {
      console.error(error);
      toast.error("Error loading process config");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/product-process", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitle, steps })
      });
      if (!res.ok) throw new Error("Failed to save product process");
      toast.success("Product process config saved successfully");
    } catch (error) {
      console.error(error);
      toast.error("Error saving process config");
    } finally {
      setSaving(false);
    }
  };

  // Add Step
  const handleAddStep = () => {
    const newStep = {
      id: Math.random().toString(36).substring(2, 11),
      image: "",
      heading: "New Step Heading",
      subheading: "Step Subheading",
      description: "Description of the step process...",
      order: steps.length
    };
    setSteps([...steps, newStep]);
    startEditing(newStep);
  };

  // Delete Step
  const handleDeleteStep = async (id) => {
    const ok = await showConfirm("Are you sure you want to delete this step?");
    if (ok) {
      const filtered = steps.filter(s => s.id !== id);
      // Re-index orders
      const reindexed = filtered.map((s, i) => ({ ...s, order: i }));
      setSteps(reindexed);
      if (editingStepId === id) {
        cancelEditing();
      }
    }
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

  // Cancel Editing Step
  const cancelEditing = () => {
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

  if (loading) {
    return (
      <Page>
        <PageHeader title="Product Process" />
        <p className="wp-muted">Loading product process settings…</p>
      </Page>
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
              <p className="wp-muted" style={{ margin: 0 }}>No steps configured yet. Click &ldquo;Add process step&rdquo; to start.</p>
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
                                <span><button type="button" onClick={() => startEditing(step)}>Edit</button></span>
                              ) : null}
                              <span><button type="button" onClick={() => handleDeleteStep(step.id)} className="is-danger">Delete</button></span>
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
                              <button type="button" onClick={cancelEditing} className="wp-btn">
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
        </div>

        <div className="wp-col-side">
          <Postbox
            title="Publish"
            id="pp-publish"
            footer={
              <>
                <span className="wp-spacer" />
                <button type="button" onClick={handleSave} disabled={saving} className="wp-btn wp-btn-primary">
                  {saving ? "Saving Changes..." : "Save Changes"}
                </button>
              </>
            }
          >
            <p className="wp-muted" style={{ margin: 0 }}>
              {steps.length} step{steps.length === 1 ? "" : "s"}. Step edits are kept locally until you click Save Changes.
            </p>
          </Postbox>
        </div>
      </div>
    </Page>
    </RequirePermission>
  );
}

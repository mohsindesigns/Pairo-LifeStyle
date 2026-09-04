"use client";

import React, { useState, useEffect } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import MediaPicker from "@/components/admin/MediaPicker";
import { ArrowUp, ArrowDown, Trash2, Plus, Edit2, Check, X, Move, ImageIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";

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
      <div className="bg-[#f0f2f1] min-h-screen p-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-[#2271b1] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[13px] text-[#646970]">Loading Product Process config...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageLayout
      title="Product Process Management"
      subtitle="Configure the craftsmanship process section shown on all product pages"
      breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: "Product Process" }]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 1 Column: General Settings */}
        <div className="bg-white p-6 border border-[#ccd0d4] rounded-[3px] shadow-sm space-y-4 h-fit">
          <h2 className="text-[14px] font-bold text-[#1d2327] border-b border-[#ccd0d4] pb-2 uppercase tracking-wide">
            General Options
          </h2>

          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#1d2327]">Section Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#f6f7f7] border border-[#dcdcde] px-3 py-2 text-[13px] focus:outline-none focus:border-[#2271b1] focus:bg-white transition-all rounded-[3px]"
              placeholder="e.g., The Craftsmanship Behind Pairo"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#1d2327]">Section Subtitle</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full bg-[#f6f7f7] border border-[#dcdcde] px-3 py-2 text-[13px] focus:outline-none focus:border-[#2271b1] focus:bg-white transition-all rounded-[3px]"
              placeholder="e.g., Each jacket is handcrafted through a rigorous master process."
            />
          </div>

          <div className="pt-2 border-t border-[#ccd0d4]">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#2271b1] text-white py-2 px-4 rounded-[3px] text-[13px] font-bold hover:bg-[#135e96] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Right 2 Columns: Steps List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 border border-[#ccd0d4] rounded-[3px] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#ccd0d4] pb-2">
              <h2 className="text-[14px] font-bold text-[#1d2327] uppercase tracking-wide">
                Process Steps ({steps.length})
              </h2>
              <button
                type="button"
                onClick={handleAddStep}
                className="bg-white border border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fb] px-3 py-1.5 rounded-[3px] text-[12px] font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Process Step
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#ccd0d4] rounded bg-[#f6f7f7]">
                <p className="text-[13px] text-[#646970]">No steps configured yet. Click "Add Process Step" to start!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => {
                  const isEditing = editingStepId === step.id;
                  return (
                    <div
                      key={step.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`border rounded bg-white transition-all ${
                        isEditing ? "border-[#2271b1] ring-1 ring-[#2271b1]/20 shadow-md" : "border-[#ccd0d4] hover:shadow-sm"
                      }`}
                    >
                      {/* Accordion header / main bar */}
                      <div className="flex items-center justify-between p-3.5 bg-[#fcfcfc] border-b border-[#f0f0f1] cursor-move">
                        <div className="flex items-center gap-3 min-w-0">
                          <Move className="w-4 h-4 text-[#8c8f94] shrink-0" />
                          <span className="text-[11px] font-bold text-white bg-black/80 px-2 py-0.5 rounded-[3px]">
                            {index + 1}
                          </span>
                          {step.image ? (
                            <img src={step.image} alt="" className="w-8 h-8 rounded object-cover border border-black/10 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-[#f0f0f1] border border-[#ccd0d4] flex items-center justify-center shrink-0">
                              <ImageIcon className="w-4 h-4 text-[#8c8f94]" />
                            </div>
                          )}
                          <div className="truncate">
                            <p className="text-[13px] font-bold text-[#1d2327] truncate">{step.heading || "(No title)"}</p>
                            {step.subheading && <p className="text-[11px] text-[#646970] truncate">{step.subheading}</p>}
                          </div>
                        </div>

                        {/* Reorder and Action controls */}
                        <div className="flex items-center gap-1 shrink-0 ml-4">
                          <button
                            type="button"
                            onClick={() => moveUp(index)}
                            disabled={index === 0}
                            className="p-1.5 hover:bg-[#f0f0f1] text-[#646970] disabled:opacity-30 rounded transition-colors"
                            title="Move Up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveDown(index)}
                            disabled={index === steps.length - 1}
                            className="p-1.5 hover:bg-[#f0f0f1] text-[#646970] disabled:opacity-30 rounded transition-colors"
                            title="Move Down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <div className="h-4 w-[1px] bg-[#ccd0d4] mx-1" />
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => startEditing(step)}
                              className="p-1.5 hover:bg-[#f0f6fb] text-[#2271b1] rounded transition-colors"
                              title="Edit Step"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDeleteStep(step.id)}
                            className="p-1.5 hover:bg-red-50 text-red-600 rounded transition-colors"
                            title="Delete Step"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Editing panel (rendered inside when active) */}
                      {isEditing && (
                        <div className="p-4 border-t border-[#ccd0d4] bg-[#f9f9fa] space-y-4 animate-in slide-in-from-top-2 duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                              <MediaPicker
                                value={editImage}
                                onChange={(url) => setEditImage(url)}
                                label="Step Image"
                              />
                            </div>
                            <div className="md:col-span-2 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-[#1d2327]">Step Heading</label>
                                  <input
                                    type="text"
                                    value={editHeading}
                                    onChange={(e) => setEditHeading(e.target.value)}
                                    className="w-full bg-white border border-[#dcdcde] px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#2271b1] rounded-[3px]"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-[#1d2327]">Step Subheading</label>
                                  <input
                                    type="text"
                                    value={editSubheading}
                                    onChange={(e) => setEditSubheading(e.target.value)}
                                    className="w-full bg-white border border-[#dcdcde] px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#2271b1] rounded-[3px]"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-[#1d2327]">Description</label>
                                <textarea
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  rows={3}
                                  className="w-full bg-white border border-[#dcdcde] px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#2271b1] rounded-[3px]"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-end gap-2 border-t border-[#f0f0f1] pt-3">
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="bg-white border border-[#dcdcde] text-[#3c434a] hover:bg-[#f6f7f7] px-3 py-1.5 rounded-[3px] text-[12px] font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => saveStepEdit(step.id)}
                              className="bg-[#2271b1] text-white hover:bg-[#135e96] px-3 py-1.5 rounded-[3px] text-[12px] font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Update Step
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}

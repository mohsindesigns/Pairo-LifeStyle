"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Save, 
  ArrowLeft, 
  Eye, 
  Settings, 
  Zap, 
  ShieldCheck, 
  Clock, 
  Info,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import usePromotionEditor from "@/components/admin/promotions/usePromotionEditor";
import RuleGroupBlock from "@/components/admin/promotions/RuleBuilder/RuleGroupBlock";
import ActionBlock from "@/components/admin/promotions/ActionBuilder/ActionBlock";
import SimulationPanel from "@/components/admin/promotions/Simulator/SimulationPanel";
import Validator from "@/lib/promotionEngine/Validator";

import RevisionHistory from "@/components/admin/promotions/History/RevisionHistory";

export default function PromotionEditor() {
  const { id } = useParams();
  const router = useRouter();
  const { 
    formData, setFormData, updateField, updateCondition, 
    addRule, removeRule, addAction, removeAction, updateAction 
  } = usePromotionEditor();
  
  const [loading, setLoading] = useState(id !== "new");
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState({ isValid: true, errors: [], warnings: [] });
  const [activeTab, setActiveTab] = useState("builder"); // builder, settings, simulation

  const handleRollback = (updatedPromo) => {
    setFormData(updatedPromo);
  };

  useEffect(() => {
    if (id && id !== "new") {
      fetch(`/api/admin/promotions/${id}`)
        .then(res => res.json())
        .then(data => {
          setFormData(data);
          setLoading(false);
        })
        .catch(err => console.error("Load failed:", err));
    }
  }, [id, setFormData]);

  useEffect(() => {
    const results = Validator.validate(formData);
    Promise.resolve().then(() => {
      setValidation(results);
    });
  }, [formData]);

  const handleSave = async () => {
    if (!validation.isValid) {
        alert("Please fix the errors before saving.");
        return;
    }
    setSaving(true);
    try {
      const method = id === "new" ? "POST" : "PUT";
      const url = id === "new" ? "/api/admin/promotions" : `/api/admin/promotions/${id}`;
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        router.push("/admin/promotions");
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400 italic">Initializing Enterprise Editor...</div>;

  return (
    <AdminPageLayout 
      title={id === "new" ? "Create New Promotion" : `Edit: ${formData.title}`}
      breadcrumbs={[{ label: "Promotions", href: "/admin/promotions" }, { label: id === "new" ? "New" : "Edit" }]}
    >
      <div className="flex flex-col lg:flex-row gap-6 items-start relative">
        
        {/* Main Editor Section */}
        <div className="flex-1 space-y-6 w-full">
          
          {/* Tabs */}
          <div className="flex items-center border-b border-gray-200 gap-6">
            <button 
              onClick={() => setActiveTab('builder')}
              className={`pb-3 text-[13px] font-bold transition-all border-b-2 px-1 ${activeTab === 'builder' ? 'border-[#2271b1] text-[#2271b1]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              RULE BUILDER
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`pb-3 text-[13px] font-bold transition-all border-b-2 px-1 ${activeTab === 'settings' ? 'border-[#2271b1] text-[#2271b1]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              CAMPAIGN SETTINGS
            </button>
            <button 
              onClick={() => setActiveTab('simulation')}
              className={`pb-3 text-[13px] font-bold transition-all border-b-2 px-1 ${activeTab === 'simulation' ? 'border-[#2271b1] text-[#2271b1]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              LIVE SIMULATION
            </button>
          </div>

          {activeTab === 'builder' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Conditions Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#2271b1]" />
                    <h2 className="text-sm font-bold text-[#1d2327] uppercase tracking-wider">Eligibility Conditions</h2>
                  </div>
                </div>
                <div className="bg-[#f6f7f7] border border-[#ccd0d4] p-4 rounded-sm shadow-sm">
                  <RuleGroupBlock 
                    group={formData.conditions} 
                    onUpdate={updateCondition}
                    onAdd={addRule}
                    onRemove={removeRule}
                  />
                </div>
              </section>

              {/* Actions Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-sm font-bold text-[#1d2327] uppercase tracking-wider">Campaign Actions</h2>
                  </div>
                  <button onClick={addAction} className="text-[11px] font-bold text-[#2271b1] hover:underline">+ ADD ACTION</button>
                </div>
                <div className="space-y-3">
                  {formData.actions.map((action, idx) => (
                    <ActionBlock 
                      key={idx} 
                      action={action} 
                      index={idx} 
                      onUpdate={updateAction}
                      onRemove={removeAction}
                    />
                  ))}
                  {formData.actions.length === 0 && (
                    <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-sm text-gray-400 italic bg-gray-50">
                      No actions defined. A promotion must do something to be valid.
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white border border-[#ccd0d4] p-6 space-y-6 shadow-sm rounded-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Promotion Title</label>
                    <input 
                      type="text" 
                      value={formData.title} 
                      onChange={(e) => updateField('title', e.target.value)}
                      placeholder="e.g., Summer Flash Sale 2026"
                      className="w-full border border-gray-300 p-2 text-[14px] outline-none focus:border-[#2271b1] rounded-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Coupon Code (Optional)</label>
                    <input 
                      type="text" 
                      value={formData.code} 
                      onChange={(e) => updateField('code', e.target.value)}
                      placeholder="e.g., SUMMER50"
                      className="w-full border border-gray-300 p-2 text-[14px] outline-none focus:border-[#2271b1] rounded-sm uppercase font-mono"
                    />
                    <p className="text-[11px] text-gray-400 italic">Leave empty for automatic application.</p>
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-6 pt-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Priority (0-1000)</label>
                    <input 
                      type="number" 
                      value={formData.priority} 
                      onChange={(e) => updateField('priority', parseInt(e.target.value))}
                      className="w-full border border-gray-300 p-2 text-[14px] outline-none focus:border-[#2271b1] rounded-sm"
                    />
                  </div>
                  <div className="flex flex-col justify-center space-y-2">
                     <div className="flex items-center gap-2">
                        <input type="checkbox" id="exclusive" checked={formData.exclusive} onChange={(e) => updateField('exclusive', e.target.checked)} />
                        <label htmlFor="exclusive" className="text-[13px] font-medium text-[#1d2327]">Exclusive Promotion</label>
                     </div>
                     <p className="text-[11px] text-gray-400">If active, other promotions will be blocked.</p>
                  </div>
                  <div className="flex flex-col justify-center space-y-2">
                     <div className="flex items-center gap-2">
                        <input type="checkbox" id="stackable" checked={formData.stackable} onChange={(e) => updateField('stackable', e.target.checked)} />
                        <label htmlFor="stackable" className="text-[13px] font-medium text-[#1d2327]">Allow Stacking</label>
                     </div>
                     <p className="text-[11px] text-gray-400">Can be combined with other stackable offers.</p>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'simulation' && (
            <div className="h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-300">
               <SimulationPanel promotionData={formData} />
            </div>
          )}
        </div>

        {/* Sidebar Summary */}
        <div className="w-full lg:w-80 space-y-4 lg:sticky lg:top-4">
            <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-sm overflow-hidden">
                <div className="bg-[#f6f7f7] border-b border-[#ccd0d4] px-4 py-2 flex items-center justify-between">
                    <span className="text-[12px] font-bold text-[#1d2327]">Publish</span>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between text-[13px]">
                        <span className="text-gray-500 flex items-center gap-2"><Settings className="w-4 h-4" /> Status:</span>
                        <select 
                          value={formData.adminStatus} 
                          onChange={(e) => updateField('adminStatus', e.target.value)}
                          className="font-bold text-[#2271b1] bg-transparent outline-none cursor-pointer"
                        >
                            <option value="Draft">Draft</option>
                            <option value="Active">Active</option>
                            <option value="Paused">Paused</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                        <span className="text-gray-500 flex items-center gap-2"><Eye className="w-4 h-4" /> Visibility:</span>
                        <span className="font-bold text-[#1d2327]">{formData.code ? 'Code-Required' : 'Automatic'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                        <span className="text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> History:</span>
                        <span className="font-bold text-[#1d2327]">No revisions</span>
                    </div>
                    
                    <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                        <button 
                          onClick={handleSave}
                          disabled={saving || !validation.isValid}
                          className="w-full bg-[#2271b1] hover:bg-[#135e96] text-white py-2 rounded-sm text-[13px] font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Campaign</>}
                        </button>
                        <Link href="/admin/promotions" className="w-full text-center py-2 text-[13px] text-rose-600 hover:underline">Cancel Changes</Link>
                    </div>
                </div>
            </div>

            {/* Revision History */}
            {id !== 'new' && (
              <RevisionHistory 
                promotionId={id} 
                onRollback={handleRollback} 
              />
            )}

            {/* Validation Panel */}
            <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-sm overflow-hidden">
                <div className="bg-[#f6f7f7] border-b border-[#ccd0d4] px-4 py-2">
                    <span className="text-[12px] font-bold text-[#1d2327]">System Validation</span>
                </div>
                <div className="p-4 space-y-3">
                    {validation.errors.length === 0 && validation.warnings.length === 0 && (
                        <div className="flex items-center gap-2 text-emerald-600 text-[12px]">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Configuration looks solid.</span>
                        </div>
                    )}
                    {validation.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-rose-600 text-[11px] bg-rose-50 p-2 rounded-sm border border-rose-100">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{err.message}</span>
                        </div>
                    ))}
                    {validation.warnings.map((warn, i) => (
                        <div key={i} className="flex items-start gap-2 text-amber-600 text-[11px] bg-amber-50 p-2 rounded-sm border border-amber-100">
                            <Info className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{warn.message}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

      </div>
    </AdminPageLayout>
  );
}

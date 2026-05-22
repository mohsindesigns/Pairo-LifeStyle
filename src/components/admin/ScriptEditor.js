"use client";

import React, { useState } from "react";
import { 
  Save, 
  X, 
  Code2, 
  Globe, 
  Settings2, 
  ShieldCheck, 
  Info,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Zap
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function ScriptEditor({ initialData = null, isEdit = false }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialData || {
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
      verificationId: ""
    },
    targeting: {
      type: "all",
      routes: []
    }
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
      title: "Meta Verification Tag",
      description: "Adds a <meta> tag for site ownership verification.",
      help: "Enter the verification string",
      placeholder: "abc123xyz...",
      field: "verificationId"
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Primary Configuration */}
      <div className="lg:col-span-2 space-y-6">
        <form id="script-form" onSubmit={handleSave} className="space-y-6">
          
          {/* General Details */}
          <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-hidden">
             <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#1d2327]" />
                <h3 className="text-[13px] font-bold text-[#1d2327] uppercase">Script Configuration</h3>
             </div>
             <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-[#1d2327]">Script Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="e.g. Google Analytics 4"
                        className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]/20 rounded-[3px] transition-all"
                      />
                      <p className="text-[11px] text-[#646970]">Use a descriptive name to identify this script in the audit logs.</p>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-[#1d2327]">Script Type</label>
                      <select 
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                        className="w-full border border-[#8c8f94] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] rounded-[3px] bg-white"
                      >
                         <option value="custom">Custom Snippet (HTML/JS/CSS)</option>
                         <option value="ga4">GA4 Template</option>
                         <option value="gtm">GTM Template</option>
                         <option value="meta_pixel">Meta Pixel Template</option>
                         <option value="verification">Verification Meta Tag</option>
                         <option value="hotjar">Hotjar Template</option>
                         <option value="clarity">MS Clarity Template</option>
                      </select>
                   </div>
                </div>
             </div>
          </div>

          {/* Content Editor */}
          <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-hidden">
             <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Code2 className="w-4 h-4 text-[#1d2327]" />
                   <h3 className="text-[13px] font-bold text-[#1d2327] uppercase">Script Content</h3>
                </div>
                {formData.type !== 'custom' && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase border border-blue-100">
                    <Zap className="w-3 h-3 fill-current" /> Auto-Generated
                  </span>
                )}
             </div>
             <div className="p-6">
                {formData.type === 'custom' ? (
                   <div className="space-y-1.5">
                      <div className="flex items-center justify-between mb-1">
                         <label className="text-[13px] font-bold text-[#1d2327]">Raw Snippet</label>
                         <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">Supports &lt;script&gt;, &lt;style&gt;, &lt;meta&gt;</span>
                      </div>
                      <textarea 
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                        placeholder="<!-- Paste your tracking script here -->"
                        className="w-full h-64 font-mono text-[12px] p-4 border border-[#8c8f94] outline-none focus:border-[#2271b1] rounded-[3px] bg-[#1e1e1e] text-[#d4d4d4] leading-relaxed shadow-inner"
                      />
                   </div>
                ) : (
                   <div className="bg-[#f0f6fb] border border-[#d1e4f3] p-6 rounded-[3px]">
                      {templates[formData.type] ? (
                        <div className="space-y-4">
                           <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-white rounded shadow-sm flex items-center justify-center text-blue-600">
                                 <CheckCircle2 className="w-6 h-6" />
                              </div>
                              <div>
                                 <h4 className="text-[15px] font-bold text-[#1d2327]">{templates[formData.type].title}</h4>
                                 <p className="text-[13px] text-[#646970] mt-1">{templates[formData.type].description}</p>
                              </div>
                           </div>
                           <div className="bg-white p-4 border border-[#d1e4f3] rounded space-y-3 shadow-inner">
                              <label className="text-[12px] font-bold text-[#1d2327] uppercase tracking-wider">{templates[formData.type].help}</label>
                              <input 
                                type="text"
                                placeholder={templates[formData.type].placeholder}
                                value={formData.templateConfig[templates[formData.type].field]}
                                onChange={(e) => setFormData({
                                  ...formData, 
                                  templateConfig: {
                                    ...formData.templateConfig, 
                                    [templates[formData.type].field]: e.target.value
                                  }
                                })}
                                className="w-full border border-[#8c8f94] px-4 py-3 text-[14px] outline-none focus:border-[#2271b1] rounded-[3px] font-mono"
                              />
                           </div>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-gray-500 italic">
                          Selected template configuration coming soon. Use &apos;Custom Snippet&apos; for now.
                        </div>
                      )}
                   </div>
                )}
             </div>
          </div>

          {/* Targeted Loading */}
          <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-hidden">
             <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#1d2327]" />
                <h3 className="text-[13px] font-bold text-[#1d2327] uppercase">Route Targeting</h3>
             </div>
             <div className="p-6">
                <div className="space-y-4">
                   <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer group">
                         <input 
                           type="radio" 
                           className="w-4 h-4 text-[#2271b1]" 
                           checked={formData.targeting.type === 'all'}
                           onChange={() => setFormData({...formData, targeting: {...formData.targeting, type: 'all'}})}
                         />
                         <span className="text-[13px] text-[#1d2327] group-hover:text-[#2271b1]">Load on all pages</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                         <input 
                           type="radio" 
                           className="w-4 h-4 text-[#2271b1]" 
                           checked={formData.targeting.type === 'specific'}
                           onChange={() => setFormData({...formData, targeting: {...formData.targeting, type: 'specific'}})}
                         />
                         <span className="text-[13px] text-[#1d2327] group-hover:text-[#2271b1]">Specific routes only</span>
                      </label>
                   </div>
                   {formData.targeting.type === 'specific' && (
                     <div className="space-y-2">
                        <textarea 
                           placeholder="/checkout\n/cart\n/products/*"
                           value={formData.targeting.routes.join('\n')}
                           onChange={(e) => setFormData({...formData, targeting: {...formData.targeting, routes: e.target.value.split('\n')}})}
                           className="w-full h-24 border border-[#8c8f94] p-3 text-[13px] outline-none focus:border-[#2271b1] rounded-[3px] font-mono"
                        />
                        <p className="text-[11px] text-[#646970]">Enter one route per line. Use * for wildcards (e.g., /blog/*).</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        </form>
      </div>

      {/* Sidebar Controls */}
      <div className="space-y-6">
         {/* Publishing Panel */}
         <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7]">
               <h3 className="text-[13px] font-bold text-[#1d2327] uppercase">Publishing</h3>
            </div>
            <div className="p-4 space-y-4">
               <div className="flex items-center justify-between text-[13px] text-[#646970]">
                  <span className="flex items-center gap-1.5"><Info className="w-4 h-4" /> Status:</span>
                  <span className={`font-bold ${formData.isActive ? 'text-green-600' : 'text-amber-600'}`}>
                     {formData.isActive ? 'Active' : 'Paused'}
                  </span>
               </div>
               <div className="flex items-center justify-between text-[13px] text-[#646970]">
                  <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> Visibility:</span>
                  <span className="font-bold text-[#1d2327]">Public</span>
               </div>
               <hr className="border-[#f0f0f1]" />
                <div className="space-y-3">
                   <div className="flex items-center justify-between p-3 bg-[#f6f7f7] border border-[#ccd0d4] rounded-[3px]">
                      <div className="flex flex-col">
                         <span className="text-[13px] font-bold text-[#1d2327]">Script Status</span>
                         <span className="text-[11px] text-[#646970]">{formData.isActive ? 'Active on store' : 'Currently paused'}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                           formData.isActive ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                      >
                         <span 
                           className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                              formData.isActive ? 'translate-x-5' : 'translate-x-1'
                           }`} 
                         />
                      </button>
                   </div>
                </div>
            </div>
            <div className="p-4 bg-[#f6f7f7] border-t border-[#ccd0d4] flex items-center justify-between">
               <button 
                 onClick={() => router.back()}
                 className="text-[#d63638] text-[13px] hover:underline"
               >
                 Cancel
               </button>
               <button 
                 type="submit" 
                 form="script-form"
                 disabled={loading}
                 className="bg-[#2271b1] hover:bg-[#135e96] text-white px-4 py-2 rounded-[3px] text-[13px] font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
               >
                  {loading ? "Saving..." : <><Save className="w-4 h-4" /> {isEdit ? 'Update' : 'Publish'}</>}
               </button>
            </div>
         </div>

         {/* Placement Panel */}
         <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7]">
               <h3 className="text-[13px] font-bold text-[#1d2327] uppercase">Advanced Placement</h3>
            </div>
            <div className="p-4 space-y-4">
               <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-[#1d2327] uppercase tracking-wider">Injection Point</label>
                  <select 
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full border border-[#8c8f94] px-2 py-1.5 text-[13px] outline-none focus:border-[#2271b1] rounded-[3px] bg-white"
                  >
                     <option value="head">Header (&lt;head&gt;)</option>
                     <option value="body_top">Body Start (&lt;body&gt;)</option>
                     <option value="body_bottom">Body End (Footer)</option>
                  </select>
               </div>
               <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-[#1d2327] uppercase tracking-wider">Load Strategy</label>
                  <select 
                    value={formData.loadStrategy}
                    onChange={(e) => setFormData({...formData, loadStrategy: e.target.value})}
                    className="w-full border border-[#8c8f94] px-2 py-1.5 text-[13px] outline-none focus:border-[#2271b1] rounded-[3px] bg-white"
                  >
                     <option value="afterInteractive">After Interactive (Default)</option>
                     <option value="beforeInteractive">Before Interactive (Critical)</option>
                     <option value="lazyOnload">Lazy Onload (Non-critical)</option>
                     <option value="async">Native Async</option>
                     <option value="defer">Native Defer</option>
                  </select>
               </div>
               <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-[#1d2327] uppercase tracking-wider">Execution Priority</label>
                  <input 
                    type="number" 
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                    className="w-full border border-[#8c8f94] px-2 py-1.5 text-[13px] outline-none focus:border-[#2271b1] rounded-[3px]"
                  />
                  <p className="text-[10px] text-[#646970]">Lower numbers load first (e.g., 0 loads before 10).</p>
               </div>
            </div>
         </div>

         {/* Security Check */}
         <div className="bg-[#fcf3d7] border border-[#f5c6cb] p-4 rounded-[3px] flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
            <p className="text-[12px] text-amber-800 leading-relaxed">
               <strong>Security Warning:</strong> Scripts have full access to your DOM. Never paste code from untrusted sources. All injections are audited and signed.
            </p>
         </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save, AlertCircle, Calendar, Users, Target, Tag, Info } from "lucide-react";

export default function NewPromotion() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    code: "",
    isAutomatic: false,
    adminStatus: "Active",
    priority: 10,
    stackable: false,
    exclusive: false,
    actions: [{ 
        type: "percentage_discount", 
        target: "cart", 
        value: 10,
        targetIds: [] 
    }],
    conditions: { 
        minCartValue: 0,
        logic: "AND",
        groups: [] 
    },
    usageLimits: {
        maxTotalUses: null,
        maxUsesPerUser: 1
    },
    startDate: "",
    endDate: "",
    tenantId: "DEFAULT_STORE"
  });

  const [availableProducts, setAvailableProducts] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch("/api/admin/products?status=Published"),
          fetch("/api/admin/categories?type=product")
        ]);
        if (prodRes.ok) setAvailableProducts(await prodRes.json());
        if (catRes.ok) setAvailableCategories(await catRes.json());
      } catch (err) {
        console.error("Failed to fetch selection data:", err);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
// ...
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create promotion");
      
      router.push("/admin/promotions");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="font-sans text-[#3c434a] bg-[#f0f2f1] min-h-screen p-4 md:p-8">
      <div className="max-w-[1000px] mx-auto">
        <Link href="/admin/promotions" className="flex items-center gap-1 text-[13px] text-[#2271b1] hover:underline mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to Promotions
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[23px] font-medium text-[#1d2327]">Create New Discount Offer</h1>
            <p className="text-[13px] text-gray-500 mt-1">Configure your discount rules, coupon codes, and targeting logic.</p>
          </div>
          <div className="flex gap-3">
             <button 
                type="button"
                onClick={() => router.push("/admin/promotions")}
                className="bg-white border border-[#c3c4c7] px-4 py-2 rounded-[3px] text-[13px] font-bold hover:bg-[#f6f7f7]"
             >
                Cancel
             </button>
             <button 
              onClick={handleSubmit}
              disabled={loading}
              className="bg-[#2271b1] hover:bg-[#135e96] text-white px-6 py-2 rounded-[3px] text-[13px] font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? "Saving..." : <><Save className="w-4 h-4" /> Save Discount</>}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-[#d63638]/10 border-l-4 border-[#d63638] p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#d63638]" />
            <p className="text-[13px] text-[#d63638]">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Core Campaign Info */}
            <section className="bg-white border border-[#c3c4c7] shadow-sm rounded-sm">
                <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-4 py-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-500" />
                    <h2 className="text-[14px] font-bold text-[#1d2327]">Campaign Identity</h2>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-[13px] font-bold text-[#1d2327] mb-1">Discount Name</label>
                        <input 
                            type="text" 
                            required
                            placeholder="e.g., Summer Flash Sale 2026"
                            className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[14px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                            value={formData.title}
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-[13px] font-bold text-[#1d2327] mb-1">Internal Description</label>
                        <textarea 
                            rows={2}
                            placeholder="Briefly describe the purpose of this campaign..."
                            className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[14px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                        />
                    </div>
                </div>
            </section>

            {/* Targeting & Logic */}
            <section className="bg-white border border-[#c3c4c7] shadow-sm rounded-sm">
                <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-4 py-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-gray-500" />
                    <h2 className="text-[14px] font-bold text-[#1d2327]">Targeting & Action</h2>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[13px] font-bold text-[#1d2327] mb-1">Apply Discount To</label>
                            <select 
                                className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[14px]"
                                value={formData.actions[0].target}
                                onChange={(e) => {
                                    const newActions = [...formData.actions];
                                    newActions[0].target = e.target.value;
                                    setFormData({...formData, actions: newActions});
                                }}
                            >
                                <option value="cart">Whole Cart</option>
                                <option value="category">Specific Categories</option>
                                <option value="product">Specific Products</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[13px] font-bold text-[#1d2327] mb-1">Discount Type</label>
                            <select 
                                className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[14px]"
                                value={formData.actions[0].type}
                                onChange={(e) => {
                                    const newActions = [...formData.actions];
                                    newActions[0].type = e.target.value;
                                    setFormData({...formData, actions: newActions});
                                }}
                            >
                                <option value="percentage_discount">Percentage (%)</option>
                                <option value="fixed_discount">Fixed Amount ($)</option>
                                <option value="free_shipping">Free Shipping</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[13px] font-bold text-[#1d2327] mb-1">Discount Value</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[14px]"
                                value={formData.actions[0].value}
                                onChange={(e) => {
                                    const newActions = [...formData.actions];
                                    newActions[0].value = parseFloat(e.target.value);
                                    setFormData({...formData, actions: newActions});
                                }}
                            />
                            <span className="absolute right-3 top-2 text-gray-400 text-sm">
                                {formData.actions[0].type === 'percentage_discount' ? '%' : '$'}
                            </span>
                        </div>
                    </div>

                    {formData.actions[0].target !== 'cart' && (
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-sm">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[12px] text-blue-700 font-medium uppercase flex items-center gap-1">
                                    <Info className="w-3 h-3" /> Select {formData.actions[0].target}s
                                </p>
                                <span className="text-[11px] text-blue-600 font-bold">{formData.actions[0].targetIds.length} Selected</span>
                            </div>
                            
                            <div className="relative mb-3">
                                <input 
                                    type="text"
                                    placeholder={`Search ${formData.actions[0].target}s...`}
                                    className="w-full border border-blue-200 rounded-[3px] px-3 py-1.5 text-[13px] outline-none focus:border-blue-400"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="max-h-[200px] overflow-y-auto border border-blue-100 bg-white rounded-sm custom-scrollbar">
                                {(formData.actions[0].target === 'product' ? availableProducts : availableCategories)
                                    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map(item => {
                                        const isSelected = formData.actions[0].targetIds.includes(item._id);
                                        return (
                                            <div 
                                                key={item._id}
                                                onClick={() => {
                                                    const newIds = isSelected 
                                                        ? formData.actions[0].targetIds.filter(id => id !== item._id)
                                                        : [...formData.actions[0].targetIds, item._id];
                                                    
                                                    const newActions = [...formData.actions];
                                                    newActions[0].targetIds = newIds;
                                                    setFormData({...formData, actions: newActions});
                                                }}
                                                className={`flex items-center justify-between px-3 py-2 border-b border-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`text-[13px] ${isSelected ? 'font-bold text-blue-700' : 'text-gray-700'}`}>{item.name}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono">{item._id}</span>
                                                </div>
                                                {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Conditions */}
            <section className="bg-white border border-[#c3c4c7] shadow-sm rounded-sm">
                <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-4 py-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-gray-500" />
                    <h2 className="text-[14px] font-bold text-[#1d2327]">Purchase Requirements</h2>
                </div>
                <div className="p-6">
                    <div>
                        <label className="block text-[13px] font-bold text-[#1d2327] mb-1">Minimum Subtotal</label>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500">$</span>
                            <input 
                                type="number" 
                                className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[14px]"
                                value={formData.conditions.minCartValue}
                                onChange={(e) => setFormData({...formData, conditions: { ...formData.conditions, minCartValue: parseFloat(e.target.value) }})}
                            />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">Customers must spend at least this amount to trigger the promotion.</p>
                    </div>
                </div>
            </section>
          </div>

          {/* Sidebar Settings */}
          <div className="space-y-6">
            
            {/* Activation Trigger */}
            <section className="bg-white border border-[#c3c4c7] shadow-sm rounded-sm">
                <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-4 py-3 font-bold text-[13px]">Activation</div>
                <div className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                className="rounded text-[#2271b1]"
                                checked={formData.isAutomatic}
                                onChange={(e) => setFormData({...formData, isAutomatic: e.target.checked, code: e.target.checked ? "" : formData.code})}
                            />
                            <span className="text-[13px]">Apply Automatically</span>
                        </label>
                        <p className="text-[11px] text-gray-500 ml-6">If enabled, customers don&apos;t need a code.</p>
                    </div>

                    {!formData.isAutomatic && (
                        <div>
                            <label className="block text-[12px] font-bold mb-1">Coupon Code</label>
                            <input 
                                type="text"
                                placeholder="SUMMER20"
                                className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] uppercase font-mono"
                                value={formData.code}
                                onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                            />
                        </div>
                    )}

                    <hr />

                    <div>
                        <label className="block text-[12px] font-bold mb-1">Priority (1-100)</label>
                        <input 
                            type="number"
                            className="w-full border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px]"
                            value={formData.priority}
                            onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Higher number wins conflicts.</p>
                    </div>
                </div>
            </section>

            {/* Schedule */}
            <section className="bg-white border border-[#c3c4c7] shadow-sm rounded-sm">
                <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-4 py-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <h2 className="text-[13px] font-bold text-[#1d2327]">Schedule</h2>
                </div>
                <div className="p-4 space-y-3">
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Start Date</label>
                        <input 
                            type="datetime-local"
                            className="w-full border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[12px]"
                            value={formData.startDate}
                            onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">End Date</label>
                        <input 
                            type="datetime-local"
                            className="w-full border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[12px]"
                            value={formData.endDate}
                            onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                        />
                    </div>
                </div>
            </section>

            {/* Limits */}
            <section className="bg-white border border-[#c3c4c7] shadow-sm rounded-sm">
                <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-4 py-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <h2 className="text-[13px] font-bold text-[#1d2327]">Usage Limits</h2>
                </div>
                <div className="p-4 space-y-3">
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Total Limit</label>
                        <input 
                            type="number"
                            placeholder="Unlimited"
                            className="w-full border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[12px]"
                            onChange={(e) => setFormData({...formData, usageLimits: { ...formData.usageLimits, maxTotalUses: parseInt(e.target.value) || null }})}
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Per User Limit</label>
                        <input 
                            type="number"
                            className="w-full border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[12px]"
                            value={formData.usageLimits.maxUsesPerUser}
                            onChange={(e) => setFormData({...formData, usageLimits: { ...formData.usageLimits, maxUsesPerUser: parseInt(e.target.value) }})}
                        />
                    </div>
                </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";

export default function NewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    status: "Draft",
    template: "default"
  });

  const handleTitleChange = (e) => {
    const title = e.target.value;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    setFormData({ ...formData, title, slug });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Page created successfully");
        router.push(`/admin/pages/${data._id}/builder`);
      } else {
        toast.error(data.error || "Failed to create page");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPageLayout 
      title="Create New Page" 
      subtitle="Define the core settings for your new dynamic page."
      backLink="/admin/pages"
    >
      <div className="max-w-2xl bg-white border border-[#ccd0d4] shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-bold text-[#1d2327]">Page Title</label>
            <input 
              type="text" 
              value={formData.title}
              onChange={handleTitleChange}
              required
              placeholder="e.g. Summer Collection 2024"
              className="w-full border border-[#8c8f94] outline-none px-3 py-2 text-[13px] bg-white focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] rounded-[3px]"
            />
            <p className="text-[11px] text-[#646970] italic">The internal name used to identify this page in the dashboard.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-bold text-[#1d2327]">URL Slug</label>
            <div className="flex items-center">
              <span className="bg-[#f0f0f1] border border-r-0 border-[#8c8f94] px-3 py-2 text-[13px] text-[#646970] rounded-l-[3px]">/</span>
              <input 
                type="text" 
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
                className="flex-1 border border-[#8c8f94] outline-none px-3 py-2 text-[13px] bg-white focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] rounded-r-[3px]"
              />
            </div>
            <p className="text-[11px] text-[#646970] italic">The public URL of the page. Only alphanumeric characters and dashes allowed.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-bold text-[#1d2327]">Page Template</label>
            <select
              value={formData.template}
              onChange={(e) => setFormData({ ...formData, template: e.target.value })}
              required
              className="w-full border border-[#8c8f94] outline-none px-3 py-2 text-[13px] bg-white focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] rounded-[3px]"
            >
              <option value="default">Default Template (General Landing Page)</option>
              <option value="home">Homepage Template</option>
              <option value="about">About Page Template</option>
              <option value="contact">Contact Page Template</option>
            </select>
            <p className="text-[11px] text-[#646970] italic">Select the dynamic structural template for this page. Locked after creation.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-bold text-[#1d2327]">Description (Optional)</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-[#8c8f94] outline-none px-3 py-2 text-[13px] bg-white focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] rounded-[3px]"
            />
          </div>

          <div className="pt-4 flex items-center justify-end border-t border-[#f0f0f1] gap-4">
            <button 
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 text-[13px] font-medium text-[#2271b1] hover:text-[#135e96]"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="bg-[#2271b1] text-white px-8 py-2 rounded-[3px] font-medium text-[13px] hover:bg-[#135e96] shadow-sm active:translate-y-px transition-all disabled:opacity-50"
            >
              {loading ? "Creating..." : "Continue to Builder"}
            </button>
          </div>
        </form>
      </div>
    </AdminPageLayout>
  );
}

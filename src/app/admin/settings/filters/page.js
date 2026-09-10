"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Search, Loader2, Filter, ToggleLeft, ToggleRight, Eye, EyeOff } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function CategoryFiltersPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/categories?type=product");
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        toast.error("Failed to load categories");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while fetching categories");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFilter = async (category) => {
    const newShowInFilters = !category.showInFilters;
    setSavingId(category._id);
    
    // Optimistic UI update
    setCategories(prev =>
      prev.map(c => (c._id === category._id ? { ...c, showInFilters: newShowInFilters } : c))
    );

    try {
      const res = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: category._id,
          showInFilters: newShowInFilters
        })
      });

      const result = await res.json();
      if (res.ok) {
        toast.success(
          `${category.name} is now ${newShowInFilters ? "visible in" : "hidden from"} shop filters.`
        );
      } else {
        // Rollback on error
        setCategories(prev =>
          prev.map(c => (c._id === category._id ? { ...c, showInFilters: !newShowInFilters } : c))
        );
        toast.error(result.error || "Failed to update category filter settings.");
      }
    } catch (err) {
      console.error(err);
      // Rollback on error
      setCategories(prev =>
        prev.map(c => (c._id === category._id ? { ...c, showInFilters: !newShowInFilters } : c))
      );
      toast.error("An error occurred while saving.");
    } finally {
      setSavingId(null);
    }
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminPageLayout title="Category Filters" subtitle="Manage which product categories appear in the shop filter tab">
      <div className="bg-white border border-[#c3c4c7] rounded shadow-sm max-w-5xl">
        {/* Header toolbar */}
        <div className="p-3 sm:p-4 border-b border-[#f0f0f1] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 bg-[#f6f7f7]">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-foreground/60" />
            <span className="font-bold text-[14px] text-[#1d2327]">Shop Filter Settings</span>
          </div>

          {/* Search */}
          <div className="relative min-w-0 sm:max-w-xs w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#646970]" />
            </span>
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 border border-[#8c8f94] rounded-[3px] px-3 py-[5px] text-[13px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] bg-white"
            />
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="p-6 md:p-12 flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#2271b1]" />
            <span className="text-[13px] text-[#646970]">Loading categories...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-6 md:p-12 text-center text-[#646970] text-[13px]">
            No categories found matching your query.
          </div>
        ) : (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full min-w-[520px] md:min-w-[760px] border-collapse text-left text-[13px] text-[#2c3338]">
              <thead>
                <tr className="bg-[#f6f7f7] border-b border-[#c3c4c7]">
                  <th className="px-4 py-3 font-semibold text-[#1d2327] w-24">Image</th>
                  <th className="px-4 py-3 font-semibold text-[#1d2327]">Category Name</th>
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-[#1d2327] w-48">Slug</th>
                  <th className="px-4 py-3 font-semibold text-[#1d2327] w-28">Status</th>
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-[#1d2327] w-28">Products</th>
                  <th className="px-4 py-3 font-semibold text-[#1d2327] text-center w-40">Show in Filters</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat) => {
                  const showFilters = cat.showInFilters !== false;
                  const isSaving = savingId === cat._id;
                  
                  return (
                    <tr key={cat._id} className="border-b border-[#f0f0f1] hover:bg-[#f6f7f7]/40 transition-colors">
                      <td className="px-4 py-3.5 align-middle">
                        {cat.image ? (
                          <img
                            src={cat.image}
                            alt=""
                            className="h-10 w-10 object-cover rounded-[3px] border border-[#c3c4c7] bg-[#f0f0f1]"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-[3px] border border-dashed border-[#c3c4c7] bg-[#f6f7f7] flex items-center justify-center text-foreground/30">
                            N/A
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-middle font-bold text-[#1d2327]">
                        {cat.name}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3.5 align-middle text-[#646970] font-mono text-[12px]">
                        {cat.slug}
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[11px] font-medium border ${
                          cat.status === "Published" 
                            ? "bg-[#e5f5fa] border-[#00a0d2] text-[#006787]" 
                            : "bg-[#fcf0f1] border-[#f0c5c5] text-[#d63638]"
                        }`}>
                          {cat.status || "Published"}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3.5 align-middle font-bold text-foreground/75">
                        {cat.productCount || 0}
                      </td>
                      <td className="px-4 py-3.5 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => !isSaving && handleToggleFilter(cat)}
                          disabled={isSaving}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[3px] text-[12px] font-semibold transition-all border outline-none ${
                            isSaving
                              ? "opacity-50 cursor-not-allowed bg-white border-[#c3c4c7]"
                              : showFilters
                              ? "bg-[#e5f5fa] border-[#00a0d2] text-[#006787] hover:bg-[#d6f0fa]"
                              : "bg-[#f6f7f7] border-[#8c8f94] text-[#2c3338] hover:bg-[#edeeee]"
                          }`}
                        >
                          {isSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : showFilters ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                          {showFilters ? "Showing" : "Hidden"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}

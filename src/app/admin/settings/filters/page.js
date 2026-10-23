"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import RequirePermission from "@/components/admin/RequirePermission";
import Link from "next/link";
import { Page, PageHeader } from "@/components/admin/ui";

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
    <RequirePermission permission="products.view">
    <Page>
      <PageHeader title="Category Filters" />
      <p className="wp-desc" style={{ marginTop: 0 }}>Manage which product categories appear in the shop filter tab.</p>

      <div className="wp-toolbar">
        <span className="wp-pages">{filteredCategories.length} item{filteredCategories.length === 1 ? "" : "s"}</span>
        <span className="wp-spacer" />
        <div className="wp-search" role="search">
          <label htmlFor="filters-search" className="sr-only">Search categories</label>
          <input
            id="filters-search"
            type="search"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="wp-input"
          />
        </div>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: 56 }}><span className="sr-only">Image</span></th>
              <th scope="col">Name</th>
              <th scope="col" className="wp-hide-sm">Slug</th>
              <th scope="col" className="wp-hide-sm">Status</th>
              <th scope="col" className="wp-hide-sm wp-num">Products</th>
              <th scope="col" style={{ width: 150 }}>Show in filters</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="wp-muted">Loading categories…</td></tr>
            ) : filteredCategories.length === 0 ? (
              <tr><td colSpan={6} className="wp-muted">No categories found matching your query.</td></tr>
            ) : (
              filteredCategories.map((cat) => {
                const showFilters = cat.showInFilters !== false;
                const isSaving = savingId === cat._id;

                return (
                  <tr key={cat._id}>
                    <td>
                      <div className="wp-thumb">
                        {cat.image ? <img src={cat.image} alt="" /> : <span className="wp-small">N/A</span>}
                      </div>
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <Link href={`/admin/products/categories/${cat._id}`} className="wp-row-title">{cat.name}</Link>
                      <div className="wp-mobile-meta">
                        {cat.slug} · {cat.status || "Published"} · {cat.productCount || 0} product{cat.productCount === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="wp-hide-sm wp-muted" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{cat.slug}</td>
                    <td className="wp-hide-sm">
                      <span className={`wp-pill wp-pill-sm ${cat.status === "Published" ? "wp-st-published" : "wp-st-draft"}`}>
                        {cat.status || "Published"}
                      </span>
                    </td>
                    <td className="wp-hide-sm wp-num">{cat.productCount || 0}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => !isSaving && handleToggleFilter(cat)}
                        disabled={isSaving}
                        aria-pressed={showFilters}
                        aria-label={`${cat.name}: ${showFilters ? "showing in filters, click to hide" : "hidden from filters, click to show"}`}
                        className={`wp-btn ${showFilters ? "wp-btn-primary" : ""}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
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
              })
            )}
          </tbody>
        </table>
      </div>
    </Page>
    </RequirePermission>
  );
}

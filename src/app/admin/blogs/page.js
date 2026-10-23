"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Page, PageHeader } from "@/components/admin/ui";
import { useRouter } from "next/navigation";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

export default function AdminBlogs() {
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All categories");
  const [view, setView] = useState("all"); 
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const [counts, setCounts] = useState({ all: 0, published: 0, trash: 0 });

  const fetchCounts = useCallback(async () => {
    try {
      const [resAll, resTrash] = await Promise.all([
        fetch("/api/admin/blogs"),
        fetch("/api/admin/blogs?isDeleted=true")
      ]);
      if (resAll.ok && resTrash.ok) {
        const allList = await resAll.json();
        const trashList = await resTrash.json();
        setCounts({
          all: allList.length,
          published: allList.filter(b => b.status === "Published").length,
          trash: trashList.length
        });
      }
    } catch (err) {
      console.error("Failed to fetch counts:", err);
    }
  }, []);

  const fetchBlogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/admin/blogs";
      if (view === "trash") url += "?isDeleted=true";
      else if (view === "published") url += "?status=Published";
      
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
         const list = Array.isArray(data) ? data : [];
         setBlogs(list);
      }
      await fetchCounts();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [view, fetchCounts]);

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

  const handleTrash = async (id) => {
    const ok = await showConfirm("Are you sure you want to move this blog to trash?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/blogs?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchBlogs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestoreBlog = async (id) => {
    try {
      const res = await fetch("/api/admin/blogs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDeleted: false })
      });
      if (res.ok) fetchBlogs();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePermanentDeleteBlog = async (id, title) => {
    const ok = await showConfirm(`Are you sure you want to permanently delete "${title}"? This cannot be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/blogs?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchBlogs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async (blog) => {
    try {
      const { _id, createdAt, updatedAt, ...rest } = blog;
      const copy = {
        ...rest,
        title: `${blog.title} (Copy)`,
        slug: `${blog.slug}-copy-${Math.floor(Math.random() * 1000)}`,
        status: "Draft"
      };
      const res = await fetch("/api/admin/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      if (res.ok) fetchBlogs();
    } catch (err) {
      console.error("Duplicate failed:", err);
    }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     const ok = await showConfirm(`Apply "${bulkAction}" to ${selectedIds.length} items?`);
     if (ok) {
        try {
           for (const id of selectedIds) {
              if (bulkAction === "Move to Trash" || bulkAction === "Delete Permanently") {
                 await fetch(`/api/admin/blogs?id=${id}`, { method: "DELETE" });
              } else if (bulkAction === "Duplicate") {
                 const blog = blogs.find(b => b._id === id);
                 if (blog) await handleDuplicate(blog);
              }
           }
           setSelectedIds([]);
           fetchBlogs();
        } catch (err) {
           console.error("Bulk action failed:", err);
        }
     }
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     if (selectedIds.length === filteredBlogs.length) setSelectedIds([]);
     else setSelectedIds(filteredBlogs.map(b => b._id));
  };

  const filteredBlogs = blogs.filter(b => {
     const matchesSearch = b.title?.toLowerCase().includes(searchTerm.toLowerCase());
     const matchesCategory = selectedCategory === "All categories" || b.category === selectedCategory;
     return matchesSearch && matchesCategory;
  });

  const allSelected = selectedIds.length > 0 && selectedIds.length === filteredBlogs.length;

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <label htmlFor="blogs-select-all" className="sr-only">Select all</label>
        <input id="blogs-select-all" type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
      </th>
      <th scope="col">Title</th>
      <th scope="col" className="wp-hide-sm">Author</th>
      <th scope="col" className="wp-hide-sm">Categories</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Date</th>
    </tr>
  );

  const pagination = (
    <div className="wp-pages">
      <span>{filteredBlogs.length} items</span>
      <button type="button" className="wp-pager" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
      <span>1 of 1</span>
      <button type="button" className="wp-pager" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
    </div>
  );

  return (
    <RequirePermission permission="blogs.view">
    <Page>
      <PageHeader
        title="Posts"
        actions={<Link href="/admin/blogs/new" className="wp-btn">Add new post</Link>}
      />

      {/* Status filter links */}
      <div className="wp-subsub" role="tablist" aria-label="Filter posts by status">
        <button type="button" role="tab" aria-selected={view === "all"} className={view === "all" ? "is-current" : undefined} onClick={() => setView("all")}>
          All <span className="wp-count">({counts.all})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "published"} className={view === "published" ? "is-current" : undefined} onClick={() => setView("published")}>
          Published <span className="wp-count">({counts.published})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "trash"} className={view === "trash" ? "is-current" : undefined} onClick={() => setView("trash")}>
          Trash <span className="wp-count">({counts.trash})</span>
        </button>
      </div>

      {/* Bulk actions, filters, search */}
      <div className="wp-toolbar">
        <label htmlFor="blogs-bulk-action" className="sr-only">Select bulk action</label>
        <select id="blogs-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
          <option>Bulk actions</option>
          <option>Duplicate</option>
          <option>Move to Trash</option>
          <option>Delete Permanently</option>
        </select>
        <button type="button" onClick={handleBulkAction} className="wp-btn">Apply</button>

        <label htmlFor="blogs-filter-category" className="sr-only">Filter by category</label>
        <select
          id="blogs-filter-category"
          className="wp-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option>All categories</option>
          {Array.from(new Set(blogs.map(b => b.category).filter(Boolean))).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <span className="wp-spacer" />

        <div className="wp-search" role="search">
          <label htmlFor="blogs-search" className="sr-only">Search posts</label>
          <input
            id="blogs-search"
            type="search"
            placeholder="Search posts"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="wp-input"
          />
          <button type="button" className="wp-btn">Search Posts</button>
        </div>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="wp-muted">Loading posts…</td></tr>
            ) : filteredBlogs.length === 0 ? (
              <tr><td colSpan={6} className="wp-muted">No posts found.</td></tr>
            ) : (
              filteredBlogs.map((b) => (
                <tr key={b._id} className={selectedIds.includes(b._id) ? "is-selected" : undefined}>
                  <td className="wp-check-col">
                    <label htmlFor={`blog-select-${b._id}`} className="sr-only">Select {b.title}</label>
                    <input id={`blog-select-${b._id}`} type="checkbox" checked={selectedIds.includes(b._id)} onChange={() => toggleSelect(b._id)} />
                  </td>
                  <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div className="wp-thumb" style={{ flexShrink: 0 }}>
                        {b.image ? <img src={b.image} alt="" /> : <ImageIcon className="w-5 h-5" aria-hidden="true" style={{ color: "#a7aaad" }} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/admin/blogs/${b._id}`} className="wp-row-title">{b.title}</Link>
                        {b.status === "Draft" && <span className="wp-strong"> — Draft</span>}
                        <div className="wp-mobile-meta">
                          {b.category && b.category !== "Uncategorized" ? b.category : "Uncategorized"} · {new Date(b.createdAt).toLocaleDateString()}
                        </div>
                        <div className="wp-row-actions">
                          {view === "trash" ? (
                            <>
                              <span><button type="button" onClick={() => handleRestoreBlog(b._id)}>Restore</button></span>
                              <span><button type="button" onClick={() => handlePermanentDeleteBlog(b._id, b.title)} className="is-danger">Delete Permanently</button></span>
                            </>
                          ) : (
                            <>
                              <span><Link href={`/admin/blogs/${b._id}`}>Edit</Link></span>
                              <span><button type="button" onClick={() => handleDuplicate(b)}>Duplicate</button></span>
                              <span><button type="button" onClick={() => handleTrash(b._id)} className="is-danger">Trash</button></span>
                              <span><Link href={`/blog/${b.slug}`} target="_blank">View</Link></span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="wp-hide-sm">Admin</td>
                  <td className="wp-hide-sm">{b.category && b.category !== "Uncategorized" ? b.category : "—"}</td>
                  <td>
                    <span className={`wp-pill ${b.status === "Published" || !b.status ? "wp-st-published" : "wp-st-draft"}`}>
                      {b.status || "Published"}
                    </span>
                  </td>
                  <td className="wp-hide-sm">
                    {b.status === "Published" ? "Published" : "Last Modified"}<br />
                    <span className="wp-muted">{new Date(b.createdAt).toLocaleDateString()}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>
    </Page>
    </RequirePermission>
  );
}

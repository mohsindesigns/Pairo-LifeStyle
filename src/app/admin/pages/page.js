"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Page, PageHeader, formatDate } from "@/components/admin/ui";
import { TEMPLATE_REGISTRY } from "@/lib/templates";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { usePopup } from "@/context/PopupContext";
import { useRBAC } from "@/hooks/useRBAC";
import RequirePermission from "@/components/admin/RequirePermission";

export default function PagesManagementPage() {
  const { can } = useRBAC();
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pages", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setPages(data);
      } else {
        setPages([]);
        if (!res.ok) {
          toast.error(data?.error || "Failed to load pages");
        }
      }
    } catch (err) {
      setPages([]);
      toast.error("Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchPages();
    });
  }, [fetchPages]);

  const deletePage = async (id, isSystem) => {
    if (isSystem) return toast.error("System pages cannot be deleted");
    const ok = await showConfirm("Are you sure you want to move this page to trash?");
    if (!ok) return;
    
    try {
      const res = await fetch(`/api/admin/pages/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Page deleted");
        fetchPages();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleDuplicate = async (page) => {
    if (page.isSystem) return toast.error("System pages cannot be duplicated");
    try {
      const { _id, createdAt, updatedAt, ...rest } = page;
      const copy = {
        ...rest,
        title: `${page.title} (Copy)`,
        slug: `${page.slug}-copy-${Math.floor(Math.random() * 1000)}`,
        status: "Draft",
        isSystem: false
      };
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      if (res.ok) {
         toast.success("Page duplicated");
         fetchPages();
      }
    } catch (err) {
      console.error("Duplicate failed:", err);
      toast.error("Failed to duplicate page");
    }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     const ok = await showConfirm(`Apply "${bulkAction}" to ${selectedIds.length} pages?`);
     if (ok) {
        try {
           for (const id of selectedIds) {
              const page = pages.find(p => p._id === id);
              if (page?.isSystem) continue; // Skip system pages for bulk actions
              
              if (bulkAction === "Move to Trash" || bulkAction === "Delete Permanently") {
                  await fetch(`/api/admin/pages/${id}`, { method: "DELETE" });
              } else if (bulkAction === "Duplicate") {
                  await handleDuplicate(page);
              }
           }
           setSelectedIds([]);
           fetchPages();
        } catch (err) {
           console.error("Bulk action failed:", err);
        }
     }
  };

  const toggleSelect = (id, isSystem) => {
     if (isSystem) return; // Prevent selecting system pages for bulk deletion
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     const selectable = filteredPages.filter(p => !p.isSystem);
     if (selectedIds.length === selectable.length) setSelectedIds([]);
     else setSelectedIds(selectable.map(p => p._id));
  };

  const filteredPages = (Array.isArray(pages) ? pages : []).filter(p => 
    (p.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.slug || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectableCount = filteredPages.filter(p => !p.isSystem).length;
  const allSelected = selectedIds.length > 0 && selectedIds.length === selectableCount;
  const publishedCount = (Array.isArray(pages) ? pages : []).filter(p => p.status === 'Published').length;

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input type="checkbox" aria-label="Select all pages" checked={allSelected} onChange={toggleSelectAll} />
      </th>
      <th scope="col">Title</th>
      <th scope="col" className="wp-hide-sm">Template</th>
      <th scope="col" className="wp-hide-sm">Author</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Date</th>
    </tr>
  );

  return (
    <RequirePermission permission="pages.view">
    <Page>
      <PageHeader
        title="Pages"
        actions={<Link href="/admin/pages/new" className="wp-btn">Add New Page</Link>}
      />

      {/* Status filter links */}
      <div className="wp-subsub" aria-label="Page counts by status">
        <span className="is-current">
          All <span className="wp-count">({Array.isArray(pages) ? pages.length : 0})</span>
        </span>
        <span className="wp-sep" aria-hidden="true">|</span>
        <span>
          Published <span className="wp-count">({publishedCount})</span>
        </span>
      </div>

      {/* Toolbar */}
      <div className="wp-toolbar">
        <label htmlFor="pages-bulk-action" className="sr-only">Select bulk action</label>
        <select id="pages-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
          <option>Bulk actions</option>
          <option>Duplicate</option>
          <option>Move to Trash</option>
          <option>Delete Permanently</option>
        </select>
        <button type="button" onClick={handleBulkAction} className="wp-btn">Apply</button>

        <span className="wp-spacer" />

        <div className="wp-search" role="search">
          <label htmlFor="pages-search" className="sr-only">Search pages</label>
          <input
            id="pages-search"
            type="search"
            placeholder="Search pages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="wp-input"
          />
          <button type="button" className="wp-btn">Search Pages</button>
        </div>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <div className="wp-pages"><span>{filteredPages.length} items</span></div>
      </div>

      {/* Data Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="wp-muted">Loading pages…</td></tr>
            ) : filteredPages.length === 0 ? (
              <tr><td colSpan={6} className="wp-muted">No pages found.</td></tr>
            ) : (
              filteredPages.map((p) => {
                const dateValue = p.updatedAt || p.createdAt;
                const templateName = TEMPLATE_REGISTRY[p.template || "default"]?.name || p.template || "Default";
                return (
                  <tr key={p._id} className={selectedIds.includes(p._id) ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input
                        type="checkbox"
                        aria-label={p.isSystem ? `${p.title} is a system page and cannot be selected` : `Select ${p.title}`}
                        checked={selectedIds.includes(p._id)}
                        onChange={() => toggleSelect(p._id, p.isSystem)}
                        disabled={p.isSystem}
                      />
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <Link href={`/admin/pages/${p._id}`} className="wp-row-title">{p.title}</Link>
                      {p.status === 'Draft' && <span className="wp-strong"> — Draft</span>}
                      {p.isSystem && <span className="wp-muted"> — System page</span>}
                      <div className="wp-mobile-meta">
                        {templateName}
                        {dateValue ? ` · ${formatDate(dateValue)}` : ""}
                      </div>
                      <div className="wp-row-actions">
                        <span><Link href={`/admin/pages/${p._id}`}>Edit</Link></span>
                        {!p.isSystem && (
                          <>
                            <span><button type="button" onClick={() => handleDuplicate(p)}>Duplicate</button></span>
                            <span><button type="button" onClick={() => deletePage(p._id, p.isSystem)} className="is-danger">Trash</button></span>
                          </>
                        )}
                        <span><Link href={p.slug === 'home' ? '/' : `/${p.slug}`} target="_blank">View</Link></span>
                      </div>
                    </td>
                    <td className="wp-hide-sm">{templateName}</td>
                    <td className="wp-hide-sm"><span className="wp-link">Admin</span></td>
                    <td>
                      <span className={`wp-pill ${p.status === 'Published' ? 'wp-st-published' : 'wp-st-draft'}`}>{p.status}</span>
                    </td>
                    <td className="wp-hide-sm wp-muted">
                      {p.status === 'Published' ? 'Published' : 'Last Modified'}<br />
                      {dateValue ? formatDate(dateValue) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>
    </Page>
    </RequirePermission>
  );
}

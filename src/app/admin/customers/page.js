"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Page, PageHeader, formatMoney, formatDate } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

export default function AdminCustomers() {
  const { showConfirm } = usePopup();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/admin/customers");
      const data = await res.json();
      if (res.ok) setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCustomers();
    });
  }, []);

  const handleDelete = async (id) => {
    const ok = await showConfirm("Are you sure you want to move this customer to trash?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/customers?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchCustomers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async (customer) => {
    try {
      const { _id, createdAt, updatedAt, ...rest } = customer;
      const copy = {
        ...rest,
        email: `copy-${Math.floor(Math.random() * 1000)}@${customer.email.split('@')[1]}`,
        name: `${customer.name || 'Guest'} (Copy)`
      };
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      if (res.ok) fetchCustomers();
    } catch (err) {
      console.error("Duplicate failed:", err);
    }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     const ok = await showConfirm(`Apply "${bulkAction}" to ${selectedIds.length} customers?`);
     if (ok) {
        try {
           for (const id of selectedIds) {
              if (bulkAction === "Move to Trash" || bulkAction === "Delete Permanently") {
                  await fetch(`/api/admin/customers?id=${id}`, { method: "DELETE" });
              } else if (bulkAction === "Duplicate") {
                  const customer = customers.find(c => c._id === id);
                  if (customer) await handleDuplicate(customer);
              }
           }
           setSelectedIds([]);
           fetchCustomers();
        } catch (err) {
           console.error("Bulk action failed:", err);
        }
     }
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     if (selectedIds.length === filteredCustomers.length) setSelectedIds([]);
     else setSelectedIds(filteredCustomers.map(c => c._id));
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allSelected = selectedIds.length > 0 && selectedIds.length === filteredCustomers.length;
  const itemsLabel = `${filteredCustomers.length} item${filteredCustomers.length === 1 ? "" : "s"}`;
  const initialsOf = (c) => {
    const source = (c.name || c.email || "?").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  };
  const locationOf = (c) => {
    const addr = (c.addresses || []).find((a) => a?.isDefault) || (c.addresses || [])[0];
    if (!addr) return "";
    return [addr.city, addr.state, addr.country].filter(Boolean).join(", ");
  };

  const columns = (
    <tr>
      <th className="wp-check-col">
        <input type="checkbox" aria-label="Select all customers" checked={allSelected} onChange={toggleSelectAll} />
      </th>
      <th>Customer</th>
      <th className="wp-hide-sm">Location</th>
      <th className="wp-num">Orders</th>
      <th className="wp-num wp-hide-sm">Total spent</th>
      <th className="wp-hide-sm">Last order</th>
      <th className="wp-hide-sm">Registered</th>
    </tr>
  );

  return (
    <RequirePermission permission="customers.view">
    <Page>
      <PageHeader
        title="Customers"
        actions={<Link href="/admin/customers/new" className="wp-btn">Add New</Link>}
        aside={
          <div className="wp-search" role="search">
            <label htmlFor="customer-search" className="sr-only">Search customers</label>
            <input
              id="customer-search"
              type="search"
              className="wp-input"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="wp-btn">Search Customers</button>
          </div>
        }
      />

      {/* Filter Links */}
      <div className="wp-subsub">
        <span className="is-current">All <span className="wp-count">({customers.length})</span></span>
        <span className="wp-sep">|</span>
        <button type="button">Active Customers</button>
      </div>

      {/* Action Bar */}
      <div className="wp-toolbar">
        <label htmlFor="customer-bulk-action" className="sr-only">Select bulk action</label>
        <select id="customer-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
          <option>Bulk actions</option>
          <option>Duplicate</option>
          <option>Move to Trash</option>
          <option>Delete Permanently</option>
        </select>
        <button onClick={handleBulkAction} className="wp-btn">Apply</button>
        <span className="wp-spacer" />
        <span className="wp-pages">{itemsLabel}</span>
      </div>

      {/* Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{columns}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>Loading customers...</td></tr>
            ) : filteredCustomers.length === 0 ? (
              <tr><td colSpan={7} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>No customers found.</td></tr>
            ) : (
              filteredCustomers.map((c) => {
                const location = locationOf(c);
                return (
                  <tr key={c._id} className={selectedIds.includes(c._id) ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input type="checkbox" aria-label={`Select ${c.name || c.email}`} checked={selectedIds.includes(c._id)} onChange={() => toggleSelect(c._id)} />
                    </td>
                    <td style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
                        <div className="wp-avatar" aria-hidden="true">{initialsOf(c)}</div>
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/admin/customers/${c._id}`} className="wp-row-title" style={{ overflowWrap: "anywhere" }}>
                            {c.name || c.email?.split('@')[0]}
                          </Link>
                          <div className="wp-muted" style={{ overflowWrap: "anywhere" }}>
                            <Link href={`/admin/customers/${c._id}`} className="wp-link">{c.email}</Link>
                          </div>
                          <div className="wp-mobile-meta">
                            {formatMoney(c.totalSpent)} spent
                            {c.lastOrderDate ? ` · Last order ${formatDate(c.lastOrderDate)}` : ""}
                            {location ? ` · ${location}` : ""}
                          </div>
                          <div className="wp-row-actions">
                            <Link href={`/admin/customers/${c._id}`}>Edit</Link>
                            <button type="button" onClick={() => handleDuplicate(c)}>Duplicate</button>
                            <button type="button" className="is-danger" onClick={() => handleDelete(c._id)}>Trash</button>
                            <Link href={`/admin/customers/${c._id}`}>View</Link>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="wp-hide-sm">{location || <span className="wp-muted">—</span>}</td>
                    <td className="wp-num wp-strong">{c.orderCount || 0}</td>
                    <td className="wp-num wp-hide-sm">{formatMoney(c.totalSpent)}</td>
                    <td className="wp-hide-sm">{c.lastOrderDate ? formatDate(c.lastOrderDate) : <span className="wp-muted">—</span>}</td>
                    <td className="wp-hide-sm">{c.createdAt ? formatDate(c.createdAt) : <span className="wp-muted">—</span>}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>{columns}</tfoot>
        </table>
      </div>

      {/* Pagination */}
      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <span className="wp-pages">
          {itemsLabel}
          <button type="button" className="wp-pager" aria-label="Previous page"><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
          <span>1 of 1</span>
          <button type="button" className="wp-pager" aria-label="Next page"><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
        </span>
      </div>
    </Page>
    </RequirePermission>
  );
}

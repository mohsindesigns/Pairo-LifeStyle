"use client";

// Shared list-screen pieces for the customer-submitted "inbox" modules:
// Contact submissions, Custom jacket inquiries, Corporate gifting inquiries, Size confirmations.
// Follows the Products/Orders list pattern (wp-* classes from admin-ui.css).

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { Skeleton } from "@/components/admin/ui";

export async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Server-paginated list state: view (status tab), search (debounced live + immediate submit),
 * page, items, counts, selection.
 * `endpoint` returns { items|confirmations, pagination, counts }.
 */
export function useInboxList(endpoint, { itemsKey = "items", limit = 20, initialView = "all" } = {}) {
  const [view, setViewState] = useState(initialView);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(null);
  const [meta, setMeta] = useState({});
  const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1, limit });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const debounce = useRef(null);
  const requestSeq = useRef(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    const seq = ++requestSeq.current;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), status: view });
      if (query) params.set("search", query);
      const res = await fetch(`${endpoint}?${params}`);
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(await readError(res, "Could not load the list."));
        return;
      }
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      const rows = data[itemsKey] || [];
      const pg = data.pagination || { total: rows.length, pages: 1, page: 1, limit };
      // The last row of the last page was removed: step back a page.
      if (rows.length === 0 && page > 1 && pg.pages < page) {
        setPage(Math.max(1, pg.pages));
        return;
      }
      setItems(rows);
      setPagination(pg);
      setCounts(data.counts || null);
      setMeta(data);
      setError("");
      setSelectedIds((prev) => prev.filter((id) => rows.some((r) => r._id === id)));
    } catch {
      if (seq === requestSeq.current) setError("Could not load the list. Check your connection and try again.");
    } finally {
      if (seq === requestSeq.current && !silent) setLoading(false);
    }
  }, [endpoint, itemsKey, limit, page, query, view]);

  useEffect(() => {
    // Deferred so the effect doesn't set state synchronously.
    Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => () => clearTimeout(debounce.current), []);

  const onSearchChange = (value) => {
    setSearchInput(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setQuery(value.trim());
      setPage(1);
      setSelectedIds([]);
    }, 400);
  };

  const submitSearch = (e) => {
    e?.preventDefault();
    clearTimeout(debounce.current);
    const next = searchInput.trim();
    setPage(1);
    setSelectedIds([]);
    if (next === query) load();
    else setQuery(next);
  };

  const setView = (v) => {
    setViewState(v);
    setPage(1);
    setSelectedIds([]);
  };

  const goToPage = (n) => {
    setPage(Math.min(Math.max(1, n), pagination.pages || 1));
    setSelectedIds([]);
  };

  const toggleSelect = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const allSelected = items.length > 0 && items.every((i) => selectedIds.includes(i._id));
  const someSelected = items.some((i) => selectedIds.includes(i._id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : items.map((i) => i._id));

  return {
    view, setView, searchInput, onSearchChange, submitSearch, query,
    page, goToPage, items, setItems, counts, meta, pagination, loading, error, reload: load,
    selectedIds, setSelectedIds, toggleSelect, toggleSelectAll, allSelected, someSelected,
  };
}

/**
 * POST { action, ids, ...extra } to a bulk endpoint and toast "N done, M failed".
 * Returns true when at least one item was processed.
 */
export async function runBulk(endpoint, action, ids, { extra = {}, verb = "done", noun = "item" } = {}) {
  const n = ids.length;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids, ...extra }),
    });
    if (!res.ok) {
      toast.error(await readError(res, "Action failed"));
      return false;
    }
    const data = await res.json().catch(() => ({}));
    const done = typeof data.processed === "number" ? data.processed : n;
    const failed = typeof data.failed === "number" ? data.failed : n - done;
    const label = (k) => `${k} ${noun}${k === 1 ? "" : "s"}`;
    if (failed === 0) toast.success(`${label(done)} ${verb}`);
    else if (done === 0) toast.error(`Nothing changed: ${label(failed)} could not be ${verb}`);
    else toast.error(`${label(done)} ${verb}, ${failed} failed`);
    return done > 0;
  } catch {
    toast.error("Action failed. Check your connection and try again.");
    return false;
  }
}

/** All (3) | New (1) | ... | Trash (2) */
export function StatusViews({ label, views, current, counts, onChange }) {
  return (
    <nav className="wp-subsub" aria-label={label}>
      {views.map(([value, text], i) => (
        <Fragment key={value}>
          {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
          <button
            type="button"
            className={current === value ? "is-current" : undefined}
            aria-current={current === value ? "page" : undefined}
            onClick={() => onChange(value)}
          >
            {text} <span className="wp-count">({counts ? (counts[value] ?? 0) : "–"})</span>
          </button>
        </Fragment>
      ))}
    </nav>
  );
}

export function Pager({ pagination, onPage }) {
  const { total = 0, page = 1, pages = 1 } = pagination || {};
  return (
    <div className="wp-pages">
      <span>{total} {total === 1 ? "item" : "items"}</span>
      {pages > 1 && (
        <>
          <button type="button" className="wp-pager" aria-label="First page" disabled={page <= 1} onClick={() => onPage(1)}>
            <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button type="button" className="wp-pager" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <span>{page} of {pages}</span>
          <button type="button" className="wp-pager" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button type="button" className="wp-pager" aria-label="Last page" disabled={page >= pages} onClick={() => onPage(pages)}>
            <ChevronsRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

/** Bulk action select + Apply. `options` = [value, label] pairs. */
export function BulkActions({ id, options, value, onChange, onApply, disabled }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">Select bulk action</label>
      <select id={id} className="wp-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Bulk actions</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <button type="button" className="wp-btn" onClick={onApply} disabled={disabled}>Apply</button>
    </>
  );
}

export function SearchForm({ id, label, placeholder, value, onChange, onSubmit }) {
  return (
    <form className="wp-search" role="search" onSubmit={onSubmit}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        type="search"
        className="wp-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="submit" className="wp-btn">{label}</button>
    </form>
  );
}

/** Loading placeholder rows for a list table. */
export function SkeletonRows({ cols, rows = 5, check = true }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} aria-hidden="true">
      {check && <td className="wp-check-col" />}
      {Array.from({ length: cols }, (_, c) => (
        <td key={c} className={c > 0 ? "wp-hide-sm" : undefined}>
          <Skeleton height={14} width={c === 0 ? "70%" : "60%"} />
          {c === 0 && <Skeleton height={10} width="40%" style={{ marginTop: 6 }} />}
        </td>
      ))}
    </tr>
  ));
}

/** Header checkbox that shows the indeterminate state. */
export function SelectAllBox({ label, list }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={list.allSelected}
      ref={(el) => { if (el) el.indeterminate = list.someSelected && !list.allSelected; }}
      onChange={list.toggleSelectAll}
    />
  );
}

/**
 * Detail panel that slides in from the right on desktop and fills the screen on phones.
 * Escape and the backdrop close it; the body scrolls, head and footer stay put.
 */
export function Drawer({ titleId, title, subtitle, onClose, footer, children, width = 680 }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCloseRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div
      className="wp-modal-backdrop"
      style={{ justifyContent: "flex-end", alignItems: "stretch", padding: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="wp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: width, height: "100dvh", maxHeight: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div className="wp-modal-head" style={{ gap: 10, flex: "none", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} style={{ wordBreak: "break-word" }}>{title}</h2>
            {subtitle && <div className="wp-muted" style={{ marginTop: 2, wordBreak: "break-word" }}>{subtitle}</div>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="wp-btn"
            aria-label="Close"
            style={{ minWidth: 40, minHeight: 40, padding: 0, justifyContent: "center", flex: "none" }}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="wp-modal-body" style={{ flex: 1, overflowY: "auto", background: "#f0f0f1" }}>
          {children}
        </div>
        {footer && (
          <div className="wp-modal-foot" style={{ flex: "none", flexWrap: "wrap" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** WordPress-style red "Move to Trash" / "Delete permanently" link button for panel footers. */
export function DangerLink({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        marginRight: "auto", background: "none", border: 0, padding: "0 2px", minHeight: 40,
        color: "#b32d2e", textDecoration: "underline", cursor: disabled ? "default" : "pointer", fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

/** Label / value row used inside detail panels. */
export function KV({ label, value, mono = false }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="wp-kv" style={{ alignItems: "flex-start" }}>
      <span className="wp-kv-k wp-muted">{label}</span>
      <span
        className={`wp-kv-v${mono ? " font-mono" : ""}`}
        style={{ textAlign: "right", wordBreak: "break-word", minWidth: 0, maxWidth: "65%", fontWeight: mono ? 400 : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Notice, Skeleton, formatDate } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import { useRBAC } from "@/hooks/useRBAC";
import { allowed, visibleModules, groupModules, filterItems, paginate, summarize, responseResult } from "./trashModules";

const PER_PAGE = 20;

const countLabel = (e) => (!e || e.status === "loading" ? "…" : e.status === "error" ? "!" : e.docs.length);

// Page-local layout for the grouped section tabs (admin-ui.css has no show-on-phone helper).
const TAB_CSS = `
.trash-tabs-sm { display: none; }
.trash-tabs-lg { margin: 4px 0 8px; }
@media (max-width: 782px) {
  .trash-tabs-lg { display: none; }
  .trash-tabs-sm { display: flex; flex-direction: column; gap: 4px; margin: 8px 0 10px; }
  .trash-tabs-sm .wp-select { width: 100%; }
}
`;
const BULK_CONCURRENCY = 4;

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function send({ url, method, body }) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return responseResult(res.ok, res.status, data);
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// Runs `task` over `list` with a small concurrency limit; resolves to [{ok, error}] in order.
async function runAll(list, task) {
  const results = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      results[i] = await task(list[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(BULK_CONCURRENCY, list.length) }, worker));
  return results;
}

export default function AdminTrash() {
  const { can, session } = useRBAC();
  const { showConfirm } = usePopup();

  // Re-evaluated only when the signed-in role changes.
  const roleKey = JSON.stringify(session?.user?.role || null);
  const modules = useMemo(() => visibleModules(can), [roleKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => groupModules(modules), [modules]);
  const actor = useMemo(
    () => ({ userId: session?.user?.id || null, roleSlug: session?.user?.role?.slug || null }),
    [session?.user?.id, session?.user?.role?.slug],
  );

  const [active, setActive] = useState("");
  const [data, setData] = useState({}); // key -> { status: "loading"|"ok"|"error", docs, error }
  const [selected, setSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const loadSeq = useRef({});

  const stillLoading = modules.some((m) => !data[m.key] || data[m.key].status === "loading");
  // Sections with trashed items (or a load error), plus the one being viewed
  const nonEmpty = modules.filter((m) => {
    const e = data[m.key];
    return m.key === active || (e && (e.status === "error" || (e.status === "ok" && e.docs.length > 0)));
  });
  // Until a section is picked, show the first one that has something in it
  const current = modules.find((m) => m.key === active) || nonEmpty[0] || modules[0] || null;

  const loadModule = useCallback(async (mod) => {
    const seq = (loadSeq.current[mod.key] || 0) + 1;
    loadSeq.current[mod.key] = seq;
    setData((prev) => ({ ...prev, [mod.key]: { ...(prev[mod.key] || { docs: [] }), status: "loading" } }));
    try {
      const docs = await mod.load(getJson);
      if (loadSeq.current[mod.key] !== seq) return;
      setData((prev) => ({ ...prev, [mod.key]: { status: "ok", docs, error: null } }));
    } catch (e) {
      if (loadSeq.current[mod.key] !== seq) return;
      setData((prev) => ({ ...prev, [mod.key]: { status: "error", docs: [], error: e.message } }));
    }
  }, []);

  const loadAll = useCallback(() => {
    modules.forEach((m) => loadModule(m));
  }, [modules, loadModule]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ?tab= deep link (read after mount so server and client render the same first frame).
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab) setActive(tab);
  }, []);

  // Live search (debounced); submitting the form applies immediately.
  useEffect(() => {
    const t = setTimeout(() => setTerm(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); setSelected([]); }, [term, current?.key]);

  const selectTab = (key) => {
    setActive(key);
    setSearchInput("");
    setTerm("");
    setBulkAction("");
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", key);
      window.history.replaceState(null, "", url.toString());
    } catch { /* ignore */ }
  };

  const entry = current ? data[current.key] : null;
  const docs = entry?.docs;
  const items = useMemo(() => (current && docs ? docs.map((d) => ({ ...current.item(d), doc: d })) : []), [current, docs]);
  const filtered = useMemo(() => filterItems(items, term), [items, term]);
  const { pages, page: curPage, slice } = paginate(filtered, page, PER_PAGE);
  const hasThumbs = items.some((it) => "thumb" in it);
  const hasDates = items.some((it) => it.trashedAt);

  const mayRestore = current ? allowed(can, current.permissions.restore) : false;
  const mayDelete = current ? allowed(can, current.permissions.delete) : false;
  const blockReason = (it) => (current?.canDestroy ? current.canDestroy(it.doc, actor) || null : null);

  const sliceIds = slice.map((it) => it.id);
  const allOnPage = sliceIds.length > 0 && sliceIds.every((id) => selected.includes(id));
  const toggleAll = () => setSelected(allOnPage ? selected.filter((id) => !sliceIds.includes(id)) : [...new Set([...selected, ...sliceIds])]);
  const toggleOne = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const restoreOne = async (it) => {
    setRowBusy(it.id);
    const r = await send(current.restore(it.doc));
    setRowBusy(null);
    if (r.ok) {
      toast.success(`"${it.title}" restored`);
      loadModule(current);
    } else toast.error(r.error || "Failed to restore");
  };

  const deleteOne = async (it) => {
    const reason = blockReason(it);
    if (reason) return toast.error(reason);
    const ok = await showConfirm(
      `Permanently delete "${it.title}"? This cannot be undone.`,
      "Delete permanently",
      { confirmText: "Delete permanently", danger: true },
    );
    if (!ok) return;
    setRowBusy(it.id);
    const r = await send(current.destroy(it.doc));
    setRowBusy(null);
    if (r.ok) {
      toast.success(`"${it.title}" permanently deleted`);
      setSelected((prev) => prev.filter((id) => id !== it.id));
      loadModule(current);
    } else toast.error(r.error || "Failed to delete permanently");
  };

  const runBulk = async (targets, kind) => {
    const mod = current;
    const runnable = kind === "delete" ? targets.filter((it) => !blockReason(it)) : targets;
    const skipped = targets.length - runnable.length;
    setBusy(true);
    const results = await runAll(runnable, (it) => send(kind === "delete" ? mod.destroy(it.doc) : mod.restore(it.doc)));
    setBusy(false);
    const ok = results.filter((r) => r.ok).length;
    // Items the server refuses (or that are blocked up front) are skipped, never fatal:
    // the rest of the run carries on and the toast reports both numbers.
    const failed = results.length - ok + skipped;
    const firstError = results.find((r) => !r.ok)?.error || (skipped ? blockReason(targets.find((it) => blockReason(it))) : "");
    const msg = kind === "delete" ? summarize("deleted", ok, failed, "skipped") : summarize("restored", ok, failed);
    if (failed) toast.error(`${msg}${firstError ? ` — ${firstError}` : ""}`);
    else toast.success(msg);
    setSelected([]);
    setBulkAction("");
    loadModule(mod);
  };

  const applyBulk = async () => {
    if (!bulkAction) return toast.error("Choose a bulk action first.");
    const targets = items.filter((it) => selected.includes(it.id));
    if (targets.length === 0) return toast.error(`Select at least one ${current.noun}.`);
    if (bulkAction === "delete") {
      const ok = await showConfirm(
        `Permanently delete ${targets.length} ${current.noun}${targets.length === 1 ? "" : "s"}? This cannot be undone.`,
        "Delete permanently",
        { confirmText: "Delete permanently", danger: true },
      );
      if (!ok) return;
    }
    runBulk(targets, bulkAction);
  };

  const emptyTrash = async () => {
    if (items.length === 0) return;
    const blocked = items.filter((it) => blockReason(it)).length;
    const ok = await showConfirm(
      `Permanently delete all ${items.length} ${current.noun}${items.length === 1 ? "" : "s"} in the Trash? This cannot be undone.`
        + `${blocked ? ` ${blocked} that can't be deleted will be skipped and stay in the Trash.` : " Any the server refuses are skipped and stay in the Trash."}`,
      `Empty ${current.label} trash`,
      { confirmText: "Empty trash", danger: true },
    );
    if (!ok) return;
    runBulk(items, "delete");
  };

  const bulkOptions = [mayRestore && ["restore", "Restore"], mayDelete && ["delete", "Delete permanently"]].filter(Boolean);
  const loading = !entry || entry.status === "loading";
  const showChecks = bulkOptions.length > 0;
  const colCount = (showChecks ? 1 : 0) + (hasDates ? 3 : 2);

  if (modules.length === 0) {
    return (
      <Page>
        <PageHeader title="Trash" />
        <Notice type="info">There is nothing here you have permission to manage.</Notice>
      </Page>
    );
  }

  const pager = pages > 1 && (
    <span className="wp-pages">
      <button type="button" className="wp-pager" onClick={() => setPage(1)} disabled={curPage <= 1} aria-label="First page">«</button>
      <button type="button" className="wp-pager" onClick={() => setPage(curPage - 1)} disabled={curPage <= 1} aria-label="Previous page">‹</button>
      <span>{curPage} of {pages}</span>
      <button type="button" className="wp-pager" onClick={() => setPage(curPage + 1)} disabled={curPage >= pages} aria-label="Next page">›</button>
      <button type="button" className="wp-pager" onClick={() => setPage(pages)} disabled={curPage >= pages} aria-label="Last page">»</button>
    </span>
  );

  const header = (
    <tr>
      {showChecks && (
        <td className="wp-check-col">
          <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={toggleAll} disabled={sliceIds.length === 0 || busy} />
        </td>
      )}
      <th scope="col">{current.key === "orders" ? "Order" : "Title"}</th>
      <th scope="col" className="wp-hide-sm" style={{ width: "22%" }}>Details</th>
      {hasDates && <th scope="col" className="wp-hide-sm" style={{ width: 140 }}>Trashed</th>}
    </tr>
  );

  return (
    <Page>
      <PageHeader
        title="Trash"
        actions={<button type="button" onClick={loadAll} className="wp-btn" disabled={busy}>Refresh</button>}
      />
      <p className="wp-desc" style={{ marginTop: 0 }}>
        Items moved to the Trash from every section, in one place. Restore them, or delete them permanently.
      </p>

      <style>{TAB_CSS}</style>

      {/* Phones: one select, grouped. */}
      <div className="trash-tabs-sm">
        <label htmlFor="trash-section" className="wp-muted wp-small">Section</label>
        <select id="trash-section" className="wp-select" value={current.key} onChange={(e) => selectTab(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g.key} label={g.label}>
              {g.modules.map((m) => (
                <option key={m.key} value={m.key}>{m.label} ({countLabel(data[m.key])})</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Desktop: one row of WP status links, only for sections that have something in the Trash. */}
      <div className="trash-tabs-lg" role="tablist" aria-label="Trash by section">
        {nonEmpty.length === 0 ? (
          <p className="wp-muted" style={{ margin: "4px 0" }}>{stillLoading ? "Loading…" : "The Trash is empty."}</p>
        ) : (
          <div className="wp-subsub">
            {nonEmpty.map((m, i) => {
              const isCur = m.key === current.key;
              return (
                <span key={m.key} style={{ display: "inline-flex", alignItems: "center" }}>
                  {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
                  <button type="button" role="tab" aria-selected={isCur} className={isCur ? "is-current" : undefined} onClick={() => selectTab(m.key)}>
                    {m.label} <span className="wp-count">({countLabel(data[m.key])})</span>
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {entry?.status === "error" && (
        <Notice type="error">Couldn&apos;t load trashed {current.label.toLowerCase()}: {entry.error}</Notice>
      )}

      <div className="wp-toolbar">
        {showChecks && (
          <>
            <label htmlFor="trash-bulk" className="sr-only">Select bulk action</label>
            <select id="trash-bulk" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} disabled={busy}>
              <option value="">Bulk actions</option>
              {bulkOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button type="button" className="wp-btn" onClick={applyBulk} disabled={busy}>{busy ? "Working…" : "Apply"}</button>
          </>
        )}
        {mayDelete && (
          <button
            type="button"
            className="wp-btn"
            onClick={emptyTrash}
            disabled={busy || loading || items.length === 0}
            style={items.length && !busy ? { borderColor: "#b32d2e", color: "#b32d2e" } : undefined}
          >
            Empty trash
          </button>
        )}
        <span className="wp-spacer" />
        <form className="wp-search" role="search" onSubmit={(e) => { e.preventDefault(); setTerm(searchInput.trim()); }}>
          <label htmlFor="trash-search" className="sr-only">Search {current.label}</label>
          <input id="trash-search" type="search" className="wp-input" placeholder={`Search trashed ${current.label.toLowerCase()}`} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button type="submit" className="wp-btn">Search</button>
        </form>
      </div>

      <div className="wp-toolbar">
        <span className="wp-muted">{filtered.length} item{filtered.length === 1 ? "" : "s"}{selected.length ? ` · ${selected.length} selected` : ""}</span>
        <span className="wp-spacer" />
        {pager}
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{header}</thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i}><td colSpan={colCount}><Skeleton height={18} width={i === 1 ? "60%" : "80%"} /></td></tr>
              ))
            ) : slice.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="wp-muted">
                  {term ? `No trashed ${current.label.toLowerCase()} match “${term}”.` : `No ${current.label.toLowerCase()} in the Trash.`}
                </td>
              </tr>
            ) : (
              slice.map((it) => {
                const reason = blockReason(it);
                const rowDisabled = busy || rowBusy === it.id;
                return (
                  <tr key={it.id} className={selected.includes(it.id) ? "is-selected" : undefined}>
                    {showChecks && (
                      <td className="wp-check-col">
                        <input type="checkbox" aria-label={`Select ${it.title}`} checked={selected.includes(it.id)} onChange={() => toggleOne(it.id)} disabled={busy} />
                      </td>
                    )}
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        {hasThumbs && (
                          <div className="wp-thumb" aria-hidden="true">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {it.thumb ? <img src={it.thumb} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : (it.title || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <span className="wp-row-title">{it.title}</span>
                          {it.subtitle && <div className="wp-muted wp-small">{it.subtitle}</div>}
                          <div className="wp-mobile-meta">
                            {[it.details, it.trashedAt && `Trashed ${formatDate(it.trashedAt)}`].filter(Boolean).join(" · ")}
                          </div>
                          {(mayRestore || mayDelete) && (
                            <div className="wp-row-actions">
                              {mayRestore && (
                                <span><button type="button" onClick={() => restoreOne(it)} disabled={rowDisabled}>Restore</button></span>
                              )}
                              {mayDelete && (
                                reason ? (
                                  <span className="is-muted" title={reason}>Delete permanently</span>
                                ) : (
                                  <span><button type="button" className="is-danger" onClick={() => deleteOne(it)} disabled={rowDisabled}>Delete permanently</button></span>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="wp-hide-sm">{it.details || <span className="wp-muted">—</span>}</td>
                    {hasDates && <td className="wp-hide-sm wp-muted">{it.trashedAt ? formatDate(it.trashedAt) : "—"}</td>}
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>{header}</tfoot>
        </table>
      </div>

      {pages > 1 && (
        <div className="wp-toolbar">
          <span className="wp-spacer" />
          {pager}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Notice type="warning">
          <strong>Deleting permanently</strong> removes the item and cleans up its references. This cannot be undone.
          {" "}{current.label} in the Trash are also listed in the Trash view of{" "}
          <Link href={current.href || "/admin/products"} className="wp-link">{current.href ? `the ${current.label} screen` : "their own screen"}</Link>.
        </Notice>
      </div>
    </Page>
  );
}

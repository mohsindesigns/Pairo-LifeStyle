// Shared, DB-free helpers for the admin "inbox" style lists: contact submissions,
// custom jacket inquiries, corporate gifting inquiries and size confirmations.
// Kept pure so they can be unit tested without MongoDB.

import mongoose from "mongoose";

export const NOT_TRASHED = { isDeleted: { $ne: true } };
export const TRASHED = { isDeleted: true };

export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive "contains" search over several fields, or null for an empty term. */
export function buildSearchOr(search, fields) {
  const term = String(search || "").trim().slice(0, 200);
  if (!term) return null;
  const rx = { $regex: escapeRegex(term), $options: "i" };
  return fields.map((f) => ({ [f]: rx }));
}

/** page/limit from the query string, clamped to sane bounds. */
export function parsePaging(searchParams, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const rawLimit = parseInt(searchParams.get("limit") || String(defaultLimit), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * The Mongo filter for one list view.
 * view: "all" | "trash" | one of `statuses`. Anything else falls back to "all".
 */
export function buildListQuery({ view = "all", statuses = [], search = "", searchFields = [] } = {}) {
  const query = view === "trash" ? { ...TRASHED } : { ...NOT_TRASHED };
  if (view !== "all" && view !== "trash" && statuses.includes(view)) query.status = view;
  const or = buildSearchOr(search, searchFields);
  if (or) query.$or = or;
  return query;
}

/**
 * Turns a `$group by status` aggregate over non-trashed docs into
 * { all, <status>: n, ..., trash }.
 */
export function buildStatusCounts(rows, statuses, trashCount = 0) {
  const counts = { all: 0 };
  for (const s of statuses) counts[s] = 0;
  for (const r of rows || []) {
    counts.all += r.count;
    if (r._id in counts && r._id !== "all") counts[r._id] = r.count;
  }
  counts.trash = trashCount;
  return counts;
}

export function pageInfo(total, page, limit) {
  return { total, pages: Math.max(1, Math.ceil(total / limit)), page, limit };
}

/** Keeps only valid, de-duplicated ObjectId strings (max 500 per request). */
export function validIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(String))].filter((id) => mongoose.isValidObjectId(id)).slice(0, 500);
}

/** $set for moving to trash / restoring. */
export function trashUpdate(now = new Date()) {
  return { isDeleted: true, deletedAt: now };
}
export function restoreUpdate() {
  return { isDeleted: false, deletedAt: null };
}

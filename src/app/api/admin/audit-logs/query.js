// Pure helpers for the audit log list (no DB / Next imports, unit-tested in
// src/__tests__/admin-settings-audit-logs.test.js).

export const AUDIT_PAGE_SIZE = 25;
export const AUDIT_EXPORT_LIMIT = 5000;

export const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Reads ?q=&action=&resource=&from=&to=&page=&export= into a normalized object. */
export function parseAuditParams(sp) {
  const q = (sp.get("q") || "").trim().slice(0, 200);
  const action = (sp.get("action") || "").trim().slice(0, 100);
  const resource = (sp.get("resource") || "").trim().slice(0, 100);
  const from = DAY.test(sp.get("from") || "") ? sp.get("from") : "";
  const to = DAY.test(sp.get("to") || "") ? sp.get("to") : "";
  const isExport = sp.get("export") === "1";
  const page = Math.max(1, parseInt(sp.get("page"), 10) || 1);
  return {
    q, action, resource, from, to, isExport,
    paginated: sp.get("page") !== null || isExport,
    page: isExport ? 1 : page,
    limit: isExport ? AUDIT_EXPORT_LIMIT : AUDIT_PAGE_SIZE,
  };
}

/**
 * Mongo filter. `staffIds` = ids of staff whose name/email matched q (looked up by the caller).
 * Dates are whole days in UTC: from = start of that day, to = end of that day.
 */
export function buildAuditFilter({ q, action, resource, from, to }, staffIds = []) {
  const and = [];
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const or = [{ action: rx }, { resource: rx }, { resourceId: rx }, { "details.message": rx }];
    if (staffIds.length) or.push({ staffId: { $in: staffIds } });
    and.push({ $or: or });
  }
  if (action) and.push({ action });
  if (resource) and.push({ resource });
  if (from || to) {
    const ts = {};
    if (from) ts.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) ts.$lte = new Date(`${to}T23:59:59.999Z`);
    and.push({ timestamp: ts });
  }
  return and.length === 0 ? {} : and.length === 1 ? and[0] : { $and: and };
}

export function totalPages(total, limit = AUDIT_PAGE_SIZE) {
  return Math.max(1, Math.ceil((Number(total) || 0) / limit));
}

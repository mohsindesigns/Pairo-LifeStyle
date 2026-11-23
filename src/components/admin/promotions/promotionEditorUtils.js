// Pure helpers for the promotion editor. Kept free of React so they can be unit tested.

// --- Condition tree paths ---------------------------------------------------
// A group's path is "" for the root group, "rules.0" for its first nested group,
// "rules.0.rules.2" deeper down, etc. A field path appends a key ("operator",
// "rules.1.field"). Empty segments (e.g. from a leading ".") are ignored.

export function splitPath(path) {
  return String(path ?? "").split(".").filter((p) => p !== "");
}

export function joinPath(...parts) {
  return parts.flatMap((p) => splitPath(p)).join(".");
}

/** Path of the rule/group at `index` inside the group at `groupPath`. */
export function childRulePath(groupPath, index) {
  return joinPath(groupPath, "rules", String(index));
}

/** For a nested group path ("…rules.N"), returns its parent group path and its index. */
export function parentOfGroupPath(groupPath) {
  const parts = splitPath(groupPath);
  if (parts.length < 2 || parts[parts.length - 2] !== "rules") return null;
  const index = Number(parts[parts.length - 1]);
  if (!Number.isInteger(index)) return null;
  return { parentPath: parts.slice(0, -2).join("."), index };
}

function isIndex(key) {
  return /^\d+$/.test(key);
}

// Immutably applies `fn` to the value at `keys`, copying every object/array on the way.
function updateIn(node, keys, fn) {
  if (keys.length === 0) return fn(node);
  const [key, ...rest] = keys;
  if (Array.isArray(node)) {
    const i = Number(key);
    if (!isIndex(key) || i >= node.length) throw new Error(`Invalid condition path segment "${key}"`);
    const copy = node.slice();
    copy[i] = updateIn(node[i], rest, fn);
    return copy;
  }
  const base = node && typeof node === "object" ? node : {};
  return { ...base, [key]: updateIn(base[key], rest, fn) };
}

// Applies the update, or returns `conditions` unchanged if the path doesn't exist.
function safeUpdate(conditions, keys, fn) {
  try {
    return updateIn(rootOf(conditions), keys, fn);
  } catch {
    return conditions;
  }
}

function rootOf(conditions) {
  return conditions && typeof conditions === "object" ? conditions : { operator: "AND", rules: [] };
}

/** Sets the value at a field path, e.g. "rules.0.value" or "rules.1.operator". */
export function setConditionValue(conditions, path, value) {
  const keys = splitPath(path);
  if (keys.length === 0) return conditions;
  return safeUpdate(conditions, keys, () => value);
}

export function newRule(type = "rule") {
  return type === "group"
    ? { operator: "AND", rules: [] }
    : { field: "subtotal", op: ">=", value: 0 };
}

/** Appends a rule (or empty group) to the group at `groupPath`. */
export function addConditionRule(conditions, groupPath, type = "rule") {
  return safeUpdate(conditions, splitPath(groupPath), (group) => ({
    ...(group || {}),
    rules: [...(Array.isArray(group?.rules) ? group.rules : []), newRule(type)],
  }));
}

/** Removes the rule/group at `index` from the group at `groupPath`. */
export function removeConditionRule(conditions, groupPath, index) {
  return safeUpdate(conditions, splitPath(groupPath), (group) => ({
    ...(group || {}),
    rules: (Array.isArray(group?.rules) ? group.rules : []).filter((_, i) => i !== Number(index)),
  }));
}

// --- Dates --------------------------------------------------------------------
// <input type="date"> works in the admin's LOCAL calendar day. The engine (Loader)
// treats a promotion as live when startDate <= now <= endDate, so the start is the
// beginning of the local day and the end is the last millisecond of the local day.

const pad = (n) => String(n).padStart(2, "0");

/** Date/ISO string -> "YYYY-MM-DD" in local time ("" if empty/invalid). */
export function toLocalDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" -> ISO string at local start (or end) of that day; null if empty/invalid. */
export function fromLocalDateInput(str, { endOfDay = false } = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ""));
  if (!m) return null;
  const d = endOfDay
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
    : new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// --- Priority -------------------------------------------------------------------

export const PRIORITY_MIN = 0;
export const PRIORITY_MAX = 1000;

/** Validates a priority as typed (number or string). Empty means 0. */
export function parsePriority(raw) {
  if (raw === "" || raw === null || raw === undefined) return { ok: true, value: 0 };
  const s = String(raw).trim();
  if (!/^-?\d+$/.test(s)) return { ok: false, error: "Priority must be a whole number." };
  const n = Number(s);
  if (n < PRIORITY_MIN || n > PRIORITY_MAX) {
    return { ok: false, error: `Priority must be between ${PRIORITY_MIN} and ${PRIORITY_MAX}.` };
  }
  return { ok: true, value: n };
}

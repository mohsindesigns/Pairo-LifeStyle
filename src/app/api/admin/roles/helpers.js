// Pure helpers for the admin roles API. No DB access; unit-tested in
// src/__tests__/admin-roles-helpers.test.js.

export function slugifyRoleName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "Editor" -> "Editor (Copy)", then "Editor (Copy 2)", "Editor (Copy 3)"... skipping any
// name already taken (case-insensitive, trashed roles included: names are unique).
export function uniqueRoleCopyName(name, takenNames = []) {
  const taken = new Set(takenNames.map((n) => String(n).toLowerCase()));
  const base = String(name || "Role").replace(/\s+\(Copy(?: \d+)?\)$/i, "").trim() || "Role";
  let candidate = `${base} (Copy)`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${base} (Copy ${i})`;
  return candidate;
}

// "editor" -> "editor-copy", then "editor-copy-2"... skipping taken slugs.
export function uniqueRoleCopySlug(slug, takenSlugs = []) {
  const taken = new Set(takenSlugs);
  const base = String(slug || "role").replace(/-copy(?:-\d+)?$/, "") || "role";
  let candidate = `${base}-copy`;
  for (let i = 2; taken.has(candidate); i++) candidate = `${base}-copy-${i}`;
  return candidate;
}

// Role.permissions is a Mongoose Map; turn it (or a lean plain object) into a plain
// { module: [actions] } object with copied arrays.
export function plainPermissions(permissions) {
  if (!permissions) return {};
  const entries = permissions instanceof Map ? [...permissions.entries()] : Object.entries(permissions);
  const out = {};
  for (const [module, actions] of entries) {
    if (Array.isArray(actions)) out[module] = [...actions];
  }
  return out;
}

// Why a role can't be moved to the Trash / deleted, or null when it can.
// usage = { active, trashed } staff counts that reference the role.
export function roleRemovalError(role, usage = { active: 0, trashed: 0 }) {
  if (!role) return "Role not found";
  if (role.isSystem) return "System roles cannot be moved to the Trash or deleted";
  const active = usage.active || 0;
  const trashed = usage.trashed || 0;
  const total = active + trashed;
  if (total > 0) {
    const who = `${total} user${total === 1 ? "" : "s"}`;
    const inTrash = trashed ? ` (${trashed} in the Trash)` : "";
    const fix = trashed
      ? "Assign them another role, or delete the trashed users permanently, first."
      : "Assign them another role first.";
    return `${who}${inTrash} still ${total === 1 ? "has" : "have"} this role. ${fix}`;
  }
  return null;
}

export function parseRoleDeleteMode(value) {
  return value === "permanent" ? "permanent" : "trash";
}

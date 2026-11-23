// Pure helpers for the admin staff ("Users") API. No DB access; unit-tested in
// src/__tests__/admin-team-helpers.test.js.

export const SUPER_ADMIN_SLUG = "super-admin";
export const STAFF_STATUSES = ["Active", "Suspended", "Locked"];
export const MIN_STAFF_PASSWORD = 6;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// DELETE ?mode= : "trash" (default, soft delete) or "permanent" (only once trashed).
export function parseStaffDeleteMode(value) {
  return value === "permanent" ? "permanent" : "trash";
}

export function normalizeStaffEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidStaffEmail(value) {
  return EMAIL_PATTERN.test(normalizeStaffEmail(value));
}

const roleSlugOf = (staff) => staff?.roleId?.slug || staff?.role?.slug || null;

/**
 * Can `actor` move `target` to the Trash?
 * - nobody trashes themselves;
 * - only a Super Admin may trash another Super Admin, and never the last active one.
 * `otherActiveSuperAdmins` = active, non-trashed Super Admins other than the target.
 * Returns an error message, or null when allowed.
 */
export function staffTrashError({ actorId, actorRoleSlug, target, otherActiveSuperAdmins = 0 }) {
  if (!target) return "Staff member not found";
  if (actorId && String(actorId) === String(target._id)) return "You cannot move your own account to the Trash";
  if (roleSlugOf(target) === SUPER_ADMIN_SLUG) {
    if (actorRoleSlug !== SUPER_ADMIN_SLUG) return "Only a Super Admin can move a Super Admin to the Trash";
    if (otherActiveSuperAdmins < 1) return "This is the last active Super Admin and cannot be moved to the Trash";
  }
  return null;
}

/**
 * Can `actor` delete `target` permanently? Only from the Trash, never yourself, and a
 * Super Admin account only by another Super Admin.
 */
export function staffPermanentDeleteError({ actorId, actorRoleSlug, target }) {
  if (!target) return "Staff member not found";
  if (actorId && String(actorId) === String(target._id)) return "You cannot delete your own account";
  if (!target.isDeleted) return "Move the user to the Trash before deleting them permanently";
  if (roleSlugOf(target) === SUPER_ADMIN_SLUG && actorRoleSlug !== SUPER_ADMIN_SLUG) {
    return "Only a Super Admin can delete a Super Admin account";
  }
  return null;
}

/**
 * Can `actor` bring `target` back from the Trash? A Super Admin account is restored only by a Super Admin, the same
 * rule as trashing and deleting one: otherwise anyone who may restore users could hand a trashed Super Admin their
 * full access back. Returns an error message, or null when allowed.
 */
export function staffRestoreError({ actorRoleSlug, target }) {
  if (!target) return "Staff member not found";
  if (roleSlugOf(target) === SUPER_ADMIN_SLUG && actorRoleSlug !== SUPER_ADMIN_SLUG) {
    return "Only a Super Admin can restore a Super Admin";
  }
  return null;
}

// Mongo update that moves a staff member to the Trash. Status goes to Suspended so the
// auth route's status checks refuse sign-in and end any live session.
export function staffTrashUpdate(staff, now = new Date()) {
  return {
    $set: {
      isDeleted: true,
      deletedAt: now,
      statusBeforeTrash: staff?.status && STAFF_STATUSES.includes(staff.status) ? staff.status : "Active",
      status: "Suspended",
    },
  };
}

// Mongo update that restores a staff member from the Trash with their previous status.
export function staffRestoreUpdate(staff) {
  const previous = staff?.statusBeforeTrash;
  return {
    $set: {
      isDeleted: false,
      deletedAt: null,
      status: STAFF_STATUSES.includes(previous) ? previous : "Active",
      statusBeforeTrash: null,
    },
  };
}

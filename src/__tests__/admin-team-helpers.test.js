import { describe, it, expect } from "vitest";
import {
  parseStaffDeleteMode,
  normalizeStaffEmail,
  isValidStaffEmail,
  staffTrashError,
  staffPermanentDeleteError,
  staffTrashUpdate,
  staffRestoreUpdate,
} from "@/app/api/admin/staff/helpers";

const superAdmin = (id, extra = {}) => ({ _id: id, roleId: { slug: "super-admin" }, status: "Active", ...extra });
const editor = (id, extra = {}) => ({ _id: id, roleId: { slug: "editor" }, status: "Active", ...extra });

describe("staff delete mode / email", () => {
  it("defaults to trash", () => {
    expect(parseStaffDeleteMode(null)).toBe("trash");
    expect(parseStaffDeleteMode("weird")).toBe("trash");
    expect(parseStaffDeleteMode("permanent")).toBe("permanent");
  });
  it("normalizes and validates emails", () => {
    expect(normalizeStaffEmail("  A@B.Com ")).toBe("a@b.com");
    expect(isValidStaffEmail("x@y.io")).toBe(true);
    expect(isValidStaffEmail("nope")).toBe(false);
  });
});

describe("staffTrashError", () => {
  it("never lets you trash yourself", () => {
    expect(staffTrashError({ actorId: "a", actorRoleSlug: "super-admin", target: editor("a") })).toMatch(/your own/);
  });
  it("allows trashing a regular user", () => {
    expect(staffTrashError({ actorId: "a", actorRoleSlug: "admin", target: editor("b") })).toBeNull();
  });
  it("only a super admin may trash a super admin", () => {
    expect(staffTrashError({ actorId: "a", actorRoleSlug: "admin", target: superAdmin("b"), otherActiveSuperAdmins: 3 })).toMatch(/Only a Super Admin/);
    expect(staffTrashError({ actorId: "a", actorRoleSlug: "super-admin", target: superAdmin("b"), otherActiveSuperAdmins: 1 })).toBeNull();
  });
  it("never trashes the last active super admin", () => {
    expect(staffTrashError({ actorId: "a", actorRoleSlug: "super-admin", target: superAdmin("b"), otherActiveSuperAdmins: 0 })).toMatch(/last active/);
  });
});

describe("staffPermanentDeleteError", () => {
  it("requires the user to be in the Trash", () => {
    expect(staffPermanentDeleteError({ actorId: "a", actorRoleSlug: "admin", target: editor("b") })).toMatch(/Trash/);
    expect(staffPermanentDeleteError({ actorId: "a", actorRoleSlug: "admin", target: editor("b", { isDeleted: true }) })).toBeNull();
  });
  it("protects super admins from non super admins and self", () => {
    expect(staffPermanentDeleteError({ actorId: "a", actorRoleSlug: "admin", target: superAdmin("b", { isDeleted: true }) })).toMatch(/Only a Super Admin/);
    expect(staffPermanentDeleteError({ actorId: "b", actorRoleSlug: "super-admin", target: superAdmin("b", { isDeleted: true }) })).toMatch(/your own/);
  });
});

describe("trash / restore updates", () => {
  it("suspends on trash and remembers the previous status", () => {
    const now = new Date("2026-01-01");
    expect(staffTrashUpdate({ status: "Locked" }, now).$set).toEqual({ isDeleted: true, deletedAt: now, statusBeforeTrash: "Locked", status: "Suspended" });
  });
  it("restores the previous status (Active when unknown)", () => {
    expect(staffRestoreUpdate({ statusBeforeTrash: "Locked" }).$set.status).toBe("Locked");
    expect(staffRestoreUpdate({}).$set).toEqual({ isDeleted: false, deletedAt: null, status: "Active", statusBeforeTrash: null });
  });
});

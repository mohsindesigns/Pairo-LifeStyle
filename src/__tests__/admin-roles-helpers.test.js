import { describe, it, expect } from "vitest";
import {
  slugifyRoleName,
  uniqueRoleCopyName,
  uniqueRoleCopySlug,
  plainPermissions,
  roleRemovalError,
  parseRoleDeleteMode,
} from "@/app/api/admin/roles/helpers";

describe("role slugs and copy names", () => {
  it("slugifies names", () => {
    expect(slugifyRoleName("  Marketing Manager! ")).toBe("marketing-manager");
    expect(slugifyRoleName("***")).toBe("");
  });
  it("makes unique copy names", () => {
    expect(uniqueRoleCopyName("Editor", ["Editor"])).toBe("Editor (Copy)");
    expect(uniqueRoleCopyName("Editor", ["editor (copy)"])).toBe("Editor (Copy 2)");
    expect(uniqueRoleCopyName("Editor (Copy)", ["Editor (Copy)", "Editor (Copy 2)"])).toBe("Editor (Copy 3)");
  });
  it("makes unique copy slugs", () => {
    expect(uniqueRoleCopySlug("editor", ["editor"])).toBe("editor-copy");
    expect(uniqueRoleCopySlug("editor", ["editor-copy"])).toBe("editor-copy-2");
    expect(uniqueRoleCopySlug("editor-copy", ["editor-copy", "editor-copy-2"])).toBe("editor-copy-3");
  });
});

describe("plainPermissions", () => {
  it("copies Maps and objects", () => {
    const src = new Map([["products", ["view"]]]);
    const out = plainPermissions(src);
    expect(out).toEqual({ products: ["view"] });
    out.products.push("edit");
    expect(src.get("products")).toEqual(["view"]);
    expect(plainPermissions({ a: ["x"], bad: "nope" })).toEqual({ a: ["x"] });
    expect(plainPermissions(null)).toEqual({});
  });
});

describe("roleRemovalError", () => {
  it("blocks system roles", () => {
    expect(roleRemovalError({ isSystem: true })).toMatch(/System roles/);
  });
  it("blocks roles in use and says how many", () => {
    expect(roleRemovalError({}, { active: 2, trashed: 0 })).toMatch(/^2 users still have this role/);
    expect(roleRemovalError({}, { active: 0, trashed: 1 })).toMatch(/1 user \(1 in the Trash\) still has/);
  });
  it("allows unused custom roles", () => {
    expect(roleRemovalError({ isSystem: false }, { active: 0, trashed: 0 })).toBeNull();
  });
  it("parses delete mode", () => {
    expect(parseRoleDeleteMode("permanent")).toBe("permanent");
    expect(parseRoleDeleteMode(undefined)).toBe("trash");
  });
});

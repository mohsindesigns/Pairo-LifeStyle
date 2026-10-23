import { describe, it, expect } from "vitest";
import {
  parseCustomerListParams,
  buildCustomerFilter,
  escapeRegex,
  validateNewCustomer,
  totalPages,
  parseCustomerDeleteMode,
  CUSTOMERS_PAGE_SIZE,
} from "@/app/api/admin/customers/helpers";

describe("admin customers list params", () => {
  it("is not paginated without ?page (legacy array callers)", () => {
    const p = parseCustomerListParams(new URLSearchParams(""));
    expect(p.paginated).toBe(false);
    expect(p.filter).toBe("all");
  });

  it("parses page, search and active filter", () => {
    const p = parseCustomerListParams(new URLSearchParams("page=3&search=%20jo%20&filter=active"));
    expect(p).toMatchObject({ paginated: true, page: 3, search: "jo", filter: "active", limit: 20 });
  });

  it("clamps bad page numbers and unknown filters", () => {
    expect(parseCustomerListParams(new URLSearchParams("page=-4")).page).toBe(1);
    expect(parseCustomerListParams(new URLSearchParams("page=abc")).page).toBe(1);
    expect(parseCustomerListParams(new URLSearchParams("page=1&filter=evil")).filter).toBe("all");
  });

  it("computes total pages", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(20)).toBe(1);
    expect(totalPages(21)).toBe(2);
    expect(CUSTOMERS_PAGE_SIZE).toBe(20);
  });
});

describe("buildCustomerFilter", () => {
  it("always excludes admins and trashed customers", () => {
    expect(buildCustomerFilter()).toEqual({ role: { $ne: "admin" }, isDeleted: { $ne: true } });
  });

  it("lists only trashed customers for the Trash view", () => {
    expect(buildCustomerFilter({ trash: true })).toEqual({ role: { $ne: "admin" }, isDeleted: true });
  });

  it("accepts the trash filter param", () => {
    expect(parseCustomerListParams(new URLSearchParams("page=1&filter=trash")).filter).toBe("trash");
  });

  it("delete mode defaults to trash; permanent only when asked", () => {
    expect(parseCustomerDeleteMode(null)).toBe("trash");
    expect(parseCustomerDeleteMode("evil")).toBe("trash");
    expect(parseCustomerDeleteMode("permanent")).toBe("permanent");
  });

  it("escapes regex input for search", () => {
    const f = buildCustomerFilter({ search: "a.b+(c)" });
    expect(f.$or[0].name.$regex).toBe("a\\.b\\+\\(c\\)");
    expect(f.$or[0].name.$options).toBe("i");
  });

  it("restricts to active ids when given", () => {
    const f = buildCustomerFilter({ activeIds: ["x", "y"] });
    expect(f._id).toEqual({ $in: ["x", "y"] });
  });

  it("escapeRegex leaves plain text alone", () => {
    expect(escapeRegex("john")).toBe("john");
  });
});

describe("validateNewCustomer", () => {
  it("accepts a valid payload and normalizes email + name", () => {
    const { errors, value } = validateNewCustomer({
      firstName: " Jane ", lastName: "Doe", email: " Jane@Example.COM ", phone: "+1 555-0100", password: "longenough",
    });
    expect(errors).toEqual([]);
    expect(value).toEqual({ name: "Jane Doe", email: "jane@example.com", phone: "+1 555-0100", password: "longenough" });
  });

  it("falls back to email local part when no name given", () => {
    expect(validateNewCustomer({ email: "sam@x.io", password: "12345678" }).value.name).toBe("sam");
  });

  it("rejects bad email, short password and bad phone", () => {
    const { errors } = validateNewCustomer({ email: "nope", password: "short", phone: "<script>" });
    expect(errors).toHaveLength(3);
  });

  it("requires an email", () => {
    expect(validateNewCustomer({ password: "12345678" }).errors).toContain("Email is required.");
  });
});

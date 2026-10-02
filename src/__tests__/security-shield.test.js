import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { RESERVED_ROUTES } from "../lib/routes";
import { RESERVED_SLUGS, isReservedPath } from "../lib/redirect-resolver";
import SecurityShield from "../components/common/SecurityShield";

describe("Security Shield & Route Protection", () => {
  it("should maintain core reserved routes", () => {
    expect(RESERVED_ROUTES).toContain("admin");
    expect(RESERVED_ROUTES).toContain("api");
  });

  it("should properly check reserved paths", () => {
    expect(isReservedPath("/admin")).toBe(true);
    expect(isReservedPath("/api")).toBe(true);
  });

  it("should export SecurityShield client component function", () => {
    expect(typeof SecurityShield).toBe("function");
  });

  it("should safely return null when not in production environment", () => {
    // In vitest (test environment), isProduction is false, so SecurityShield returns null
    const result = SecurityShield();
    expect(result).toBeNull();
  });
});

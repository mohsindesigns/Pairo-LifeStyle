import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { RESERVED_ROUTES } from "../lib/routes";
import { RESERVED_SLUGS, isReservedPath } from "../lib/redirect-resolver";
import SecurityShield from "../components/common/SecurityShield";
import AccessDeniedPage from "../app/access-denied/page";

describe("Security Shield & Route Protection", () => {
  it("should have access-denied registered in RESERVED_ROUTES", () => {
    expect(RESERVED_ROUTES).toContain("access-denied");
  });

  it("should have access-denied registered in RESERVED_SLUGS", () => {
    expect(RESERVED_SLUGS).toContain("access-denied");
  });

  it("should recognize /access-denied as a reserved path to prevent CMS collisions", () => {
    expect(isReservedPath("/access-denied")).toBe(true);
    expect(isReservedPath("access-denied")).toBe(true);
  });

  it("should export SecurityShield client component function", () => {
    expect(typeof SecurityShield).toBe("function");
  });

  it("should export AccessDeniedPage component function", () => {
    expect(typeof AccessDeniedPage).toBe("function");
  });

  it("should safely return null when not in production environment", () => {
    // In vitest (test environment), isProduction is false, so SecurityShield returns null
    const result = SecurityShield();
    expect(result).toBeNull();
  });
});

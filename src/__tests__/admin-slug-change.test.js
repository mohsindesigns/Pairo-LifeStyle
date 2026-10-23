import { describe, it, expect, vi } from "vitest";
import {
  normalizeSlug,
  normalizePageSlug,
  isSlugChange,
  slugChangeMessage,
  confirmSlugChange,
  SLUG_CHANGE_TITLE,
  SLUG_CHANGE_OPTIONS,
} from "@/components/admin/slugChange";

describe("isSlugChange", () => {
  it("ignores whitespace and case-only differences", () => {
    expect(isSlugChange("blue-jacket", "  Blue-Jacket ")).toBe(false);
    expect(normalizeSlug(null)).toBe("");
  });
  it("detects a real change", () => {
    expect(isSlugChange("blue-jacket", "red-jacket")).toBe(true);
  });
  it("never prompts without a saved slug (new record)", () => {
    expect(isSlugChange(null, "anything")).toBe(false);
    expect(isSlugChange("", "anything")).toBe(false);
  });
  it("uses a custom normaliser (page slugs)", () => {
    expect(normalizePageSlug(" About Us ")).toBe("about-us");
    expect(isSlugChange("about-us", "About Us", normalizePageSlug)).toBe(false);
    expect(isSlugChange("about-us", "about", normalizePageSlug)).toBe(true);
  });
});

describe("confirmSlugChange", () => {
  it("does not ask when the slug is unchanged", async () => {
    const showConfirm = vi.fn();
    await expect(confirmSlugChange(showConfirm, { savedSlug: "a", nextSlug: "A " })).resolves.toBe(true);
    expect(showConfirm).not.toHaveBeenCalled();
  });
  it("asks with old/new paths and returns the answer", async () => {
    const showConfirm = vi.fn().mockResolvedValue(false);
    const ok = await confirmSlugChange(showConfirm, {
      savedSlug: "old",
      nextSlug: "new",
      toPath: (s) => `/blog/${s}`,
    });
    expect(ok).toBe(false);
    expect(showConfirm).toHaveBeenCalledWith(
      slugChangeMessage("/blog/old", "/blog/new"),
      SLUG_CHANGE_TITLE,
      SLUG_CHANGE_OPTIONS
    );
    expect(slugChangeMessage("/old", "/new")).toBe(
      "Change this URL from /old to /new?\n\nOld links will redirect to the new URL automatically."
    );
    showConfirm.mockResolvedValue(true);
    await expect(confirmSlugChange(showConfirm, { savedSlug: "old", nextSlug: "new" })).resolves.toBe(true);
    expect(showConfirm).toHaveBeenLastCalledWith(slugChangeMessage("/old", "/new"), "Change URL?", {
      confirmText: "Change URL",
      cancelText: "Keep old URL",
    });
  });
});

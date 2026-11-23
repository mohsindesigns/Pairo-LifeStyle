import { describe, it, expect } from "vitest";
import {
  slugify,
  uniqueSlug,
  escapeRegex,
  reindexSteps,
  duplicateStepIn,
  trashStepIn,
  restoreStepIn,
  validateProcessSteps,
} from "@/lib/admin-products-utils";

describe("slugify", () => {
  it("lower-cases and dashes", () => {
    expect(slugify("  Men's B3 Jacket!! ")).toBe("men-s-b3-jacket");
    expect(slugify("")).toBe("");
    expect(slugify(null)).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", async () => {
    expect(await uniqueSlug("jacket", () => false)).toBe("jacket");
  });
  it("suffixes -1, -2 on clashes (async checker)", async () => {
    const taken = new Set(["jacket", "jacket-1"]);
    expect(await uniqueSlug("jacket", async (s) => taken.has(s))).toBe("jacket-2");
  });
  it("normalises the base and falls back to 'product'", async () => {
    expect(await uniqueSlug("Hello World", () => false)).toBe("hello-world");
    expect(await uniqueSlug("!!!", () => false)).toBe("product");
  });
});

describe("escapeRegex", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("a.b*(c)")).toBe("a\\.b\\*\\(c\\)");
    expect(new RegExp(escapeRegex("size (XL)?")).test("size (XL)?")).toBe(true);
  });
});

describe("process steps", () => {
  const steps = reindexSteps([
    { id: "a", heading: "Cut", image: "/a.jpg" },
    { id: "b", heading: "Sew", image: "/b.jpg", _id: "x1" },
    { id: "c", heading: "Finish", image: "/c.jpg" },
  ]);

  it("reindexes order", () => {
    expect(steps.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it("duplicates right after the source with a new id and no _id", () => {
    const out = duplicateStepIn(steps, "b", () => "new");
    expect(out.map((s) => s.id)).toEqual(["a", "b", "new", "c"]);
    expect(out[2].heading).toBe("Sew (Copy)");
    expect(out[2]._id).toBeUndefined();
    expect(out.map((s) => s.order)).toEqual([0, 1, 2, 3]);
    expect(duplicateStepIn(steps, "zzz", () => "n")).toBe(steps);
  });

  it("trashes and restores", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const t = trashStepIn(steps, [], "a", now);
    expect(t.steps.map((s) => s.id)).toEqual(["b", "c"]);
    expect(t.steps[0].order).toBe(0);
    expect(t.trashed[0]).toMatchObject({ id: "a", deletedAt: now.toISOString() });
    const r = restoreStepIn(t.steps, t.trashed, "a");
    expect(r.steps.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(r.steps[2].deletedAt).toBeUndefined();
    expect(r.trashed).toEqual([]);
  });

  it("validates heading and image", () => {
    expect(validateProcessSteps(steps)).toBeNull();
    expect(validateProcessSteps([{ heading: " ", image: "/x" }])).toMatch(/Step 1 needs a heading/);
    expect(validateProcessSteps([{ heading: "Cut", image: "/x" }, { heading: "Sew", image: "" }])).toMatch(/Step 2 \("Sew"\) needs an image/);
    expect(validateProcessSteps([])).toBeNull();
  });
});

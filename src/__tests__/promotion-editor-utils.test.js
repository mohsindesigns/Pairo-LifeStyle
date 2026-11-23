import { describe, it, expect } from "vitest";
import {
  joinPath, childRulePath, parentOfGroupPath,
  setConditionValue, addConditionRule, removeConditionRule,
  toLocalDateInput, fromLocalDateInput, parsePriority,
} from "../components/admin/promotions/promotionEditorUtils";

const tree = () => ({
  operator: "AND",
  rules: [
    { field: "subtotal", op: ">=", value: 10 },
    { operator: "OR", rules: [{ field: "items_count", op: ">=", value: 2 }] },
  ],
});

describe("condition paths", () => {
  it("builds top-level and nested paths without leading dots", () => {
    expect(childRulePath("", 0)).toBe("rules.0");
    expect(childRulePath("rules.1", 0)).toBe("rules.1.rules.0");
    expect(joinPath(childRulePath("", 0), "field")).toBe("rules.0.field");
    expect(joinPath("", "operator")).toBe("operator");
  });

  it("finds a nested group's parent and index", () => {
    expect(parentOfGroupPath("rules.1")).toEqual({ parentPath: "", index: 1 });
    expect(parentOfGroupPath("rules.1.rules.3")).toEqual({ parentPath: "rules.1", index: 3 });
    expect(parentOfGroupPath("")).toBeNull();
  });
});

describe("setConditionValue", () => {
  it("updates a top-level condition immutably", () => {
    const before = tree();
    const after = setConditionValue(before, "rules.0.value", 50);
    expect(after.rules[0].value).toBe(50);
    expect(before.rules[0].value).toBe(10);
    expect(after.rules[1]).toBe(before.rules[1]);
  });

  it("tolerates a legacy leading-dot path", () => {
    expect(setConditionValue(tree(), ".rules.0.field", "items_count").rules[0].field).toBe("items_count");
  });

  it("updates nested conditions and group operators", () => {
    const before = tree();
    const a = setConditionValue(before, "rules.1.rules.0.value", 5);
    expect(a.rules[1].rules[0].value).toBe(5);
    expect(before.rules[1].rules[0].value).toBe(2);
    expect(setConditionValue(before, "operator", "OR").operator).toBe("OR");
    expect(setConditionValue(before, "rules.1.operator", "NOT").rules[1].operator).toBe("NOT");
  });

  it("returns the input unchanged for a missing path", () => {
    const before = tree();
    expect(setConditionValue(before, "rules.9.value", 1)).toBe(before);
  });
});

describe("add/remove rules", () => {
  it("adds to root and nested groups without mutating (StrictMode-safe)", () => {
    const before = tree();
    const a = addConditionRule(before, "", "rule");
    const b = addConditionRule(before, "", "rule"); // updater run twice on same prev
    expect(a.rules).toHaveLength(3);
    expect(b.rules).toHaveLength(3);
    expect(before.rules).toHaveLength(2);
    const c = addConditionRule(before, "rules.1", "group");
    expect(c.rules[1].rules).toHaveLength(2);
    expect(c.rules[1].rules[1]).toEqual({ operator: "AND", rules: [] });
    expect(before.rules[1].rules).toHaveLength(1);
  });

  it("adds to an empty conditions object", () => {
    expect(addConditionRule({}, "", "rule").rules).toHaveLength(1);
  });

  it("removes top-level rules and nested groups without mutating", () => {
    const before = tree();
    const a = removeConditionRule(before, "", 0);
    expect(a.rules).toHaveLength(1);
    expect(before.rules).toHaveLength(2);
    const { parentPath, index } = parentOfGroupPath("rules.1");
    const b = removeConditionRule(before, parentPath, index);
    expect(b.rules).toEqual([before.rules[0]]);
    const c = removeConditionRule(before, "rules.1", 0);
    expect(c.rules[1].rules).toEqual([]);
    expect(before.rules[1].rules).toHaveLength(1);
  });
});

describe("local dates", () => {
  it("round-trips a date input in local time", () => {
    const start = fromLocalDateInput("2026-03-05");
    const end = fromLocalDateInput("2026-03-05", { endOfDay: true });
    const s = new Date(start), e = new Date(end);
    expect([s.getFullYear(), s.getMonth(), s.getDate(), s.getHours(), s.getMinutes()]).toEqual([2026, 2, 5, 0, 0]);
    expect([e.getDate(), e.getHours(), e.getMinutes(), e.getSeconds()]).toEqual([5, 23, 59, 59]);
    expect(toLocalDateInput(start)).toBe("2026-03-05");
    expect(toLocalDateInput(end)).toBe("2026-03-05");
  });

  it("handles empty/invalid values", () => {
    expect(fromLocalDateInput("")).toBeNull();
    expect(fromLocalDateInput("nope")).toBeNull();
    expect(toLocalDateInput(null)).toBe("");
    expect(toLocalDateInput("garbage")).toBe("");
  });
});

describe("parsePriority", () => {
  it("accepts integers in range and treats empty as 0", () => {
    expect(parsePriority("")).toEqual({ ok: true, value: 0 });
    expect(parsePriority(undefined)).toEqual({ ok: true, value: 0 });
    expect(parsePriority("42")).toEqual({ ok: true, value: 42 });
    expect(parsePriority(7)).toEqual({ ok: true, value: 7 });
  });

  it("rejects non-integers and out-of-range values", () => {
    expect(parsePriority("1.5").ok).toBe(false);
    expect(parsePriority("abc").ok).toBe(false);
    expect(parsePriority("-1").ok).toBe(false);
    expect(parsePriority("1001").ok).toBe(false);
    expect(parsePriority(NaN).ok).toBe(false);
  });
});

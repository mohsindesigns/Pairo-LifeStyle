import { describe, it, expect } from "vitest";
import { stripDeletedSuffix, permanentDeleteBlockers, joinReasons, blockersMessage } from "@/app/api/admin/affiliates/list/trash-utils";

describe("affiliate trash helpers", () => {
  it("removes the old delete-flow suffixes", () => {
    expect(stripDeletedSuffix("a@b.com-deleted-1712345678901")).toBe("a@b.com");
    expect(stripDeletedSuffix("JOHN-DELETED-1712345678901")).toBe("JOHN");
    expect(stripDeletedSuffix("JOHN")).toBe("JOHN");
    expect(stripDeletedSuffix(undefined)).toBe(undefined);
  });

  it("allows permanent delete only without financial history", () => {
    expect(permanentDeleteBlockers({})).toEqual([]);
    expect(permanentDeleteBlockers({ commissions: 1 })).toEqual(["1 commission"]);
    expect(permanentDeleteBlockers({ payouts: 2, ledger: 3, orders: 1 })).toEqual(["2 payouts", "3 ledger entries", "1 referred order"]);
    expect(permanentDeleteBlockers({ ledger: 1 })).toEqual(["1 ledger entry"]);
    expect(permanentDeleteBlockers({ balance: -5 })).toEqual(["a non-zero balance"]);
    expect(permanentDeleteBlockers({ lifetimeEarnings: 10 })).toEqual(["lifetime earnings"]);
  });

  it("explains why", () => {
    expect(joinReasons(["a"])).toBe("a");
    expect(joinReasons(["a", "b", "c"])).toBe("a, b and c");
    expect(blockersMessage([])).toBe("");
    expect(blockersMessage(["1 payout"])).toMatch(/^This affiliate has 1 payout\./);
  });
});

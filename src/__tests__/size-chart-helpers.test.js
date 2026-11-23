import { describe, it, expect } from "vitest";
import {
  sizeChartViewQuery,
  copyLabelCandidates,
  pickCopyLabel,
  buildSizeChartCopy,
  pickEditableSizeChartFields,
} from "@/app/api/admin/size-charts/helpers";

describe("size chart helpers", () => {
  it("builds list queries that treat legacy charts as live", () => {
    expect(sizeChartViewQuery("all")).toEqual({ isDeleted: { $ne: true } });
    expect(sizeChartViewQuery("trash")).toEqual({ isDeleted: true });
  });

  it("generates copy labels and does not stack suffixes", () => {
    expect(copyLabelCandidates("Men", 3)).toEqual(["Men (Copy)", "Men (Copy 2)", "Men (Copy 3)"]);
    expect(copyLabelCandidates("Men (Copy 2)", 2)).toEqual(["Men (Copy)", "Men (Copy 2)"]);
  });

  it("picks the first free label, case-insensitively, counting trashed ones", () => {
    expect(pickCopyLabel("Men", [])).toBe("Men (Copy)");
    expect(pickCopyLabel("Men", ["men (copy)", "Men (Copy 2)"])).toBe("Men (Copy 3)");
  });

  it("copies content as an unassigned draft without bookkeeping fields", () => {
    const src = {
      _id: "x", label: "Men", publicHeading: "Guide", description: "d",
      columns: ["Size", "Chest"], rows: [["S", "36"]], status: "Published",
      assignmentType: "category", assignmentTargetId: "c1", isDeleted: true, trashedRefs: [{}],
    };
    const copy = buildSizeChartCopy(src, "Men (Copy)");
    expect(copy).toEqual({
      label: "Men (Copy)", publicHeading: "Guide", description: "d",
      columns: ["Size", "Chest"], rows: [["S", "36"]], status: "Draft",
      assignmentType: "none", assignmentTargetId: null,
    });
    copy.rows[0][0] = "M";
    expect(src.rows[0][0]).toBe("S");
  });

  it("whitelists editable fields", () => {
    expect(pickEditableSizeChartFields({ label: "a", isDeleted: true, trashedRefs: [], _id: 1, status: "Draft" }))
      .toEqual({ label: "a", status: "Draft" });
  });
});

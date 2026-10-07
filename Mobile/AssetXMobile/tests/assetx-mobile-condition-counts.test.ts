import { describe, expect, it } from "vitest";
import { buildConditionNotes, dominantCondition, parseConditionNotes, statusIdByName } from "../features/assetx/domain";

describe("AssetX Mobile condition breakdown (notes-only, no DB change)", () => {
  it("builds a structured notes line from positive counts only", () => {
    expect(buildConditionNotes([
      { statusName: "New", quantity: 5 },
      { statusName: "Needs Maintenance", quantity: 3 },
      { statusName: "Damaged", quantity: 1 },
    ])).toBe("تفصيل الحالة: New:5 | Needs Maintenance:3 | Damaged:1");
  });

  it("returns null when no positive counts are present", () => {
    expect(buildConditionNotes([{ statusName: "New", quantity: 0 }, { statusName: "Tالف", quantity: null }])).toBeNull();
  });

  it("picks the dominant condition by largest quantity", () => {
    expect(dominantCondition([
      { statusName: "New", quantity: 5 },
      { statusName: "Needs Maintenance", quantity: 3 },
      { statusName: "Damaged", quantity: 1 },
    ])).toBe("New");
  });

  it("maps a status name to the server status id case-insensitively", () => {
    const statuses = [
      { id: "s-new", name: "New", color: "#2ecc71" },
      { id: "s-maint", name: "Needs Maintenance", color: "#e67e22" },
    ];
    expect(statusIdByName(statuses, "needs maintenance")).toBe("s-maint");
    expect(statusIdByName(statuses, "غير موجود")).toBeNull();
  });

  it("restores the breakdown counts from saved notes and keeps the rest of the note", () => {
    const parsed = parseConditionNotes("تحتاج مراجعة الموقع\nتفصيل الحالة: New:5 | Needs Maintenance:3 | Damaged:1");
    expect(parsed.counts).toEqual([
      { statusName: "New", quantity: 5 },
      { statusName: "Needs Maintenance", quantity: 3 },
      { statusName: "Damaged", quantity: 1 },
    ]);
    expect(parsed.restNotes).toBe("تحتاج مراجعة الموقع");
  });

  it("returns empty counts when notes have no breakdown", () => {
    expect(parseConditionNotes("ملاحظة عادية")).toEqual({ counts: [], restNotes: "ملاحظة عادية" });
    expect(parseConditionNotes(null)).toEqual({ counts: [], restNotes: null });
  });
});

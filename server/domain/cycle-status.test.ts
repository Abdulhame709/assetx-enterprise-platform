import { describe, expect, it } from "vitest";
import { assertCycleTransition, canEditCycle } from "./cycle-status";

describe("دورة حياة الفوترة", () => {
  it("تسمح بالانتقال المنضبط من المسودة حتى الإقفال", () => {
    expect(() => assertCycleTransition("draft", "data_entry")).not.toThrow();
    expect(() => assertCycleTransition("data_entry", "validation")).not.toThrow();
    expect(() => assertCycleTransition("validation", "reviewed")).not.toThrow();
    expect(() => assertCycleTransition("reviewed", "approved")).not.toThrow();
    expect(() => assertCycleTransition("approved", "closed")).not.toThrow();
  });

  it("يرفض تجاوز المراجعة أو إعادة فتح دورة مقفلة مباشرة", () => {
    expect(() => assertCycleTransition("draft", "approved")).toThrow("لا يمكن نقل الدورة");
    expect(() => assertCycleTransition("closed", "data_entry")).toThrow("لا يمكن نقل الدورة");
  });

  it("يمنع تعديل دورة مقفلة", () => {
    expect(canEditCycle("closed")).toBe(false);
    expect(canEditCycle("data_entry")).toBe(true);
  });
});

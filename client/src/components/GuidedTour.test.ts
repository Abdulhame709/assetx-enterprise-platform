import { describe, expect, it } from "vitest";
import { clampTourStep, guidedTourStorageKey } from "./GuidedTour";

describe("الجولة الإرشادية التفاعلية", () => {
  it("تحافظ على مؤشر الخطوة داخل حدود الجولة", () => {
    expect(clampTourStep(-2, 4)).toBe(0);
    expect(clampTourStep(1, 4)).toBe(1);
    expect(clampTourStep(99, 4)).toBe(3);
    expect(clampTourStep(4, 0)).toBe(0);
  });

  it("تستخدم مفتاحًا مستقلًا لكل مساحة عمل", () => {
    expect(guidedTourStorageKey("portal")).toBe("guided-tour-portal-v1");
    expect(guidedTourStorageKey("energy")).not.toBe(guidedTourStorageKey("fuel"));
  });
});

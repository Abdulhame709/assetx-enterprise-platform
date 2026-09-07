import { describe, expect, it } from "vitest";
import { assertFuelAvailable, assertFuelCapacity, calculateCorrectedFuelQuantity, calculateFuelBalance, calculateFuelIssueQuantity, classifyFuelVariance } from "./fuel";

describe("محرك جرد الوقود", () => {
  it("يصحح كمية التوريد بحسب الحرارة", () => {
    expect(calculateCorrectedFuelQuantity({ quantity: 1000, temperature: 35, expansionCoefficient: 0.00065, referenceTemp: 15 })).toBe(987);
  });

  it("يستخرج كمية الصرف من قراءة العداد ويرفض القراءة العكسية", () => {
    expect(calculateFuelIssueQuantity({ previousReading: 1250, currentReading: 1325.5 })).toBe(75.5);
    expect(() => calculateFuelIssueQuantity({ previousReading: 100, currentReading: 99 })).toThrow("الحالية");
  });

  it("يحسب الرصيد الدفتري ويصنف فرق الجرد", () => {
    expect(calculateFuelBalance({ openingBalance: 800, receipts: 1000, issues: 500, waste: 20 })).toBe(1280);
    expect(classifyFuelVariance(0)).toBe("balanced");
    expect(classifyFuelVariance(10)).toBe("surplus");
    expect(classifyFuelVariance(-10)).toBe("shortage");
  });

  it("يرفض حركات تتجاوز الرصيد أو سعة الخزان", () => {
    expect(() => assertFuelAvailable(81, 80, "الصرف")).toThrow("الرصيد المتاح");
    expect(() => assertFuelCapacity(950, 51, 1000)).toThrow("سعة الخزان");
  });
});

import { describe, expect, it } from "vitest";
import {
  YEMEN_UTILITY_BRACKETS,
  calculateAccountingDepreciation,
  calculateMeterConsumption,
  calculateOperationalDepreciation,
  calculateWholeCycleUtilityCost,
  deriveGeneratorKwh,
  recommendEnergySource,
} from "./costing";

describe("محرك تكلفة الطاقة", () => {
  it("يختار سعر 200 ريال لكامل دورة استهلاكها 10000 kWh", () => {
    expect(calculateWholeCycleUtilityCost(10000, YEMEN_UTILITY_BRACKETS)).toMatchObject({
      unitRate: 200,
      analyticalAmount: 2_000_000,
    });
  });

  it("يحسب معاينة فاتورة دورة فعلية باستهلاك 3727 kWh وفق شريحة 220 ريال", () => {
    expect(calculateWholeCycleUtilityCost(3727, YEMEN_UTILITY_BRACKETS)).toMatchObject({
      consumptionKwh: 3727,
      unitRate: 220,
      analyticalAmount: 819_940,
      bracket: { minKwh: 3000, maxKwh: 9999, unitRate: 220 },
    });
  });

  it("يثبت انحدار دورة الفاتورة المحفوظة 30001: 4500 kWh وشريحة 220 ومطابقة صفرية", () => {
    const officialAmount = 990_000;
    const calculation = calculateWholeCycleUtilityCost(4500, YEMEN_UTILITY_BRACKETS);
    expect(calculation).toMatchObject({ consumptionKwh: 4500, unitRate: 220, analyticalAmount: officialAmount });
    expect(officialAmount - calculation.analyticalAmount).toBe(0);
  });

  it("يحتسب استهلاك العداد مع معامل الضرب", () => {
    expect(calculateMeterConsumption(21281, 25008, 2)).toBe(7454);
  });

  it("يرفض عكس ترتيب قراءة العداد", () => {
    expect(() => calculateMeterConsumption(100, 99, 1)).toThrow("القراءة الحالية");
  });

  it("يحوّل kVA إلى kWh باستخدام عامل القدرة وساعات التشغيل", () => {
    expect(deriveGeneratorKwh({ measurementMode: "kva", averageKva: 100, powerFactor: 0.8, runtimeHours: 5 })).toBe(400);
  });

  it("يفصل الإهلاك المحاسبي عن التحليلي", () => {
    expect(calculateAccountingDepreciation({ acquisitionCost: 12_000_000, residualValue: 0, usefulLifeMonths: 120, monthsInCycle: 0.5 })).toBe(50_000);
    expect(calculateOperationalDepreciation({ acquisitionCost: 12_000_000, residualValue: 0, usefulLifeHours: 12000, runtimeHours: 50 })).toBe(50_000);
  });

  it("يوصي بالمولدات عندما تكون تكلفة الكيلوواط أقل من المؤسسة", () => {
    expect(recommendEnergySource({ utilityKwh: 4500, utilityAmount: 990000, generatorKwh: 3000, generatorAmount: 287000 })).toMatchObject({
      status: "recommended",
      recommendedSource: "المولدات",
      utilityCostPerKwh: 220,
      generatorCostPerKwh: 287000 / 3000,
      comparableKwh: 3000,
      potentialSavings: (220 - 287000 / 3000) * 3000,
    });
  });

  it("يوصي بالمؤسسة عندما تنخفض تكلفة الكيلوواط فيها", () => {
    expect(recommendEnergySource({ utilityKwh: 5000, utilityAmount: 900000, generatorKwh: 2000, generatorAmount: 500000 })).toMatchObject({
      status: "recommended",
      recommendedSource: "المؤسسة",
      savingPerKwh: 70,
      savingPercentage: 28,
      potentialSavings: 140000,
    });
  });

  it("لا يوصي بمصدر عند تعادل تكلفة الكيلوواط", () => {
    expect(recommendEnergySource({ utilityKwh: 1000, utilityAmount: 220000, generatorKwh: 500, generatorAmount: 110000 })).toMatchObject({
      status: "equal_cost",
      recommendedSource: null,
      potentialSavings: 0,
    });
  });

  it("يحجب التوصية عندما تغيب بيانات مصدر من مصدرَي الطاقة", () => {
    expect(recommendEnergySource({ utilityKwh: 1000, utilityAmount: 220000, generatorKwh: 0, generatorAmount: 0 })).toMatchObject({
      status: "insufficient_data",
      recommendedSource: null,
    });
  });
});

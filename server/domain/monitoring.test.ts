import { describe, expect, it } from "vitest";
import { assessFuelLevel, assessInventoryVariance, assessMaintenanceRuntime } from "./monitoring";

describe("منطق مركز التنبيهات", () => {
  it("يصنف انخفاض الوقود عند 15٪ ويحوله إلى حرج عند 7٪", () => {
    expect(assessFuelLevel(16, 100)).toBeNull();
    expect(assessFuelLevel(12, 100)).toEqual({ ratio: 0.12, severity: "warning" });
    expect(assessFuelLevel(7, 100)).toEqual({ ratio: 0.07, severity: "critical" });
  });

  it("يصنف فرق الجرد غير الصفري ويفرق بين التحذير والحرج", () => {
    expect(assessInventoryVariance(0)).toBeNull();
    expect(assessInventoryVariance(-12.5)).toBe("warning");
    expect(assessInventoryVariance(50)).toBe("critical");
  });

  it("ينبه للصيانة عند 90٪ من ساعات الخدمة ويصنف التجاوز حرجًا", () => {
    expect(assessMaintenanceRuntime(89, 100)).toBeNull();
    expect(assessMaintenanceRuntime(90, 100)).toBe("warning");
    expect(assessMaintenanceRuntime(100, 100)).toBe("critical");
  });
});

import { describe, expect, it } from "vitest";
import { demoScenarioChecks, demoScenarioDetails, demoScenarioMetrics, demoScenarioReportRows } from "./demo-scenario-report";

describe("demo scenario report", () => {
  it("contains the complete reviewable scenario summary", () => {
    expect(demoScenarioMetrics).toHaveLength(8);
    expect(demoScenarioMetrics.find(metric => metric.label === "فرق التسوية")?.value).toBe("70,000 ر.ي");
    expect(demoScenarioMetrics.find(metric => metric.label === "التوصية المختبرة")?.value).toBe("المولدات");
  });

  it("keeps detail rows aligned with the export contract", () => {
    const rows = demoScenarioReportRows();
    expect(rows).toHaveLength(demoScenarioDetails.length);
    expect(Object.keys(rows[0])).toEqual(["المجال", "الفترة", "استهلاك المؤسسة kWh", "التكلفة التحليلية ر.ي", "حالة الفاتورة"]);
    expect(rows[1]["حالة الفاتورة"]).toContain("70,000");
  });

  it("reports all validation checks as successful", () => {
    expect(demoScenarioChecks).toHaveLength(5);
    expect(demoScenarioChecks.every(check => check.result === "ناجح")).toBe(true);
  });
});

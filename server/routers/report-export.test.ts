import { describe, expect, it } from "vitest";
import writeExcelFile from "write-excel-file/node";
import { pdfReportLines, reportExcelHeaders, reportRowsForExport, reportSheetData, type ReportRow } from "../../client/src/pages/ReportsPage";

describe("تصدير تقرير توصية الطاقة", () => {
  it("يتضمن تكلفة الوحدة والتوصية والوفر المحتمل في صف Excel", () => {
    const row: ReportRow = {
      id: 3, title: "دورة النصف الأول — يناير 2026", cycleStatus: "approved", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-15"),
      utilityKwh: 4500, utilityAmount: 990000, generatorKwh: 3000, generatorAmount: 696750, costModel: "full", status: "recommended", recommendedSource: "المولدات",
      utilityCostPerKwh: 220, generatorCostPerKwh: 232.25, savingPerKwh: 12.25, savingPercentage: 5.57, comparableKwh: 3000, potentialSavings: 36750,
      explanation: "توصية اختبارية",
    };
    const [exported] = reportRowsForExport([row]);
    expect(exported["التوصية"]).toBe("يوصى بـ المولدات");
    expect(exported["فرق التكلفة لكل kWh ر.ي"]).toBe(12.25);
    expect(exported["نسبة الوفر"]).toBe("5.6%");
    expect(exported["الوفر المحتمل ر.ي"]).toBe(36750);
    expect(pdfReportLines(row)).toEqual({
      utility: "Utility: 4500.00 kWh | YER 990000.00",
      generators: "Generators: 3000.00 kWh | YER 696750.00",
      recommendation: "Recommendation: Generators",
    });
  });

  it("يولد مصنف XLSX صالحًا برؤوس عربية وصف توصية", async () => {
    const row: ReportRow = {
      id: 4, title: "دورة اختبار التصدير", cycleStatus: "approved", periodStart: new Date("2026-02-01"), periodEnd: new Date("2026-02-15"),
      utilityKwh: 2000, utilityAmount: 460000, generatorKwh: 1600, generatorAmount: 320000, costModel: "cash", status: "recommended", recommendedSource: "المولدات",
      utilityCostPerKwh: 230, generatorCostPerKwh: 200, savingPerKwh: 30, savingPercentage: 13.04, comparableKwh: 1600, potentialSavings: 48000,
      explanation: "سجل اختبار ملف XLSX",
    };
    const sheetData = reportSheetData([row]);
    expect(sheetData[0].map(cell => cell.value)).toEqual(reportExcelHeaders);
    expect(sheetData[1][11].value).toBe("يوصى بـ المولدات");
    const buffer = await writeExcelFile(sheetData).toBuffer();
    expect(Buffer.from(buffer).subarray(0, 2).toString()).toBe("PK");
  });
});

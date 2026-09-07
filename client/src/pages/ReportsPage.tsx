import { EmptyState, PageTitle, dateLabel, money, quantity } from "@/components/EnergyUi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Download, FileSpreadsheet, Info, Zap } from "lucide-react";
import { exportDashboardPdf } from "@/lib/dashboard-export";
import writeExcelFile from "write-excel-file/browser";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type ReportRow = {
  id: number;
  title: string;
  cycleStatus: string;
  periodStart: Date;
  periodEnd: Date;
  utilityKwh: number;
  utilityAmount: number;
  generatorKwh: number;
  generatorAmount: number;
  costModel: "cash" | "full";
  status: "recommended" | "equal_cost" | "insufficient_data";
  recommendedSource: "المؤسسة" | "المولدات" | null;
  utilityCostPerKwh: number | null;
  generatorCostPerKwh: number | null;
  savingPerKwh: number | null;
  savingPercentage: number | null;
  comparableKwh: number | null;
  potentialSavings: number | null;
  explanation: string;
};

const numberOrDash = (value: number | null, formatter: (numberValue: number) => string) => value === null ? "—" : formatter(value);
const decisionLabel = (row: ReportRow) => row.status === "recommended" ? `يوصى بـ ${row.recommendedSource}` : row.status === "equal_cost" ? "تكلفة متعادلة" : "بيانات غير مكتملة";
const decisionClass = (row: ReportRow) => row.status === "recommended" ? "bg-teal-50 text-teal-800 ring-teal-100" : row.status === "equal_cost" ? "bg-amber-50 text-amber-800 ring-amber-100" : "bg-slate-100 text-slate-600 ring-slate-200";

export const reportExcelHeaders = [
  "الدورة", "حالة الدورة", "بداية الفترة", "نهاية الفترة", "طاقة المؤسسة kWh", "تكلفة المؤسسة ر.ي", "طاقة المولدات kWh", "تكلفة المولدات حسب نموذج الدورة ر.ي", "نموذج تكلفة المولدات", "تكلفة المؤسسة لكل kWh ر.ي", "تكلفة المولدات لكل kWh ر.ي", "التوصية", "فرق التكلفة لكل kWh ر.ي", "نسبة الوفر", "الطاقة القابلة للمقارنة kWh", "الوفر المحتمل ر.ي", "سبب التوصية",
] as const;

export function reportRowsForExport(rows: ReportRow[]) {
  return rows.map(row => ({
    "الدورة": row.title,
    "حالة الدورة": row.cycleStatus,
    "بداية الفترة": dateLabel(row.periodStart),
    "نهاية الفترة": dateLabel(row.periodEnd),
    "طاقة المؤسسة kWh": row.utilityKwh,
    "تكلفة المؤسسة ر.ي": row.utilityAmount,
    "طاقة المولدات kWh": row.generatorKwh,
    "تكلفة المولدات حسب نموذج الدورة ر.ي": row.generatorAmount,
    "نموذج تكلفة المولدات": row.costModel === "full" ? "كامل" : "نقدي",
    "تكلفة المؤسسة لكل kWh ر.ي": row.utilityCostPerKwh,
    "تكلفة المولدات لكل kWh ر.ي": row.generatorCostPerKwh,
    "التوصية": decisionLabel(row),
    "فرق التكلفة لكل kWh ر.ي": row.savingPerKwh,
    "نسبة الوفر": row.savingPercentage === null ? null : `${row.savingPercentage.toFixed(1)}%`,
    "الطاقة القابلة للمقارنة kWh": row.comparableKwh,
    "الوفر المحتمل ر.ي": row.potentialSavings,
    "سبب التوصية": row.explanation,
  }));
}

export function reportSheetData(rows: ReportRow[]) {
  const exportedRows = reportRowsForExport(rows);
  return [
    reportExcelHeaders.map(value => ({ value, fontWeight: "bold" as const, backgroundColor: "#0f766e", textColor: "#ffffff", align: "right" as const, wrap: true })),
    ...exportedRows.map(row => reportExcelHeaders.map(header => ({ value: row[header] ?? "", align: "right" as const, wrap: true }))),
  ];
}

export function pdfReportLines(row: ReportRow) {
  const recommendation = row.recommendedSource === "المؤسسة" ? "Utility" : row.recommendedSource === "المولدات" ? "Generators" : row.status === "equal_cost" ? "Equal cost" : "Incomplete data";
  return {
    utility: `Utility: ${row.utilityKwh.toFixed(2)} kWh | YER ${row.utilityAmount.toFixed(2)}`,
    generators: `Generators: ${row.generatorKwh.toFixed(2)} kWh | YER ${row.generatorAmount.toFixed(2)}`,
    recommendation: `Recommendation: ${recommendation}`,
  };
}

export default function ReportsPage() {
  const reports = trpc.energy.reports.useQuery();
  const [selectedCycle, setSelectedCycle] = useState("all");
  const allRows = (reports.data ?? []) as ReportRow[];
  const rows = useMemo(() => selectedCycle === "all" ? allRows : allRows.filter(row => String(row.id) === selectedCycle), [allRows, selectedCycle]);
  const title = selectedCycle === "all" ? "التقرير الشهري التجميعي" : `تقرير الدورة: ${rows[0]?.title ?? ""}`;
  const summary = useMemo(() => ({
    utilityCount: rows.filter(row => row.recommendedSource === "المؤسسة").length,
    generatorCount: rows.filter(row => row.recommendedSource === "المولدات").length,
    incompleteCount: rows.filter(row => row.status === "insufficient_data").length,
    potentialSavings: rows.reduce((sum, row) => sum + (row.potentialSavings ?? 0), 0),
  }), [rows]);

  const exportXlsx = async () => {
    if (!rows.length) return toast.error("لا توجد بيانات لتصديرها.");
    try {
      await writeExcelFile(reportSheetData(rows), {
        sheet: "تقرير الطاقة",
        columns: reportExcelHeaders.map((_, index) => ({ width: index === 0 || index === 16 ? 30 : 18 })),
        rightToLeft: true,
        stickyRowsCount: 1,
        showGridLines: false,
      }, { fontFamily: "Arial", fontSize: 11 }).toFile(selectedCycle === "all" ? "monthly-energy-report.xlsx" : "billing-cycle-report.xlsx");
      toast.success("تم تجهيز ملف Excel للتنزيل.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء ملف Excel.");
    }
  };

  const exportPdf = async () => {
    if (!rows.length) return toast.error("لا توجد بيانات لتصديرها.");
    try {
      const metrics = [
        { label: "نطاق التقرير", value: title, note: "تقرير مستخرج من السجلات الفعلية" },
        { label: "عدد الدورات", value: String(rows.length), note: "الدورات الداخلة في المقارنة" },
        { label: "توصيات المؤسسة", value: String(summary.utilityCount), note: "دورات كانت فيها المؤسسة أقل تكلفة" },
        { label: "توصيات المولدات", value: String(summary.generatorCount), note: "دورات كانت فيها المولدات أقل تكلفة" },
        { label: "الوفر المحتمل", value: money(summary.potentialSavings), note: "ضمن كميات الطاقة القابلة للمقارنة" },
      ];
      const details = rows.map(row => ({
        "الدورة": row.title,
        "الفترة": `${dateLabel(row.periodStart)} — ${dateLabel(row.periodEnd)}`,
        "طاقة المؤسسة kWh": quantity(row.utilityKwh),
        "تكلفة المؤسسة ر.ي": money(row.utilityAmount),
        "تكلفة المولدات ر.ي": money(row.generatorAmount),
        "التوصية": decisionLabel(row),
        "الوفر المحتمل ر.ي": row.potentialSavings === null ? "—" : money(row.potentialSavings),
      }));
      await exportDashboardPdf({ title: "تقرير توصية تكلفة الطاقة", fileName: selectedCycle === "all" ? "monthly-energy-report.pdf" : "billing-cycle-report.pdf", metrics, details });
      toast.success("تم تجهيز ملف PDF العربي للتنزيل.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء ملف PDF.");
    }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <PageTitle eyebrow="المخرجات والتتبع" title="تقارير الدورة والشهر" description="تُستخرج التقارير من السجلات الفعلية، وتعرض مقارنة عادلة على مستوى تكلفة الكيلوواط مع توصية تشغيلية قابلة للتتبع." action={<div className="no-print flex flex-wrap gap-2"><Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="ml-2 h-4 w-4" />تصدير Excel</Button><Button className="bg-teal-700 hover:bg-teal-800" onClick={() => void exportPdf()}><Download className="ml-2 h-4 w-4" />تصدير PDF</Button></div>} />
    <Card className="border-0 shadow-sm"><CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center"><div className="flex-1"><p className="font-bold">نطاق التقرير</p><p className="mt-1 text-sm text-slate-500">اختر دورة محددة لتقرير نصف شهري أو اتركه على التقرير التجميعي.</p></div><Select value={selectedCycle} onValueChange={setSelectedCycle}><SelectTrigger className="w-full bg-white md:w-80"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">التقرير الشهري التجميعي</SelectItem>{allRows.map(row => <SelectItem key={row.id} value={String(row.id)}>{row.title}</SelectItem>)}</SelectContent></Select></CardContent></Card>
    <Card className="border-0 shadow-sm"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{reports.isLoading ? <p className="py-12 text-center text-sm text-slate-500">جارٍ تجهيز بيانات المقارنة…</p> : !rows.length ? <EmptyState title="لا توجد بيانات تقريرية" description="عند تسجيل الدورات والفواتير والتشغيل ستظهر هنا تفاصيل التقرير ونقاط المقارنة." /> : <><div className="space-y-3 md:hidden">{rows.map(row => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{row.title}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(row.periodStart)} — {dateLabel(row.periodEnd)}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${decisionClass(row)}`}>{decisionLabel(row)}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">المؤسسة / kWh</p><p className="metric-value mt-1 font-bold">{numberOrDash(row.utilityCostPerKwh, money)}</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-800">المولدات / kWh</p><p className="metric-value mt-1 font-bold">{numberOrDash(row.generatorCostPerKwh, money)}</p></div></div><p className="mt-3 text-sm text-slate-600">الوفر المحتمل: <strong className="text-teal-800">{numberOrDash(row.potentialSavings, money)}</strong></p><p className="mt-2 text-xs leading-5 text-slate-500">{row.explanation}</p></div>)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1280px] text-right text-sm"><thead className="border-b text-xs text-slate-500"><tr><th className="pb-3">الدورة</th><th className="pb-3">الفترة</th><th className="pb-3">المؤسسة / kWh</th><th className="pb-3">المولدات / kWh</th><th className="pb-3">فرق الكلفة</th><th className="pb-3">التوصية</th><th className="pb-3">الوفر المحتمل</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-slate-100 align-top"><td className="py-4 font-bold">{row.title}<p className="mt-1 text-xs font-normal text-slate-500">نموذج المولدات: {row.costModel === "full" ? "كامل" : "نقدي"}</p></td><td className="py-4 text-slate-500">{dateLabel(row.periodStart)} — {dateLabel(row.periodEnd)}</td><td className="py-4"><p className="font-medium">{numberOrDash(row.utilityCostPerKwh, money)}</p><p className="mt-1 text-xs text-slate-500">{quantity(row.utilityKwh)} · {money(row.utilityAmount)}</p></td><td className="py-4"><p className="font-medium">{numberOrDash(row.generatorCostPerKwh, money)}</p><p className="mt-1 text-xs text-slate-500">{quantity(row.generatorKwh)} · {money(row.generatorAmount)}</p></td><td className="py-4"><p className="font-medium">{numberOrDash(row.savingPerKwh, money)}</p><p className="mt-1 text-xs text-slate-500">{row.savingPercentage === null ? "—" : `${row.savingPercentage.toFixed(1)}٪ أقل`}</p></td><td className="py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${decisionClass(row)}`}>{decisionLabel(row)}</span><p className="mt-2 max-w-72 text-xs leading-5 text-slate-500">{row.explanation}</p></td><td className="py-4 font-bold text-teal-800">{numberOrDash(row.potentialSavings, money)}<p className="mt-1 text-xs font-normal text-slate-500">ضمن {numberOrDash(row.comparableKwh, quantity)}</p></td></tr>)}</tbody></table></div></>}</CardContent></Card>
    {rows.length > 0 && <Card className="border border-teal-100 bg-gradient-to-l from-teal-50 to-white shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-teal-950"><Zap className="h-5 w-5 text-teal-700" />قرار الاستخدام حسب التكلفة</CardTitle></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-4"><div className="rounded-2xl bg-white/80 p-4"><p className="text-xs text-slate-500">توصيات المؤسسة</p><p className="metric-value mt-2 text-2xl font-bold text-teal-800">{summary.utilityCount}</p><p className="mt-1 text-xs text-slate-500">دورات أقل تكلفة</p></div><div className="rounded-2xl bg-white/80 p-4"><p className="text-xs text-slate-500">توصيات المولدات</p><p className="metric-value mt-2 text-2xl font-bold text-teal-800">{summary.generatorCount}</p><p className="mt-1 text-xs text-slate-500">دورات أقل تكلفة</p></div><div className="rounded-2xl bg-white/80 p-4"><p className="text-xs text-slate-500">بيانات غير مكتملة</p><p className="metric-value mt-2 text-2xl font-bold text-slate-700">{summary.incompleteCount}</p><p className="mt-1 text-xs text-slate-500">لا قرار تلقائي لها</p></div><div className="rounded-2xl bg-teal-700 p-4 text-white"><p className="text-xs text-teal-100">إجمالي الوفر المحتمل</p><p className="metric-value mt-2 text-2xl font-bold">{money(summary.potentialSavings)}</p><p className="mt-1 text-xs text-teal-100">ضمن كميات الطاقة القابلة للمقارنة</p></div></div><div className="mt-5 flex gap-3 rounded-2xl border border-teal-100 bg-white/70 p-4 text-sm leading-6 text-slate-600"><Info className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" /><p>تصدر التوصية من مقارنة <strong>تكلفة الكيلوواط</strong> لكل مصدر، وليس من مقارنة إجمالي فواتير ذات كميات طاقة مختلفة. تبقى الاعتمادية، القدرة المتاحة، والانقطاعات معايير تشغيلية يجب مراجعتها قبل تنفيذ القرار.</p></div></CardContent></Card>}
    <Card className="border-0 shadow-sm"><CardContent className="flex gap-4 p-5"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-teal-700" /><p className="text-sm leading-6 text-slate-600">يتضمن ملف Excel بيانات الدورة والتكلفة الموحدة والتوصية وسببها، بينما يتضمن ملف PDF ملخصًا قابلاً للأرشفة. تُحتسب تكلفة المولدات وفق نموذج التكلفة المحدد في كل دورة: نقدي أو كامل.</p></CardContent></Card>
  </div>;
}

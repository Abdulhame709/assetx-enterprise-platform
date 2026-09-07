import { PageTitle } from "@/components/EnergyUi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportDashboardExcel, exportDashboardPdf } from "@/lib/dashboard-export";
import { demoScenarioChecks, demoScenarioDetails, demoScenarioMetrics, demoScenarioReportRows, demoScenarioReportTitle } from "@/lib/demo-scenario-report";
import { CheckCircle2, Download, FileSpreadsheet, FlaskConical, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function DemoScenarioReportPage() {
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const exportFile = async (format: "pdf" | "excel") => {
    setExporting(format);
    try {
      const details = demoScenarioReportRows();
      if (format === "excel") {
        await exportDashboardExcel({ title: demoScenarioReportTitle, sheet: "سيناريو التجربة", fileName: "demo-scenario-report.xlsx", metrics: demoScenarioMetrics, details });
        toast.success("تم تجهيز تقرير سيناريو التجربة بصيغة Excel.");
      } else {
        await exportDashboardPdf({ title: demoScenarioReportTitle, fileName: "demo-scenario-report.pdf", metrics: demoScenarioMetrics, details });
        toast.success("تم تجهيز تقرير سيناريو التجربة بصيغة PDF.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء ملف التقرير.");
    } finally {
      setExporting(null);
    }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <PageTitle
      eyebrow="التجربة والتحقق"
      title={demoScenarioReportTitle}
      description="ملخص قابل للمراجعة والمشاركة لبيانات الاختبار المعزولة ونتائج التعرفة والمقارنة والتنبيهات."
      action={<div className="no-print flex flex-wrap gap-2">
        <Button variant="outline" disabled={Boolean(exporting)} onClick={() => void exportFile("excel")}><FileSpreadsheet className="ml-2 h-4 w-4" />{exporting === "excel" ? "جارٍ تجهيز Excel…" : "تصدير Excel"}</Button>
        <Button className="bg-teal-700 hover:bg-teal-800" disabled={Boolean(exporting)} onClick={() => void exportFile("pdf")}><Download className="ml-2 h-4 w-4" />{exporting === "pdf" ? "جارٍ تجهيز PDF…" : "تصدير PDF"}</Button>
      </div>}
    />

    <Card className="border border-amber-200 bg-amber-50/70 shadow-sm">
      <CardContent className="flex gap-3 p-5 text-sm leading-6 text-amber-950"><FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><p><strong>تنبيه المراجعة:</strong> هذه النتائج تخص بيانات تجريبية معزولة تحت الرمز <bdi>DEMO-QA-SAN-26</bdi>، ولا تمثل قياسات تشغيلية أو توصية مالية فعلية.</p></CardContent>
    </Card>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {demoScenarioMetrics.map(metric => <Card key={metric.label} className="border-0 shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">{metric.label}</p><p className="metric-value mt-2 text-2xl font-bold text-slate-950">{metric.value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{metric.note}</p></CardContent></Card>)}
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
      <Card className="border-0 shadow-sm"><CardHeader><CardTitle>تفاصيل السيناريو</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="border-b text-xs text-slate-500"><tr><th className="pb-3">المجال</th><th className="pb-3">الفترة</th><th className="pb-3">استهلاك المؤسسة kWh</th><th className="pb-3">التكلفة التحليلية ر.ي</th><th className="pb-3">الحالة</th></tr></thead><tbody>{demoScenarioDetails.map(row => <tr key={`${row.المجال}-${row.الفترة}`} className="border-b border-slate-100"><td className="py-4 font-bold">{row.المجال}</td><td className="py-4 text-slate-500">{row.الفترة}</td><td className="py-4 font-medium">{row["استهلاك المؤسسة kWh"]?.toLocaleString("ar-YE")}</td><td className="py-4 font-medium">{row["التكلفة التحليلية ر.ي"]?.toLocaleString("ar-YE")} ر.ي</td><td className="py-4 text-slate-600">{row["حالة الفاتورة"]}</td></tr>)}</tbody></table></div></CardContent></Card>
      <Card className="border-0 shadow-sm"><CardHeader><CardTitle>نتائج التحقق</CardTitle></CardHeader><CardContent className="space-y-3">{demoScenarioChecks.map(check => <div key={check.label} className="flex items-center justify-between gap-3 rounded-xl bg-teal-50 p-3 text-sm"><span>{check.label}</span><span className="inline-flex items-center gap-1 font-bold text-teal-800"><CheckCircle2 className="h-4 w-4" />{check.result}</span></div>)}<div className="mt-4 flex gap-2 rounded-xl border border-slate-200 p-3 text-xs leading-5 text-slate-500"><Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><p>يتضمن ملف Excel المؤشرات والتفاصيل، بينما يعرض PDF ملخصًا منسقًا للقراءة والأرشفة.</p></div></CardContent></Card>
    </div>
  </div>;
}

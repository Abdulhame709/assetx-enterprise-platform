import { EmptyState, MetricCard, PageTitle, money, quantity } from "@/components/EnergyUi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { exportDashboardExcel, exportDashboardPdf } from "@/lib/dashboard-export";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeftRight, Bolt, Building2, Download, FileSpreadsheet, TrendingDown, Zap } from "lucide-react";
import { toast } from "sonner";

function CostTrend({ items }: { items: { label: string; المؤسسة: number; المولدات: number }[] }) {
  const peak = Math.max(...items.flatMap(item => [item.المؤسسة, item.المولدات]), 1);
  return (
    <div className="flex h-full items-end gap-3 overflow-x-auto pb-6 pt-6">
      {items.map(item => (
        <div className="flex min-w-20 flex-1 flex-col items-center gap-2" key={item.label}>
          <div className="flex h-52 w-full items-end justify-center gap-1.5 rounded-t-xl bg-slate-50 px-2 pt-3">
            <div className="w-4 rounded-t-md bg-teal-700 transition-all" style={{ height: `${Math.max((item.المؤسسة / peak) * 100, 2)}%` }} title={`المؤسسة: ${money(item.المؤسسة)}`} />
            <div className="w-4 rounded-t-md bg-amber-400 transition-all" style={{ height: `${Math.max((item.المولدات / peak) * 100, 2)}%` }} title={`المولدات: ${money(item.المولدات)}`} />
          </div>
          <bdi className="max-w-20 truncate text-center text-xs text-slate-500">{item.label}</bdi>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const dashboard = trpc.energy.dashboard.useQuery();
  const data = dashboard.data;
  const summary = data?.summary;
  const hasData = Boolean(data?.cycles.length);
  const exportMetrics = [
    { label: "طاقة المؤسسة", value: quantity(summary?.utilityKwh), note: "فرق القراءات × معامل العداد" },
    { label: "تكلفة المؤسسة الرسمية", value: money(summary?.utilityAmount), note: "مصدر الحقيقة المالية" },
    { label: "طاقة المولدات", value: quantity(summary?.generatorKwh), note: "تشغيل متتابع داخل الدورة" },
    { label: "فرق التكلفة", value: money(summary?.savings), note: summary?.cheaperSource ? `الأقل تكلفة: ${summary.cheaperSource}` : "يتطلب بيانات مكتملة" },
  ];
  const exportDetails = (data?.trends ?? []).map(item => ({ "الدورة": item.label, "تكلفة المؤسسة ر.ي": item.المؤسسة, "تكلفة المولدات ر.ي": item.المولدات }));
  const exportXlsx = async () => { try { await exportDashboardExcel({ title: "ملخص لوحة تكلفة الطاقة", sheet: "لوحة الطاقة", fileName: "energy-dashboard-summary.xlsx", metrics: exportMetrics, details: exportDetails }); toast.success("تم تجهيز ملخص الطاقة بصيغة Excel."); } catch { toast.error("تعذر إنشاء ملف Excel للوحة الطاقة."); } };
  const exportPdf = async () => { try { await exportDashboardPdf({ title: "ملخص لوحة تكلفة الطاقة", fileName: "energy-dashboard-summary.pdf", metrics: exportMetrics, details: exportDetails }); toast.success("تم تجهيز ملخص الطاقة بصيغة PDF."); } catch (error) { console.error("Energy dashboard PDF export failed", error); toast.error("تعذر إنشاء ملف PDF للوحة الطاقة."); } };

  return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageTitle
          eyebrow="مركز القرار"
          title="صورة تكلفة الطاقة"
          description="مقارنة موثقة بين فاتورة المؤسسة الرسمية وتكلفة تشغيل المولدات ضمن دورات نصف شهرية قابلة للتتبع."
          action={<div className="no-print flex flex-wrap gap-2"><Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="ml-2 h-4 w-4" />Excel</Button><Button className="bg-teal-700 hover:bg-teal-800" onClick={exportPdf}><Download className="ml-2 h-4 w-4" />PDF</Button></div>}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="طاقة المؤسسة" value={quantity(summary?.utilityKwh)} note="فرق القراءات × معامل العداد" icon={<Building2 className="h-4 w-4" />} />
          <MetricCard label="تكلفة المؤسسة الرسمية" value={money(summary?.utilityAmount)} note="مصدر الحقيقة المالية" icon={<Bolt className="h-4 w-4" />} tone="slate" />
          <MetricCard label="طاقة المولدات" value={quantity(summary?.generatorKwh)} note="تشغيل متتابع داخل الدورة" icon={<Zap className="h-4 w-4" />} tone="amber" />
          <MetricCard label="فرق التكلفة" value={money(summary?.savings)} note={summary?.cheaperSource ? `الأقل تكلفة: ${summary.cheaperSource}` : "يتطلب بيانات مكتملة"} icon={<TrendingDown className="h-4 w-4" />} tone={summary?.savings && summary.savings < 0 ? "rose" : "teal"} />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.45fr_.85fr]">
          <Card className="energy-panel">
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle className="text-lg">اتجاه التكلفة عبر الدورات</CardTitle><p className="mt-1 text-sm text-slate-500">الأعمدة الخضراء للمؤسسة والذهبية للمولدات.</p></div>
              <Activity className="h-5 w-5 text-teal-700" />
            </CardHeader>
            <CardContent className="h-[315px]">
              {hasData ? <CostTrend items={data?.trends ?? []} /> : <EmptyState title="لا توجد دورة محسوبة بعد" description="أنشئ دورة فوترة ثم أضف قراءة العداد والفاتورة الرسمية وبيانات تشغيل المولدات لتظهر التحليلات." />}
            </CardContent>
          </Card>
          <Card className="energy-panel">
            <CardHeader><CardTitle className="text-lg">مؤشرات تكلفة الوحدة</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl bg-teal-50 p-5 dark:bg-teal-950/45"><p className="text-sm text-teal-800 dark:text-teal-200">تكلفة المؤسسة لكل kWh</p><p className="metric-value mt-2 text-2xl font-bold text-teal-950 dark:text-teal-100">{money(summary?.utilityRate)}</p></div>
              <div className="rounded-2xl bg-amber-50 p-5 dark:bg-amber-950/35"><p className="text-sm text-amber-800 dark:text-amber-200">تكلفة المولدات لكل kWh</p><p className="metric-value mt-2 text-2xl font-bold text-amber-950 dark:text-amber-100">{money(summary?.generatorRate)}</p></div>
              <div className="energy-subdivider flex items-center gap-3 pt-5 text-sm text-slate-600"><ArrowLeftRight className="h-4 w-4 text-slate-400" />المقارنة موحدة للوحدة والفترة نفسها فقط.</div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}

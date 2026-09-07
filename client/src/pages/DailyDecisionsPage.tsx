import { EmptyState, MetricCard, PageTitle, money } from "@/components/EnergyUi";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { exportDashboardExcel, exportDashboardPdf } from "@/lib/dashboard-export";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, Building2, CircleDollarSign, DatabaseZap, Download, FileSpreadsheet, Sparkles, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function DailyDecisionsPage() {
  const [siteId, setSiteId] = useState("all");
  const decisionInput = useMemo(() => siteId === "all" ? undefined : { siteId: Number(siteId) }, [siteId]);
  const sitesQuery = trpc.sites.accessible.useQuery();
  const decisions = trpc.monitoring.decisions.useQuery(decisionInput);
  const rows = decisions.data ?? [];
  const recommended = rows.filter(row => row.status === "recommended");
  const totalSavings = recommended.reduce((sum, row) => sum + (row.potentialSavings ?? 0), 0);
  const exportMetrics = [
    { label: "مواقع ذات توصية", value: String(recommended.length), note: "اكتملت بيانات المصدرين في الدورة" },
    { label: "إجمالي الوفر المتوقع", value: money(totalSavings), note: "محسوب على كمية الطاقة المشتركة" },
    { label: "مواقع تحتاج بيانات", value: String(rows.filter(row => row.status === "insufficient_data").length), note: "لا تصدر توصية تلقائية" },
  ];
  const exportDetails = rows.map(row => ({
    "الموقع": row.site?.name ?? "موقع غير محدد",
    "الدورة": row.cycle.title,
    "التوصية": row.status === "recommended" ? (row.recommendedSource ?? "—") : row.status === "equal_cost" ? "تكلفة متقاربة" : "بيانات غير مكتملة",
    "تكلفة المؤسسة لكل kWh": money(row.utilityCostPerKwh),
    "تكلفة المولدات لكل kWh": money(row.generatorCostPerKwh),
    "الوفر المتوقع ر.ي": row.potentialSavings ?? 0,
    "نطاق المقارنة kWh": Math.max(0, row.comparisonKwh),
    "جاهزية البيانات": `${row.readiness.completedItems}/${row.readiness.totalItems}`,
  }));
  const exportXlsx = async () => { try { await exportDashboardExcel({ title: "لوحة القرارات اليومية والوفر المتوقع", sheet: "قرارات يومية", fileName: "daily-decisions-summary.xlsx", metrics: exportMetrics, details: exportDetails }); toast.success("تم تجهيز لوحة القرارات بصيغة Excel."); } catch { toast.error("تعذر إنشاء ملف Excel للقرارات اليومية."); } };
  const exportPdf = async () => { try { await exportDashboardPdf({ title: "لوحة القرارات اليومية والوفر المتوقع", fileName: "daily-decisions-summary.pdf", metrics: exportMetrics, details: exportDetails }); toast.success("تم تجهيز لوحة القرارات بصيغة PDF."); } catch (error) { console.error("Daily decisions PDF export failed", error); toast.error("تعذر إنشاء ملف PDF للقرارات اليومية."); } };
  return <div className="mx-auto max-w-7xl space-y-6">
    <PageTitle eyebrow="قرار تشغيلي" title="لوحة القرارات اليومية" description="توصية قابلة للتتبع لكل موقع من آخر دورة متاحة، تعتمد مقارنة تكلفة kWh الموحدة فقط عند اكتمال بيانات المصدرين." action={<div className="no-print flex flex-wrap gap-2"><Select value={siteId} onValueChange={setSiteId}><SelectTrigger className="min-w-52 bg-white dark:bg-slate-900"><SelectValue placeholder="كل المواقع" /></SelectTrigger><SelectContent><SelectItem value="all">كل المواقع المصرح بها</SelectItem>{sitesQuery.data?.map(site => <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={decisions.isLoading} onClick={exportXlsx}><FileSpreadsheet className="ml-2 h-4 w-4" />Excel</Button><Button className="bg-teal-700 hover:bg-teal-800" disabled={decisions.isLoading} onClick={exportPdf}><Download className="ml-2 h-4 w-4" />PDF</Button></div>} />
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard label="مواقع ذات توصية" value={String(recommended.length)} note="لديها بيانات طاقة وتكلفة مكتملة" icon={<Sparkles className="h-4 w-4" />} tone="teal" />
      <MetricCard label="وفر متوقع قابل للمقارنة" value={money(totalSavings)} note="محسوب على أقل كمية طاقة مشتركة" icon={<CircleDollarSign className="h-4 w-4" />} tone="amber" />
      <MetricCard label="مواقع تحتاج بيانات" value={String(rows.filter(row => row.status === "insufficient_data").length)} note="لا تصدر لها توصية تلقائية" icon={<ArrowLeftRight className="h-4 w-4" />} tone="slate" />
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      {decisions.isLoading ? <><div className="loading-surface h-64 rounded-3xl" /><div className="loading-surface h-64 rounded-3xl" /></> : rows.length ? rows.map(row => { const readinessPercent = Math.round((row.readiness.completedItems / row.readiness.totalItems) * 100); return <Card key={row.cycle.id} className="energy-panel overflow-hidden"><CardHeader className="border-b border-slate-100 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-teal-700 dark:text-teal-300">{row.site?.code}</p><CardTitle className="mt-1 text-lg">{row.site?.name ?? "موقع غير محدد"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{row.cycle.title}</p></div><Badge className={row.status === "recommended" ? "bg-teal-700" : "bg-slate-600"}>{row.status === "recommended" ? `يوصى بـ ${row.recommendedSource}` : row.status === "equal_cost" ? "تكلفة متقاربة" : "بيانات غير مكتملة"}</Badge></div></CardHeader><CardContent className="space-y-5 pt-5"><p className="min-h-14 text-sm leading-7 text-slate-600 dark:text-slate-300">{row.explanation}</p><div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-semibold"><DatabaseZap className="h-4 w-4 text-sky-600" />جاهزية بيانات القرار</span><strong>{row.readiness.completedItems}/{row.readiness.totalItems}</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${readinessPercent}%` }} /></div>{row.readiness.missingItems.length ? <p className="mt-3 text-xs leading-5 text-muted-foreground">البيانات المطلوبة: {row.readiness.missingItems.join("، ")}</p> : <p className="mt-3 text-xs text-teal-700 dark:text-teal-300">البيانات مكتملة ويمكن الاعتماد على المقارنة.</p>}</div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-teal-50 p-4 dark:bg-teal-950/35"><p className="flex items-center gap-2 text-xs text-teal-800 dark:text-teal-200"><Building2 className="h-4 w-4" />تكلفة المؤسسة لكل kWh</p><p className="mt-2 text-xl font-black text-teal-950 dark:text-teal-100">{money(row.utilityCostPerKwh)}</p></div><div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/30"><p className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200"><Zap className="h-4 w-4" />تكلفة المولدات لكل kWh</p><p className="mt-2 text-xl font-black text-amber-950 dark:text-amber-100">{money(row.generatorCostPerKwh)}</p></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><span className="text-sm text-muted-foreground">الوفر المتوقع للدورة</span><strong className="text-lg text-teal-700 dark:text-teal-300">{money(row.potentialSavings)}</strong></div><div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><span className="text-sm text-muted-foreground">نطاق المقارنة</span><strong className="text-lg">{Math.max(0, row.comparisonKwh).toLocaleString("ar-YE")} kWh</strong></div></div></CardContent></Card>; }) : <div className="xl:col-span-2"><EmptyState title="لا توجد قرارات مكتملة بعد" description="أدخل قراءة المؤسسة وفاتورتها وتشغيل المولدات ووقودها لنفس دورة الموقع كي تصدر التوصية والوفر المتوقع." /></div>}
    </div>
  </div>;
}

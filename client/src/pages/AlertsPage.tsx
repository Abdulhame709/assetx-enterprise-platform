import { EmptyState, MetricCard, PageTitle } from "@/components/EnergyUi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BellRing, CheckCircle2, CircleAlert, Clock3, Droplets, Gauge, ShieldCheck, UserRoundCheck, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const typeMeta = {
  fuel: { label: "وقود", icon: Droplets },
  inventory: { label: "جرد", icon: Gauge },
  maintenance: { label: "صيانة", icon: Wrench },
  cost: { label: "تكلفة", icon: CircleAlert },
};

const severityClass = { critical: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200", warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-200", info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/35 dark:text-sky-200" } as const;
const statusLabel = { open: "مفتوح", acknowledged: "قيد المتابعة", resolved: "تم الحل" } as const;
const actionLabel = { acknowledged: "تم تأكيد المتابعة", resolved: "تم الحل", reopened: "أُعيد فتح التنبيه", assigned: "تم تعيين مسؤول" } as const;

export default function AlertsPage() {
  const utils = trpc.useUtils();
  const sitesQuery = trpc.sites.accessible.useQuery();
  const [siteId, setSiteId] = useState("all");
  const [type, setType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("open");
  const [activeAlertKey, setActiveAlertKey] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const filters = useMemo(() => ({
    siteId: siteId === "all" ? undefined : Number(siteId),
    type: type === "all" ? undefined : type as "fuel" | "inventory" | "maintenance" | "cost",
    severity: severity === "all" ? undefined : severity as "critical" | "warning" | "info",
    status: status === "all" ? undefined : status as "open" | "acknowledged" | "resolved",
  }), [siteId, type, severity, status]);
  const alertsQuery = trpc.monitoring.alerts.list.useQuery(filters);
  const activeAlert = alertsQuery.data?.alerts.find(alert => alert.key === activeAlertKey);
  const assigneesQuery = trpc.monitoring.alerts.assignees.useQuery({ siteId: activeAlert?.siteId ?? 1 }, { enabled: Boolean(activeAlert?.siteId) });
  const resolve = trpc.monitoring.alerts.resolve.useMutation({
    onSuccess: async () => { await utils.monitoring.alerts.list.invalidate(); await utils.monitoring.activity.list.invalidate(); setActiveAlertKey(null); setNote(""); toast.success("تم تحديث حالة التنبيه."); },
    onError: () => toast.error("تعذر تحديث حالة التنبيه."),
  });
  const assign = trpc.monitoring.alerts.assign.useMutation({
    onSuccess: async () => { await utils.monitoring.alerts.list.invalidate(); await utils.monitoring.activity.list.invalidate(); toast.success("تم تعيين المسؤول وموعد الاستجابة."); },
    onError: error => toast.error(error.message || "تعذر تعيين المسؤول."),
  });
  const data = alertsQuery.data;
  const resetFilters = () => { setSiteId("all"); setType("all"); setSeverity("all"); setStatus("open"); };
  const submitAction = (alertKey: string, alertSiteId: number | null, nextStatus: "acknowledged" | "resolved" | "reopened") => {
    resolve.mutate({ alertKey, siteId: alertSiteId, status: nextStatus, note: note.trim() || null });
  };
  const submitAssignment = () => {
    if (!activeAlert?.siteId || !assignedToUserId || !dueAt) return;
    const dueAtValue = new Date(dueAt).getTime();
    if (!Number.isFinite(dueAtValue)) { toast.error("أدخل موعد استجابة صحيحًا."); return; }
    assign.mutate({ alertKey: activeAlert.key, siteId: activeAlert.siteId, assignedToUserId: Number(assignedToUserId), dueAt: dueAtValue, note: assignmentNote.trim() || null });
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <PageTitle eyebrow="مراقبة استباقية" title="مركز التنبيهات الذكي" description="تنبيهات محسوبة من المخزون والجرد والصيانة ومقارنة تكلفة الطاقة، وتبقى مرئية بحسب المواقع المسموح بها." />
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard label="تنبيهات مفتوحة" value={String(data?.summary.open ?? 0)} note="تحتاج متابعة أو معالجة" icon={<BellRing className="h-4 w-4" />} tone="teal" />
      <MetricCard label="حالات حرجة" value={String(data?.summary.critical ?? 0)} note="تحتاج إجراءً سريعًا" icon={<CircleAlert className="h-4 w-4" />} tone="rose" />
      <MetricCard label="تحذيرات تشغيلية" value={String(data?.summary.warning ?? 0)} note="للمراجعة قبل التحول إلى حالة حرجة" icon={<ShieldCheck className="h-4 w-4" />} tone="amber" />
    </div>
    <Card className="energy-panel">
      <CardHeader className="gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-lg">التنبيهات حسب الأولوية</CardTitle><p className="mt-1 text-sm text-muted-foreground">{data ? `${data.summary.total} نتيجة مطابقة للفلاتر الحالية` : "تحميل نتائج المراقبة"}</p></div><Button size="sm" variant="outline" onClick={resetFilters}>إعادة ضبط الفلاتر</Button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Select value={siteId} onValueChange={setSiteId}><SelectTrigger><SelectValue placeholder="كل المواقع" /></SelectTrigger><SelectContent><SelectItem value="all">كل المواقع</SelectItem>{sitesQuery.data?.map(site => <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>)}</SelectContent></Select><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue placeholder="كل الأنواع" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأنواع</SelectItem><SelectItem value="fuel">الوقود</SelectItem><SelectItem value="inventory">الجرد</SelectItem><SelectItem value="maintenance">الصيانة</SelectItem><SelectItem value="cost">التكلفة</SelectItem></SelectContent></Select><Select value={severity} onValueChange={setSeverity}><SelectTrigger><SelectValue placeholder="كل الأولويات" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأولويات</SelectItem><SelectItem value="critical">حرج</SelectItem><SelectItem value="warning">تحذير</SelectItem><SelectItem value="info">معلومة</SelectItem></SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="كل الحالات" /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem><SelectItem value="open">مفتوح</SelectItem><SelectItem value="acknowledged">قيد المتابعة</SelectItem><SelectItem value="resolved">تم الحل</SelectItem></SelectContent></Select></div></CardHeader>
      <CardContent className="space-y-3">
        {alertsQuery.isLoading ? <div className="loading-surface h-40 rounded-2xl" /> : data?.alerts.length ? data.alerts.map(alert => {
          const meta = typeMeta[alert.type];
          const Icon = meta.icon;
          return <article key={alert.key} className={`rounded-2xl border p-4 ${severityClass[alert.severity]}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/70 dark:bg-black/20"><Icon className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{alert.title}</p><Badge variant="outline" className="border-current bg-transparent">{meta.label}</Badge><Badge variant="outline" className="border-current bg-transparent">{alert.siteName}</Badge><Badge variant="outline" className="border-current bg-transparent">{statusLabel[alert.status]}</Badge></div><p className="mt-2 text-sm leading-6 opacity-90">{alert.message}</p><p className="mt-2 text-xs opacity-70">رُصد في {new Date(alert.createdAt).toLocaleDateString("ar-YE")}{alert.lastActionAt ? ` · آخر متابعة ${new Date(alert.lastActionAt).toLocaleDateString("ar-YE")}` : ""}</p>{alert.assignment ? <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-white/55 p-2 text-xs leading-5 dark:bg-black/15"><UserRoundCheck className="h-3.5 w-3.5" /><strong>{alert.assignment.assignedToName ?? "مسؤول غير محدد"}</strong><span>موعد الاستجابة: {new Date(alert.assignment.dueAt).toLocaleString("ar-YE")}</span></p> : <p className="mt-2 flex items-center gap-1 text-xs opacity-80"><Clock3 className="h-3.5 w-3.5" />لم يُعيَّن مسؤول أو موعد استجابة بعد.</p>}{alert.resolutionNote ? <p className="mt-2 rounded-xl bg-white/55 p-2 text-xs leading-5 dark:bg-black/15"><strong>ملاحظة المتابعة: </strong>{alert.resolutionNote}</p> : null}{alert.history.length ? <ol className="mt-3 space-y-1 border-r border-current/20 pr-3 text-xs leading-5 opacity-85">{alert.history.map((item, index) => <li key={`${item.action}-${item.createdAt}-${index}`}><strong>{actionLabel[item.action]}</strong>{item.actorName ? ` بواسطة ${item.actorName}` : ""}{item.note ? `: ${item.note}` : ""}<span className="mr-1 opacity-70">· {new Date(item.createdAt).toLocaleDateString("ar-YE")}</span></li>)}</ol> : null}</div></div>
              <Button size="sm" variant={activeAlertKey === alert.key ? "secondary" : "outline"} className="h-fit shrink-0 border-current bg-transparent" onClick={() => { const nextKey = activeAlertKey === alert.key ? null : alert.key; setActiveAlertKey(nextKey); if (nextKey) { setNote(alert.resolutionNote ?? ""); setAssignedToUserId(""); setDueAt(alert.assignment?.dueAt ? new Date(alert.assignment.dueAt).toISOString().slice(0, 16) : ""); setAssignmentNote(alert.assignment?.note ?? ""); } }}>{alert.status === "resolved" ? "إعادة فتح" : "متابعة التنبيه"}</Button>
            </div>
            {activeAlertKey === alert.key ? <div className="mt-4 grid gap-4 border-t border-current/15 pt-4 lg:grid-cols-2"><div><label className="text-sm font-semibold">ملاحظة المتابعة</label><Textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} placeholder={alert.status === "resolved" ? "اكتب سبب إعادة فتح التنبيه…" : "اكتب الإجراء الذي تم أو سبب إغلاق التنبيه…"} className="mt-2 min-h-20 border-current/25 bg-white/65 text-foreground dark:bg-slate-950/30" /><div className="mt-3 flex flex-wrap gap-2">{alert.status === "resolved" ? <Button size="sm" className="bg-amber-700 hover:bg-amber-800" disabled={resolve.isPending} onClick={() => submitAction(alert.key, alert.siteId, "reopened")}>إعادة فتح للتنفيذ</Button> : <><Button size="sm" variant="outline" className="border-current bg-transparent" disabled={resolve.isPending || alert.status === "acknowledged"} onClick={() => submitAction(alert.key, alert.siteId, "acknowledged")}>تأكيد المتابعة</Button><Button size="sm" className="bg-slate-950 hover:bg-slate-800" disabled={resolve.isPending} onClick={() => submitAction(alert.key, alert.siteId, "resolved")}>حلّ التنبيه <CheckCircle2 className="mr-1 h-4 w-4" /></Button></>}</div></div>{alert.siteId ? <div className="rounded-2xl border border-current/20 bg-white/35 p-3 dark:bg-black/10"><p className="font-semibold">تعيين مسؤول وموعد استجابة</p><div className="mt-3 grid gap-2"><Select value={assignedToUserId} onValueChange={setAssignedToUserId}><SelectTrigger className="border-current/25 bg-white/70 text-foreground dark:bg-slate-950/30"><SelectValue placeholder="اختر مسؤول الموقع" /></SelectTrigger><SelectContent>{assigneesQuery.data?.map(user => <SelectItem key={user.id} value={String(user.id)}>{user.name ?? `مستخدم #${user.id}`}</SelectItem>)}</SelectContent></Select><input aria-label="موعد الاستجابة" type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} className="h-10 rounded-md border border-current/25 bg-white/70 px-3 text-sm text-foreground dark:bg-slate-950/30" /><Textarea value={assignmentNote} onChange={event => setAssignmentNote(event.target.value)} maxLength={500} placeholder="ملاحظة للمسؤول (اختياري)" className="min-h-18 border-current/25 bg-white/70 text-foreground dark:bg-slate-950/30" /><Button size="sm" className="w-fit bg-teal-700 hover:bg-teal-800" disabled={assign.isPending || !assignedToUserId || !dueAt} onClick={submitAssignment}>حفظ التعيين</Button></div></div> : null}</div> : null}
          </article>;
        }) : <EmptyState title="لا توجد تنبيهات تطابق الفلاتر الحالية" description="وسّع الفلاتر أو أدخل بيانات الوقود والجرد والصيانة والطاقة كي تظهر حالات المتابعة." />}
      </CardContent>
    </Card>
  </div>;
}

import { EmptyState, MetricCard, PageTitle } from "@/components/EnergyUi";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock3, RotateCcw, Search, UserRoundCheck, UsersRound } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

const actionMeta = {
  acknowledged: { label: "تأكيد متابعة", icon: Clock3, className: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200" },
  resolved: { label: "حل التنبيه", icon: CheckCircle2, className: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200" },
  reopened: { label: "إعادة فتح", icon: RotateCcw, className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" },
  assigned: { label: "تعيين مسؤول", icon: UserRoundCheck, className: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200" },
} as const;

const responseMeta = {
  open: { label: "مفتوح", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  acknowledged: { label: "قيد المتابعة", className: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200" },
  resolved: { label: "تم الحل", className: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200" },
} as const;

function alertLabel(key: string) {
  const [type, ...rest] = key.split(":");
  const labels: Record<string, string> = { "fuel-low": "انخفاض مخزون الوقود", "inventory-variance": "فرق جرد الوقود", "maintenance-due": "صيانة مولد مستحقة", "cost-decision": "فرصة وفر في الطاقة" };
  return `${labels[type] ?? "تنبيه تشغيلي"} · ${rest.join(" · ")}`;
}

export default function TeamActivityPage() {
  const [siteId, setSiteId] = useState("all");
  const [action, setAction] = useState("all");
  const [assignedToUserId, setAssignedToUserId] = useState("all");
  const [responseStatus, setResponseStatus] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "due_soonest" | "due_latest">("newest");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const input = useMemo(() => ({ siteId: siteId === "all" ? undefined : Number(siteId), action: action === "all" ? undefined : action as keyof typeof actionMeta, assignedToUserId: assignedToUserId === "all" ? undefined : Number(assignedToUserId), responseStatus: responseStatus === "all" ? undefined : responseStatus as keyof typeof responseMeta, query: deferredQuery.trim() || undefined, sort }), [siteId, action, assignedToUserId, responseStatus, deferredQuery, sort]);
  const sites = trpc.sites.accessible.useQuery();
  const activity = trpc.monitoring.activity.list.useQuery(input);
  const rows = activity.data ?? [];
  const assignees = useMemo(() => Array.from(new Map(rows.filter(row => row.assignedToUserId).map(row => [row.assignedToUserId!, row.assignedToName ?? `مستخدم #${row.assignedToUserId}`])).entries()).map(([id, name]) => ({ id, name })), [rows]);
  const assignments = rows.filter(row => row.action === "assigned").length;
  const resolutions = rows.filter(row => row.action === "resolved").length;
  const reopened = rows.filter(row => row.action === "reopened").length;
  const resetFilters = () => { setSiteId("all"); setAction("all"); setAssignedToUserId("all"); setResponseStatus("all"); setSort("newest"); setQuery(""); };

  return <div className="mx-auto max-w-7xl space-y-6">
    <PageTitle eyebrow="تنسيق الفريق" title="سجل فريق المواقع" description="سجل مشترك وآني لإجراءات التنبيهات ضمن المواقع المصرح بها، مع البحث بالمسؤول والحالة والفرز التشغيلي." />
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard label="إجراءات معروضة" value={String(rows.length)} note="آخر 120 إجراءً ضمن الفلاتر" icon={<UsersRound className="h-4 w-4" />} tone="teal" />
      <MetricCard label="تعيينات مسؤول" value={String(assignments)} note="تعيين مسؤول ووقت استجابة" icon={<UserRoundCheck className="h-4 w-4" />} tone="slate" />
      <MetricCard label="تنبيهات أعيد فتحها" value={String(reopened)} note={`${resolutions} تنبيهًا تم حله في النتائج المعروضة`} icon={<RotateCcw className="h-4 w-4" />} tone="amber" />
    </div>
    <Card className="energy-panel">
      <CardHeader className="gap-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">التحديثات المشتركة</CardTitle><p className="mt-1 text-sm text-muted-foreground">ابحث في التنبيه أو الموقع أو المنفذ أو المسؤول، ثم صفِّ النتائج وفرزها حسب موعد الاستجابة.</p></div><Button size="sm" variant="outline" onClick={resetFilters}>إعادة ضبط</Button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><div className="relative sm:col-span-2 xl:col-span-1"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث باسم مسؤول أو موقع أو ملاحظة…" className="pr-9" /></div><Select value={siteId} onValueChange={setSiteId}><SelectTrigger><SelectValue placeholder="كل المواقع" /></SelectTrigger><SelectContent><SelectItem value="all">كل المواقع المصرح بها</SelectItem>{sites.data?.map(site => <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>)}</SelectContent></Select><Select value={action} onValueChange={setAction}><SelectTrigger><SelectValue placeholder="كل الإجراءات" /></SelectTrigger><SelectContent><SelectItem value="all">كل الإجراءات</SelectItem><SelectItem value="assigned">تعيين مسؤول</SelectItem><SelectItem value="acknowledged">تأكيد متابعة</SelectItem><SelectItem value="resolved">حل التنبيه</SelectItem><SelectItem value="reopened">إعادة فتح</SelectItem></SelectContent></Select><Select value={assignedToUserId} onValueChange={setAssignedToUserId}><SelectTrigger><SelectValue placeholder="كل المسؤولين" /></SelectTrigger><SelectContent><SelectItem value="all">كل المسؤولين</SelectItem>{assignees.map(user => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent></Select><Select value={responseStatus} onValueChange={setResponseStatus}><SelectTrigger><SelectValue placeholder="حالة الاستجابة" /></SelectTrigger><SelectContent><SelectItem value="all">كل حالات الاستجابة</SelectItem><SelectItem value="open">مفتوح</SelectItem><SelectItem value="acknowledged">قيد المتابعة</SelectItem><SelectItem value="resolved">تم الحل</SelectItem></SelectContent></Select><Select value={sort} onValueChange={value => setSort(value as typeof sort)}><SelectTrigger><SelectValue placeholder="ترتيب السجل" /></SelectTrigger><SelectContent><SelectItem value="newest">الأحدث أولًا</SelectItem><SelectItem value="oldest">الأقدم أولًا</SelectItem><SelectItem value="due_soonest">أقرب موعد استجابة</SelectItem><SelectItem value="due_latest">أبعد موعد استجابة</SelectItem></SelectContent></Select></div></CardHeader>
      <CardContent className="space-y-3">{activity.isLoading ? <div className="loading-surface h-48 rounded-2xl" /> : rows.length ? rows.map(row => { const meta = actionMeta[row.action]; const response = responseMeta[row.responseStatus]; const Icon = meta.icon; return <article key={row.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-start"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.className}`}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{meta.label}</strong><Badge variant="outline">{row.siteName ?? "موقع غير محدد"}</Badge><Badge className={response.className}>{response.label}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{alertLabel(row.alertKey)}</p>{row.assignedToName ? <p className="mt-2 text-sm"><strong>المسؤول: </strong>{row.assignedToName}{row.dueAt ? <span className="mr-2 text-muted-foreground">· الاستجابة حتى {new Date(row.dueAt).toLocaleString("ar-YE")}</span> : null}</p> : null}{row.note ? <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-6 dark:bg-slate-900">{row.note}</p> : null}<p className="mt-3 text-xs text-muted-foreground">بواسطة {row.actorName ?? "مستخدم النظام"} · {new Date(row.createdAt).toLocaleString("ar-YE")}</p></div></article>; }) : <EmptyState title="لا توجد إجراءات تطابق الفلاتر" description="وسّع البحث أو غيّر فلاتر المسؤول وحالة الاستجابة لرؤية السجل المصرح به." />}</CardContent>
    </Card>
  </div>;
}

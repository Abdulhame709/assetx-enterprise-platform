import { EmptyState, PageTitle } from "@/components/EnergyUi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Boxes, Building2, MapPinned, ShieldCheck, UserRoundCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type DraftGrant = "none" | "viewer" | "operator" | "supervisor";
const sections = [{ id: "energy", label: "الطاقة" }, { id: "fuel", label: "الوقود" }] as const;

export default function SitesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const sitesQuery = trpc.sites.manage.list.useQuery(undefined, { enabled: isAdmin });
  const usersQuery = trpc.admin.users.list.useQuery(undefined, { enabled: isAdmin });
  const grantsQuery = trpc.sites.manage.grants.list.useQuery(undefined, { enabled: isAdmin });
  const [form, setForm] = useState({ code: "", name: "", city: "", address: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [resourceSiteId, setResourceSiteId] = useState("");
  const [draftGrants, setDraftGrants] = useState<Record<string, DraftGrant>>({});
  const resourcesQuery = trpc.sites.manage.resources.useQuery({ siteId: Number(resourceSiteId) }, { enabled: isAdmin && Boolean(resourceSiteId) });
  const refresh = async () => {
    await Promise.all([
      utils.sites.manage.list.invalidate(),
      utils.sites.manage.grants.list.invalidate(),
      utils.sites.manage.resources.invalidate(),
      utils.sites.accessible.invalidate(),
    ]);
  };
  const createSite = trpc.sites.manage.create.useMutation({
    onSuccess: async () => { await refresh(); setForm({ code: "", name: "", city: "", address: "" }); toast.success("تمت إضافة الموقع."); },
    onError: () => toast.error("تعذر إضافة الموقع."),
  });
  const updateSite = trpc.sites.manage.update.useMutation({
    onSuccess: async () => { await refresh(); setEditingId(null); setForm({ code: "", name: "", city: "", address: "" }); toast.success("تم تحديث الموقع."); },
    onError: () => toast.error("تعذر تحديث الموقع."),
  });
  const replaceGrants = trpc.sites.manage.grants.replace.useMutation({
    onSuccess: async () => { await refresh(); toast.success("تم حفظ صلاحيات المواقع."); },
    onError: () => toast.error("تعذر حفظ صلاحيات المواقع."),
  });

  const sites = sitesQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const grants = grantsQuery.data ?? [];
  const resourceGroups = resourcesQuery.data ? [
    { label: "العدادات", items: resourcesQuery.data.meters },
    { label: "المولدات", items: resourcesQuery.data.generators },
    { label: "أصناف الوقود", items: resourcesQuery.data.products },
  ] : [];

  useEffect(() => { if (!selectedUserId && users[0]) setSelectedUserId(String(users[0].id)); }, [users, selectedUserId]);
  useEffect(() => { if (!resourceSiteId && sites[0]) setResourceSiteId(String(sites[0].id)); }, [sites, resourceSiteId]);
  useEffect(() => {
    if (!selectedUserId) return;
    const next: Record<string, DraftGrant> = {};
    grants.filter(grant => grant.userId === Number(selectedUserId)).forEach(grant => { next[`${grant.siteId}:${grant.section}`] = grant.accessLevel; });
    setDraftGrants(next);
  }, [selectedUserId, grants]);

  const selectedUser = useMemo(() => users.find(item => item.id === Number(selectedUserId)), [users, selectedUserId]);
  const submitSite = (event: FormEvent) => {
    event.preventDefault();
    const values = { ...form, city: form.city || null, address: form.address || null };
    if (editingId) updateSite.mutate({ id: editingId, ...values, isActive: true });
    else createSite.mutate(values);
  };
  const startEdit = (site: typeof sites[number]) => {
    setEditingId(site.id);
    setForm({ code: site.code, name: site.name, city: site.city ?? "", address: site.address ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const saveGrants = () => {
    if (!selectedUser) return;
    const next = Object.entries(draftGrants).flatMap(([key, accessLevel]) => {
      if (accessLevel === "none") return [];
      const [siteId, section] = key.split(":");
      return [{ siteId: Number(siteId), section: section as "energy" | "fuel", accessLevel }];
    });
    replaceGrants.mutate({ userId: selectedUser.id, grants: next });
  };

  if (!isAdmin) return <EmptyState title="هذه الصفحة مخصصة للإدارة" description="إدارة المواقع والفروع وتخصيص الوصول حسب الموقع متاحة للمسؤول فقط." />;

  return <div className="mx-auto max-w-7xl space-y-6">
    <PageTitle eyebrow="هيكل المؤسسة" title="المواقع والفروع والصلاحيات" description="اربط تشغيل الطاقة والوقود بالموقع، ثم امنح الموظفين وصولًا مستقلًا لكل قسم وموقع دون خلط البيانات." />

    <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
      <Card className="energy-panel">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MapPinned className="h-5 w-5 text-teal-700" />{editingId ? "تعديل موقع" : "إضافة موقع أو فرع"}</CardTitle></CardHeader>
        <CardContent><form className="space-y-4" onSubmit={submitSite}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="site-code">رمز الموقع</Label><Input id="site-code" value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} placeholder="SANAA-01" required /></div>
            <div className="space-y-2"><Label htmlFor="site-name">اسم الموقع</Label><Input id="site-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="فرع صنعاء" required /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="site-city">المدينة</Label><Input id="site-city" value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} placeholder="صنعاء" /></div>
          <div className="space-y-2"><Label htmlFor="site-address">العنوان أو الملاحظة</Label><Textarea id="site-address" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} rows={3} /></div>
          <div className="flex gap-2"><Button type="submit" className="bg-teal-700 hover:bg-teal-800" disabled={createSite.isPending || updateSite.isPending}>{editingId ? "حفظ التعديل" : "إضافة الموقع"}</Button>{editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ code: "", name: "", city: "", address: "" }); }}>إلغاء</Button>}</div>
        </form></CardContent>
      </Card>
      <Card className="energy-panel">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-teal-700" />المواقع المسجلة</CardTitle></CardHeader>
        <CardContent className="space-y-3">{sitesQuery.isLoading ? <div className="loading-surface h-32 rounded-2xl" /> : sites.length ? sites.map(site => <div key={site.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><p className="font-bold">{site.name}</p><Badge variant={site.isActive ? "secondary" : "outline"}>{site.isActive ? "نشط" : "موقوف"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{site.code}{site.city ? ` · ${site.city}` : ""}</p></div><Button variant="outline" size="sm" onClick={() => startEdit(site)}>تعديل</Button></div>) : <EmptyState title="لم يُسجل أي موقع بعد" description="أضف موقعًا أو فرعًا لتبدأ توزيع الموارد والصلاحيات." />}</CardContent>
      </Card>
    </div>

    <Card className="energy-panel">
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="flex items-center gap-2 text-lg"><Boxes className="h-5 w-5 text-teal-700" />ارتباط موارد الموقع</CardTitle><Select value={resourceSiteId} onValueChange={setResourceSiteId}><SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="اختر موقعًا" /></SelectTrigger><SelectContent>{sites.map(site => <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>)}</SelectContent></Select></CardHeader>
      <CardContent>{resourcesQuery.isLoading ? <div className="loading-surface h-40 rounded-2xl" /> : resourcesQuery.data ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-4">{[["دورات", resourcesQuery.data.summary.cycles], ["عدادات", resourcesQuery.data.summary.meters], ["مولدات", resourcesQuery.data.summary.generators], ["أصناف وقود", resourcesQuery.data.summary.products]].map(([label, value]) => <div className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-900" key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}</div><div className="grid gap-4 lg:grid-cols-3">{resourceGroups.map(group => <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700" key={group.label}><p className="mb-3 font-bold">{group.label}</p>{group.items.length ? <div className="space-y-2">{group.items.map(item => <div key={item.id} className="flex items-center justify-between text-sm"><span>{item.name}</span><span className="text-xs text-muted-foreground">{item.code}</span></div>)}</div> : <p className="text-sm text-muted-foreground">لا توجد موارد مرتبطة بعد.</p>}</div>)}</div></div> : <EmptyState title="اختر موقعًا" description="سيظهر هنا ربط الموارد الحالية بالموقع." />}</CardContent>
    </Card>

    <Card className="energy-panel">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserRoundCheck className="h-5 w-5 text-teal-700" />صلاحيات الموظفين حسب الموقع</CardTitle></CardHeader>
      <CardContent className="space-y-5"><div className="max-w-md space-y-2"><Label>اختر الموظف</Label><Select value={selectedUserId} onValueChange={setSelectedUserId}><SelectTrigger><SelectValue placeholder="اختر موظفًا" /></SelectTrigger><SelectContent>{users.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name || item.email || `مستخدم #${item.id}`}</SelectItem>)}</SelectContent></Select></div>{selectedUser && <><div className="overflow-x-auto"><table className="min-w-[640px] w-full text-right text-sm"><thead><tr className="border-b border-slate-200 text-muted-foreground dark:border-slate-700"><th className="p-3">الموقع</th>{sections.map(section => <th className="p-3" key={section.id}>{section.label}</th>)}</tr></thead><tbody>{sites.map(site => <tr key={site.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="p-3"><p className="font-bold">{site.name}</p><p className="text-xs text-muted-foreground">{site.code}</p></td>{sections.map(section => <td className="p-3" key={section.id}><Select value={draftGrants[`${site.id}:${section.id}`] ?? "none"} onValueChange={value => setDraftGrants(current => ({ ...current, [`${site.id}:${section.id}`]: value as DraftGrant }))}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">لا وصول</SelectItem><SelectItem value="viewer">عرض فقط</SelectItem><SelectItem value="operator">إدخال وتشغيل</SelectItem><SelectItem value="supervisor">إشراف واعتماد</SelectItem></SelectContent></Select></td>)}</tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900"><p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-teal-700" />المدير يحتفظ بالعرض والإدارة المركزية حتى دون منح فردي.</p><Button onClick={saveGrants} disabled={replaceGrants.isPending} className="bg-teal-700 hover:bg-teal-800">حفظ صلاحيات {selectedUser.name || "الموظف"}</Button></div></>}</CardContent>
    </Card>
  </div>;
}

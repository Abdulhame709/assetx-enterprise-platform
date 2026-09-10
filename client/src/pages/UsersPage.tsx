import { EmptyState, PageTitle, RoleSelect, dateLabel } from "@/components/EnergyUi";
import PermissionMatrix from "@/components/PermissionMatrix";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Archive, BriefcaseBusiness, CheckCircle2, CircleCheck, Edit3, Fuel, History, MailPlus, RotateCcw, Search, ShieldCheck, UserCog, UserPlus, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const roleInfo: Record<string, { label: string; tone: string; description: string; permissions: string[] }> = {
  admin: { label: "مدير النظام", tone: "bg-slate-900 text-white", description: "إدارة كاملة للنظام والمستخدمين والإعدادات.", permissions: ["إدارة المستخدمين", "إعدادات وتعرفة", "عرض وتعديل جميع الوحدات"] },
  energy_operator: { label: "مشغل طاقة", tone: "bg-teal-50 text-teal-800", description: "مسؤول القراءات وتشغيل المولدات والوقود.", permissions: ["قراءات العدادات", "فترات التشغيل", "حركات الوقود"] },
  accountant: { label: "محاسب", tone: "bg-sky-50 text-sky-800", description: "مسؤول الفواتير ومراجعة التكاليف الرسمية.", permissions: ["حفظ الفواتير", "مطابقة التكاليف", "التقارير المالية"] },
  maintenance: { label: "فريق الصيانة", tone: "bg-amber-50 text-amber-800", description: "مسؤول أصول المولدات والصيانة والإهلاك.", permissions: ["بيانات المولدات", "سجلات الصيانة", "بيانات العمر التشغيلي"] },
  reviewer: { label: "مراجع / مشرف", tone: "bg-violet-50 text-violet-800", description: "يراجع الدورات ويعتمدها أو يقفلها.", permissions: ["مراجعة الدورة", "الاعتماد", "الإقفال"] },
  auditor: { label: "مدقق", tone: "bg-slate-100 text-slate-700", description: "عرض البيانات والسجلات دون تعديل.", permissions: ["عرض كامل", "سجل التدقيق", "تنزيل التقارير"] },
  management: { label: "إدارة", tone: "bg-rose-50 text-rose-800", description: "تتابع المؤشرات والتقارير والقرار التشغيلي.", permissions: ["لوحة التحكم", "تحليل التكلفة", "التقارير"] },
  user: { label: "بانتظار التخصيص", tone: "bg-slate-100 text-slate-600", description: "لم يحدد له دور تشغيلي بعد.", permissions: ["لا توجد صلاحيات تشغيلية"] },
};

const fuelRoleInfo = {
  viewer: { label: "مستعرض الوقود", description: "عرض الأرصدة والحركات والتقارير." },
  operator: { label: "مشغل الوقود", description: "تسجيل التوريد والصرف والهدر ضمن القيود." },
  supervisor: { label: "مشرف الوقود", description: "اعتماد الجرد وإقفاله ومراجعة الفروقات." },
  accountant: { label: "محاسب الوقود", description: "عرض التكلفة والتقارير المالية للوقود." },
  auditor: { label: "مدقق الوقود", description: "عرض السجل والتقارير دون تعديل الحركات." },
} as const;

type FuelRole = keyof typeof fuelRoleInfo;
type UserRole = "admin" | "energy_operator" | "accountant" | "maintenance" | "reviewer" | "auditor" | "management" | "user";
type UserRow = { id: number; name: string | null; email: string | null; role: UserRole; isActive: boolean; createdAt: Date; lastSignedIn: Date };

export default function UsersPage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const users = trpc.admin.users.list.useQuery();
  const fuelGrants = trpc.admin.fuelRoles.list.useQuery();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialog, setDialog] = useState<"invite" | "edit" | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "user" as UserRole });

  const refreshUsers = () => utils.admin.users.list.invalidate();
  const invite = trpc.admin.users.invite.useMutation({ onSuccess: () => { toast.success("تم إنشاء دعوة المستخدم بنجاح."); setDialog(null); refreshUsers(); }, onError: error => toast.error(error.message) });
  const updateProfile = trpc.admin.users.updateProfile.useMutation({ onSuccess: () => { toast.success("تم تحديث بيانات المستخدم."); setDialog(null); refreshUsers(); }, onError: error => toast.error(error.message) });
  const setRole = trpc.admin.users.setRole.useMutation({ onSuccess: () => { toast.success("تم حفظ دور الموظف وتطبيقه على الخادم."); refreshUsers(); }, onError: error => toast.error(error.message) });
  const setActive = trpc.admin.users.setActive.useMutation({ onSuccess: (_, input) => { toast.success(input.isActive ? "تم تفعيل الحساب." : "تم توقيف الحساب."); refreshUsers(); }, onError: error => toast.error(error.message) });
  const archive = trpc.admin.users.archive.useMutation({ onSuccess: () => { toast.success("تمت أرشفة الحساب وإخفاؤه من التشغيل."); refreshUsers(); }, onError: error => toast.error(error.message) });
  const replaceFuelRoles = trpc.admin.fuelRoles.replace.useMutation({ onSuccess: (_, input) => { toast.success(input.roles.length ? "تم حفظ أدوار الوقود وتسجيل التغيير." : "تم سحب أدوار الوقود من المستخدم."); utils.admin.fuelRoles.list.invalidate(); }, onError: error => toast.error(error.message) });

  const fuelRolesByUser = useMemo(() => {
    const groups = new Map<number, FuelRole[]>();
    fuelGrants.data?.forEach(grant => groups.set(grant.userId, [...(groups.get(grant.userId) ?? []), grant.role as FuelRole]));
    return groups;
  }, [fuelGrants.data]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ((users.data ?? []) as UserRow[]).filter(user => {
      const matchesQuery = !normalized || [user.name, user.email, roleInfo[user.role]?.label].some(value => value?.toLowerCase().includes(normalized));
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? user.isActive : !user.isActive);
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, users.data]);

  const openInvite = () => { setSelectedUser(null); setForm({ name: "", email: "", role: "user" }); setDialog("invite"); };
  const openEdit = (user: UserRow) => { setSelectedUser(user); setForm({ name: user.name ?? "", email: user.email ?? "", role: user.role }); setDialog("edit"); };
  const submitForm = () => {
    if (dialog === "invite") invite.mutate(form);
    if (dialog === "edit" && selectedUser) updateProfile.mutate({ userId: selectedUser.id, name: form.name, email: form.email });
  };
  const toggleActive = (user: UserRow) => setActive.mutate({ userId: user.id, isActive: !user.isActive });
  const archiveUser = (user: UserRow) => { if (window.confirm(`سيتم أرشفة حساب ${user.name || user.email || "المستخدم"} وإيقاف وصوله. هل تريد المتابعة؟`)) archive.mutate({ userId: user.id }); };
  const toggleFuelRole = (userId: number, role: FuelRole, checked: boolean) => {
    const current = fuelRolesByUser.get(userId) ?? [];
    const roles = checked ? Array.from(new Set([...current, role])) : current.filter(currentRole => currentRole !== role);
    replaceFuelRoles.mutate({ userId, roles });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle eyebrow="الحوكمة والوصول" title="إدارة المستخدمين والصلاحيات" description="وحدة تشغيلية بنمط ERP لإضافة المستخدمين وتعديلهم وإدارة حالتهم وأدوارهم، مع تطبيق المنع من الخادم وسجل تدقيق للإجراءات الحساسة." />

      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث بالاسم أو البريد أو الدور…" className="pr-9" /></div>
            <Select value={statusFilter} onValueChange={value => setStatusFilter(value as typeof statusFilter)}><SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="حالة الحساب" /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem><SelectItem value="active">نشط</SelectItem><SelectItem value="inactive">موقوف / مؤرشف</SelectItem></SelectContent></Select>
          </div>
          <Button onClick={openInvite} className="bg-teal-700 text-white hover:bg-teal-800"><UserPlus className="ml-2 h-4 w-4" />إضافة مستخدم</Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>الموظفون المسجلون</CardTitle><p className="mt-1 text-sm text-slate-500">{filteredUsers.length} مستخدم ظاهر من أصل {users.data?.length ?? 0}. يمكن تعديل البيانات أو الدور أو حالة الحساب من كل بطاقة.</p></div><UserCog className="h-5 w-5 text-teal-700" /></CardHeader>
          <CardContent>
            {users.isError ? <EmptyState title="هذه الصفحة مخصصة لمدير النظام" description="يستطيع مدير النظام فقط إدارة المستخدمين ومنح الصلاحيات." /> : !filteredUsers.length ? <EmptyState title="لا توجد نتائج" description="جرّب تغيير كلمات البحث أو مرشح الحالة، أو أضف مستخدمًا جديدًا." /> : <div className="space-y-3">{filteredUsers.map(user => {
              const info = roleInfo[user.role] ?? roleInfo.user;
              return <div key={user.id} className={`rounded-2xl border p-4 transition-colors ${user.isActive ? "border-slate-200 bg-white" : "border-rose-200 bg-rose-50/40"}`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{user.name || "موظف دون اسم"}</p><Badge className={`${info.tone} border-0`}>{info.label}</Badge><Badge className={user.isActive ? "border-0 bg-emerald-50 text-emerald-700" : "border-0 bg-rose-100 text-rose-700"}>{user.isActive ? "نشط" : "موقوف"}</Badge></div><p className="mt-1 truncate text-sm text-slate-500">{user.email || "لا يوجد بريد ظاهر"}</p><p className="mt-2 text-xs text-slate-400">آخر دخول: {dateLabel(user.lastSignedIn)} · أضيف: {dateLabel(user.createdAt)}</p></div>
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end"><Button size="sm" variant="outline" onClick={() => openEdit(user)}><Edit3 className="ml-1 h-4 w-4" />تعديل</Button><Button size="sm" variant="outline" onClick={() => toggleActive(user)}>{user.isActive ? <><UserX className="ml-1 h-4 w-4" />توقيف</> : <><RotateCcw className="ml-1 h-4 w-4" />تفعيل</>}</Button><Button size="sm" variant="outline" className="text-rose-700 hover:bg-rose-50" onClick={() => archiveUser(user)}><Archive className="ml-1 h-4 w-4" />أرشفة</Button></div>
                </div>
                <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-[1fr_220px] md:items-end"><div><Label className="mb-2 block text-xs font-bold text-slate-500">الدور العام</Label><RoleSelect value={user.role} onValueChange={role => setRole.mutate({ userId: user.id, role: role as UserRole })} /></div><div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><span className="font-bold text-slate-700">حالة الوصول:</span> {user.isActive ? "يستطيع تسجيل الدخول وفق دوره ومنحه التفصيلي." : "محجوب عن الإجراءات المحمية حتى يعاد تفعيله."}</div></div>
              </div>;
            })}</div>}
          </CardContent>
        </Card>

        <Card className="border-0 bg-slate-900 text-white shadow-sm"><CardHeader><CardTitle className="text-white">إجراءات ERP المتاحة</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-6 text-slate-300"><div className="flex gap-3"><CircleCheck className="mt-1 h-4 w-4 shrink-0 text-teal-300" /><p><strong className="text-white">إضافة:</strong> إنشاء دعوة مرتبطة بالبريد والدور؛ يكتمل الحساب عند تسجيل الموظف دخوله.</p></div><div className="flex gap-3"><CircleCheck className="mt-1 h-4 w-4 shrink-0 text-teal-300" /><p><strong className="text-white">تعديل:</strong> تحديث الاسم والبريد والدور دون حذف سجل التدقيق.</p></div><div className="flex gap-3"><CircleCheck className="mt-1 h-4 w-4 shrink-0 text-teal-300" /><p><strong className="text-white">توقيف / تفعيل:</strong> منع أو إعادة السماح بتسجيل الدخول للإجراءات المحمية.</p></div><div className="flex gap-3"><CircleCheck className="mt-1 h-4 w-4 shrink-0 text-teal-300" /><p><strong className="text-white">أرشفة:</strong> حذف تشغيلي آمن يحافظ على السجل ولا يحذف البيانات التاريخية.</p></div></CardContent></Card>
      </div>

      <Card className="border-0 shadow-sm"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>دليل الأدوار</CardTitle><p className="mt-1 text-sm text-slate-500">ملخص عملي لما يستطيع كل دور القيام به.</p></div><ShieldCheck className="h-5 w-5 text-teal-700" /></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Object.entries(roleInfo).filter(([id]) => id !== "user").map(([id, info]) => <div key={id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><p className="font-bold">{info.label}</p><BriefcaseBusiness className="h-4 w-4 text-slate-400" /></div><p className="mt-2 text-sm text-slate-500">{info.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{info.permissions.map(permission => <span key={permission} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{permission}</span>)}</div></div>)}</div></CardContent></Card>

      <PermissionMatrix users={users.data ?? []} />

      <Card className="border-0 shadow-sm"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>أدوار قسم الوقود</CardTitle><p className="mt-1 text-sm text-slate-500">يمكن للمستخدم الجمع بين أكثر من دور وقود عند الحاجة.</p></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => setLocation("/fuel/role-audit")}><History className="ml-2 h-4 w-4" />سجل التغييرات</Button><Fuel className="h-5 w-5 text-amber-600" /></div></CardHeader><CardContent>{users.isError ? <EmptyState title="هذه الصفحة مخصصة لمدير النظام" description="يستطيع مدير النظام فقط منح أدوار الوقود أو سحبها." /> : !users.data?.length ? <EmptyState title="لا يوجد موظفون بعد" description="سيظهر الموظف هنا بعد أول تسجيل دخول." /> : <div className="space-y-3">{(users.data as UserRow[]).map(user => { const assignedRoles = fuelRolesByUser.get(user.id) ?? []; return <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{user.name || "موظف دون اسم"}</p><p className="mt-1 text-sm text-slate-500">{assignedRoles.length ? assignedRoles.map(role => fuelRoleInfo[role].label).join(" · ") : "لا توجد صلاحيات وقود مخصصة"}</p></div><div className="flex flex-wrap gap-2">{assignedRoles.map(role => <Badge key={role} className="border-0 bg-amber-50 text-amber-800">{fuelRoleInfo[role].label}</Badge>)}</div></div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{(Object.keys(fuelRoleInfo) as FuelRole[]).map(role => <label key={role} className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 transition-colors hover:border-amber-300 hover:bg-amber-50/50"><input type="checkbox" className="mt-1 accent-amber-600" checked={assignedRoles.includes(role)} disabled={replaceFuelRoles.isPending || fuelGrants.isLoading || !user.isActive} onChange={event => toggleFuelRole(user.id, role, event.target.checked)} /><span><span className="block text-sm font-bold text-slate-800">{fuelRoleInfo[role].label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{fuelRoleInfo[role].description}</span></span></label>)}</div></div>; })}</div>}</CardContent></Card>

      <Dialog open={dialog !== null} onOpenChange={open => !open && setDialog(null)}><DialogContent className="max-w-lg" dir="rtl"><DialogHeader><DialogTitle>{dialog === "invite" ? "إضافة مستخدم جديد" : "تعديل بيانات المستخدم"}</DialogTitle><DialogDescription>{dialog === "invite" ? "أدخل البيانات الأساسية وسيُسند الدور عند أول تسجيل دخول بالبريد نفسه." : "عدّل الاسم والبريد، ثم احفظ التغيير في سجل التدقيق."}</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="user-name">الاسم الكامل</Label><Input id="user-name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="مثال: أحمد محمد" /></div><div className="grid gap-2"><Label htmlFor="user-email">البريد الإلكتروني</Label><Input id="user-email" type="email" dir="ltr" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="name@example.com" /></div>{dialog === "invite" && <div className="grid gap-2"><Label>الدور الابتدائي</Label><Select value={form.role} onValueChange={role => setForm(current => ({ ...current, role: role as UserRole }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(roleInfo).map(([role, info]) => <SelectItem key={role} value={role as UserRole}>{info.label}</SelectItem>)}</SelectContent></Select></div>}</div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button><Button className="bg-teal-700 text-white hover:bg-teal-800" disabled={!form.name.trim() || !form.email.trim() || invite.isPending || updateProfile.isPending} onClick={submitForm}>{dialog === "invite" ? <><MailPlus className="ml-2 h-4 w-4" />إنشاء الدعوة</> : <><CheckCircle2 className="ml-2 h-4 w-4" />حفظ التعديل</>}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

import { EmptyState, PageTitle, RoleSelect, dateLabel } from "@/components/EnergyUi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PermissionMatrix from "@/components/PermissionMatrix";
import { trpc } from "@/lib/trpc";
import { BriefcaseBusiness, CircleCheck, Fuel, History, ShieldCheck, UserCog } from "lucide-react";
import { useMemo } from "react";
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

export default function UsersPage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const users = trpc.admin.users.list.useQuery();
  const fuelGrants = trpc.admin.fuelRoles.list.useQuery();
  const setRole = trpc.admin.users.setRole.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ دور الموظف وتطبيقه على الخادم.");
      utils.admin.users.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const replaceFuelRoles = trpc.admin.fuelRoles.replace.useMutation({
    onSuccess: (_, input) => {
      toast.success(input.roles.length ? "تم حفظ أدوار الوقود وتسجيل التغيير." : "تم سحب أدوار الوقود من المستخدم.");
      utils.admin.fuelRoles.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const fuelRolesByUser = useMemo(() => {
    const groups = new Map<number, FuelRole[]>();
    fuelGrants.data?.forEach(grant => groups.set(grant.userId, [...(groups.get(grant.userId) ?? []), grant.role as FuelRole]));
    return groups;
  }, [fuelGrants.data]);

  const toggleFuelRole = (userId: number, role: FuelRole, checked: boolean) => {
    const current = fuelRolesByUser.get(userId) ?? [];
    const roles = checked ? Array.from(new Set([...current, role])) : current.filter(currentRole => currentRole !== role);
    replaceFuelRoles.mutate({ userId, roles });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle eyebrow="الحوكمة والوصول" title="إدارة المستخدمين والصلاحيات" description="بعد أن يسجل الموظف دخوله لأول مرة سيظهر هنا. اختر له دورًا واضحًا، ويطبق النظام الصلاحيات في الخادم وليس في الواجهة فقط." />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>الموظفون المسجلون</CardTitle><p className="mt-1 text-sm text-slate-500">التغيير يحفظ فورًا في سجل التدقيق ويطبق في الطلب التالي للموظف.</p></div>
            <UserCog className="h-5 w-5 text-teal-700" />
          </CardHeader>
          <CardContent>
            {users.isError ? <EmptyState title="هذه الصفحة مخصصة لمدير النظام" description="يستطيع مدير النظام فقط تعيين أدوار الموظفين بعد أول تسجيل دخول لهم." /> : !users.data?.length ? <EmptyState title="لا يوجد موظفون بعد" description="اطلب من كل موظف تسجيل الدخول مرة واحدة، ثم عد إلى هذه الصفحة لتحديد دوره." /> : <div className="space-y-3">{users.data.map(user => {
              const info = roleInfo[user.role] ?? roleInfo.user;
              return <div key={user.id} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{user.name || "موظف دون اسم"}</p><Badge className={`${info.tone} border-0`}>{info.label}</Badge></div><p className="mt-1 truncate text-sm text-slate-500">{user.email || "لا يوجد بريد ظاهر"}</p><p className="mt-2 text-xs text-slate-400">آخر دخول: {dateLabel(user.lastSignedIn)}</p></div><div className="rounded-xl bg-slate-50 p-3 md:w-56"><p className="mb-2 text-xs font-bold text-slate-500">الدور المخصص</p><RoleSelect value={user.role} onValueChange={role => setRole.mutate({ userId: user.id, role: role as "admin" | "energy_operator" | "accountant" | "maintenance" | "reviewer" | "auditor" | "management" | "user" })} /></div></div>;
            })}</div>}
          </CardContent>
        </Card>

        <Card className="border-0 bg-slate-900 text-white shadow-sm">
          <CardHeader><CardTitle className="text-white">كيف تخصص الدور؟</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-300"><div className="flex gap-3"><CircleCheck className="mt-1 h-4 w-4 shrink-0 text-teal-300" /><p>ابدأ بالدور الأقل الذي يغطي عمل الموظف، ثم وسّعه عند الحاجة.</p></div><div className="flex gap-3"><CircleCheck className="mt-1 h-4 w-4 shrink-0 text-teal-300" /><p>اجعل اعتماد الدورات للمراجع أو المدير فقط، وليس لمشغل البيانات.</p></div><div className="flex gap-3"><CircleCheck className="mt-1 h-4 w-4 shrink-0 text-teal-300" /><p>يملك المدقق والإدارة عرضًا مناسبًا دون تعديل العمليات التشغيلية.</p></div></CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle>دليل الأدوار</CardTitle><p className="mt-1 text-sm text-slate-500">ملخص عملي لما يستطيع كل دور القيام به.</p></div><ShieldCheck className="h-5 w-5 text-teal-700" /></CardHeader>
        <CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Object.entries(roleInfo).filter(([id]) => id !== "user").map(([id, info]) => <div key={id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><p className="font-bold">{info.label}</p><BriefcaseBusiness className="h-4 w-4 text-slate-400" /></div><p className="mt-2 text-sm text-slate-500">{info.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{info.permissions.map(permission => <span key={permission} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{permission}</span>)}</div></div>)}</div></CardContent>
      </Card>

      <PermissionMatrix users={users.data ?? []} />

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle>أدوار قسم الوقود</CardTitle><p className="mt-1 text-sm text-slate-500">يمكن للمستخدم الجمع بين أكثر من دور وقود عند الحاجة. تسحب جميع العلامات وصوله التشغيلي للقسم.</p></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => setLocation("/fuel/role-audit")}><History className="ml-2 h-4 w-4" />سجل التغييرات</Button><Fuel className="h-5 w-5 text-amber-600" /></div></CardHeader>
        <CardContent>
          {users.isError ? <EmptyState title="هذه الصفحة مخصصة لمدير النظام" description="يستطيع مدير النظام فقط منح أدوار الوقود أو سحبها." /> : !users.data?.length ? <EmptyState title="لا يوجد موظفون بعد" description="سيظهر الموظف هنا بعد أول تسجيل دخول." /> : <div className="space-y-3">{users.data.map(user => {
            const assignedRoles = fuelRolesByUser.get(user.id) ?? [];
            return <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{user.name || "موظف دون اسم"}</p><p className="mt-1 text-sm text-slate-500">{assignedRoles.length ? assignedRoles.map(role => fuelRoleInfo[role].label).join(" · ") : "لا توجد صلاحيات وقود مخصصة"}</p></div><div className="flex flex-wrap gap-2">{assignedRoles.map(role => <Badge key={role} className="border-0 bg-amber-50 text-amber-800">{fuelRoleInfo[role].label}</Badge>)}</div></div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{(Object.keys(fuelRoleInfo) as FuelRole[]).map(role => <label key={role} className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 transition-colors hover:border-amber-300 hover:bg-amber-50/50"><input type="checkbox" className="mt-1 accent-amber-600" checked={assignedRoles.includes(role)} disabled={replaceFuelRoles.isPending || fuelGrants.isLoading} onChange={event => toggleFuelRole(user.id, role, event.target.checked)} /><span><span className="block text-sm font-bold text-slate-800">{fuelRoleInfo[role].label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{fuelRoleInfo[role].description}</span></span></label>)}</div></div>;
          })}</div>}
        </CardContent>
      </Card>
    </div>
  );
}

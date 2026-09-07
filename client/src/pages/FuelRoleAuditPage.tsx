import { EmptyState, PageTitle } from "@/components/EnergyUi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowRight, History, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";

const fuelRoleLabels: Record<string, string> = {
  viewer: "مستعرض الوقود",
  operator: "مشغل الوقود",
  supervisor: "مشرف الوقود",
  accountant: "محاسب الوقود",
  auditor: "مدقق الوقود",
};

function rolesFromSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || !("roles" in value) || !Array.isArray(value.roles)) return [];
  return value.roles.filter((role): role is string => typeof role === "string");
}

function labelRoles(roles: string[]) {
  return roles.length ? roles.map(role => fuelRoleLabels[role] ?? role).join(" · ") : "بلا أدوار وقود";
}

function userNameFromSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || !("userName" in value) || typeof value.userName !== "string") return null;
  return value.userName;
}

export default function FuelRoleAuditPage() {
  const [, setLocation] = useLocation();
  const users = trpc.admin.users.list.useQuery();
  const audit = trpc.admin.fuelRoles.audit.useQuery({ limit: 50 });
  const usersById = useMemo(() => new Map(users.data?.map(user => [user.id, user]) ?? []), [users.data]);

  const isDenied = users.isError || audit.isError;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle eyebrow="الحوكمة والتتبع" title="سجل تغييرات أدوار الوقود" description="يعرض هذا السجل كل منح أو سحب لأدوار الوقود، مع المسؤول الذي نفذ التغيير وحالة الأدوار قبل التحديث وبعده." />
        <Button variant="outline" onClick={() => setLocation("/energy/users")}><ArrowRight className="ml-2 h-4 w-4" />إدارة المستخدمين</Button>
      </div>

      <Card className="border-0 bg-slate-900 text-white shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-4 p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/15 text-amber-200"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-bold">سجل إداري محمي</p><p className="mt-1 text-sm text-slate-300">العرض متاح لمدير النظام فقط. لا يتيح السجل تعديل الأدوار أو حذف سجل سابق.</p></div></CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle>آخر تغييرات الصلاحيات</CardTitle><p className="mt-1 text-sm text-slate-500">تُعرض آخر 50 عملية مرتبة من الأحدث إلى الأقدم.</p></div><History className="h-5 w-5 text-amber-600" /></CardHeader>
        <CardContent>
          {isDenied ? <EmptyState title="هذه الصفحة مخصصة لمدير النظام" description="لا يمكن عرض سجل منح أدوار الوقود إلا ضمن صلاحية الإدارة." /> : audit.isLoading || users.isLoading ? <div className="space-y-3"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /></div> : !audit.data?.length ? <EmptyState title="لا توجد تغييرات مسجلة بعد" description="سيظهر هنا كل تغيير بعد منح أو سحب أدوار الوقود من شاشة المستخدمين." /> : <div className="space-y-3">{audit.data.map(event => {
            const beforeRoles = rolesFromSnapshot(event.beforeValue);
            const afterRoles = rolesFromSnapshot(event.afterValue);
            const target = userNameFromSnapshot(event.afterValue) ?? usersById.get(event.entityId ?? 0)?.name ?? "مستخدم غير معروف";
            const actor = usersById.get(event.actorUserId)?.name ?? `المستخدم #${event.actorUserId}`;
            return <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><UserRoundCheck className="h-4 w-4" /></div><div><p className="font-bold text-slate-900">تحديث أدوار {target}</p><p className="mt-1 text-sm text-slate-500">نفّذه {actor} · {new Date(event.createdAt).toLocaleString("ar-YE")}</p></div></div><Badge className="border-0 bg-slate-100 text-slate-700">تعديل صلاحيات</Badge></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">قبل التحديث</p><p className="mt-1 text-sm text-slate-700">{labelRoles(beforeRoles)}</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-bold text-amber-800">بعد التحديث</p><p className="mt-1 text-sm font-semibold text-amber-950">{labelRoles(afterRoles)}</p></div></div></article>;
          })}</div>}
        </CardContent>
      </Card>
    </div>
  );
}

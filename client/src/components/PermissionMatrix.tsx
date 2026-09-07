import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { permissionActionLabels, permissionCatalog, permissionKey, type PermissionAction, type PermissionSection } from "../../../shared/permissions";

type UserOption = { id: number; name: string | null; email: string | null; role: string };
type PermissionGrant = { userId: number; section: PermissionSection; resource: string; action: PermissionAction; effect: "allow" | "deny" };

const sectionLabels: Record<PermissionSection, string> = { energy: "الطاقة", fuel: "الوقود", platform: "إدارة المنصة" };
const actionOrder: PermissionAction[] = ["view", "create", "update", "delete", "assign", "approve", "print", "export"];

export default function PermissionMatrix({ users }: { users: UserOption[] }) {
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(users[0]?.id);
  const [section, setSection] = useState<PermissionSection>("energy");
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const grants = trpc.admin.permissions.list.useQuery();
  const utils = trpc.useUtils();
  const save = trpc.admin.permissions.replace.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ مصفوفة الصلاحيات وتسجيل التغيير في سجل التدقيق.");
      utils.admin.permissions.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!selectedUserId && users[0]) setSelectedUserId(users[0].id);
  }, [selectedUserId, users]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    grants.data?.filter(grant => grant.userId === selectedUserId && grant.effect === "allow").forEach(grant => {
      next[permissionKey(grant.section, grant.resource, grant.action)] = true;
    });
    setDraft(next);
  }, [grants.data, selectedUserId]);

  const rows = useMemo(() => permissionCatalog.filter(item => item.section === section), [section]);
  const selectedUser = users.find(user => user.id === selectedUserId);

  const toggle = (resource: string, action: PermissionAction) => {
    const key = permissionKey(section, resource, action);
    setDraft(current => ({ ...current, [key]: !current[key] }));
  };

  const saveDraft = () => {
    if (!selectedUserId) return;
    const permissions = permissionCatalog.flatMap(item => item.actions.filter(action => draft[permissionKey(item.section, item.resource, action)]).map(action => ({
      section: item.section,
      resource: item.resource,
      action: action as PermissionAction,
      effect: "allow" as const,
    })));
    save.mutate({ userId: selectedUserId, permissions });
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-700" />مصفوفة الصلاحيات التفصيلية</CardTitle>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">امنح كل مستخدم صلاحيات مستقلة حسب القسم والتبويب والإجراء. الصلاحية الصريحة تتقدم على الدور العام، ويمكن سحبها بإلغاء الخانة ثم الحفظ.</p>
        </div>
        <Button onClick={saveDraft} disabled={!selectedUserId || save.isPending || grants.isLoading} className="shrink-0 bg-teal-700 hover:bg-teal-800"><Save className="ml-2 h-4 w-4" />{save.isPending ? "جارٍ الحفظ..." : "حفظ الصلاحيات"}</Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">المستخدم
            <select value={selectedUserId ?? ""} onChange={event => setSelectedUserId(Number(event.target.value))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none ring-teal-500 focus:ring-2">
              {users.map(user => <option key={user.id} value={user.id}>{user.name || user.email || `مستخدم ${user.id}`}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">القسم
            <select value={section} onChange={event => setSection(event.target.value as PermissionSection)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none ring-teal-500 focus:ring-2">
              {(Object.keys(sectionLabels) as PermissionSection[]).map(value => <option key={value} value={value}>{sectionLabels[value]}</option>)}
            </select>
          </label>
        </div>
        {selectedUser && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-bold text-slate-800">الصلاحيات المخصصة لـ {selectedUser.name || selectedUser.email}</span><Badge variant="outline">الدور العام: {selectedUser.role}</Badge><span className="text-xs text-slate-500">الحفظ يطبق في الخادم ويسجل العملية.</span></div>}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[860px] w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-bold">التبويب</th>{actionOrder.map(action => <th key={action} className="px-2 py-3 text-center font-bold">{permissionActionLabels[action]}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={`${row.section}:${row.resource}`} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-bold text-slate-800">{row.label}</td>{actionOrder.map(action => { const available = (row.actions as readonly string[]).includes(action); const key = permissionKey(row.section, row.resource, action); return <td key={action} className="px-2 py-3 text-center">{available ? <input aria-label={`${row.label} - ${permissionActionLabels[action]}`} type="checkbox" checked={Boolean(draft[key])} onChange={() => toggle(row.resource, action)} className="h-4 w-4 accent-teal-700" /> : <span className="text-slate-300">—</span>}</td>; })}</tr>)}</tbody>
          </table>
        </div>
        <p className="text-xs leading-5 text-slate-500">ملاحظة: مدير النظام يحتفظ بصلاحية الإدارة الكاملة. عند عدم وجود تخصيص صريح يستمر تطبيق الدور العام الحالي، لذلك يمكن إدخال الصلاحيات تدريجيًا دون تعطيل المستخدمين الحاليين.</p>
      </CardContent>
    </Card>
  );
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, listFuelRoleAuditLogs: vi.fn(), listFuelRoleGrants: vi.fn(), listUsers: vi.fn(), replaceFuelRoleGrants: vi.fn(), updateUserRole: vi.fn() };
});

import { listFuelRoleAuditLogs, listFuelRoleGrants, replaceFuelRoleGrants } from "../db";
import { adminRouter } from "./admin";

const mockedList = vi.mocked(listFuelRoleGrants);
const mockedReplace = vi.mocked(replaceFuelRoleGrants);
const mockedAudit = vi.mocked(listFuelRoleAuditLogs);

function context(role: "admin" | "management"): TrpcContext {
  return {
    user: { id: 41, openId: "fuel-role-admin", name: "Fuel role admin", email: "admin@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}

describe("إدارة منح أدوار الوقود", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يعرض المدير منح الوقود الحالية", async () => {
    mockedList.mockResolvedValue([{ userId: 5, role: "operator", createdAt: new Date() }]);
    const caller = adminRouter.createCaller(context("admin"));
    await expect(caller.fuelRoles.list()).resolves.toEqual([{ userId: 5, role: "operator", createdAt: expect.any(Date) }]);
  });

  it("يمرر استبدال الأدوار بهوية المدير من الجلسة", async () => {
    mockedReplace.mockResolvedValue({ success: true, roles: ["accountant", "operator"] });
    const caller = adminRouter.createCaller(context("admin"));
    await expect(caller.fuelRoles.replace({ userId: 5, roles: ["operator", "accountant"] })).resolves.toEqual({ success: true, roles: ["accountant", "operator"] });
    expect(mockedReplace).toHaveBeenCalledWith({ userId: 5, roles: ["operator", "accountant"], actorUserId: 41 });
  });

  it("يعرض سجل تغييرات أدوار الوقود للمدير فقط", async () => {
    mockedAudit.mockResolvedValue([{ id: 9, actorUserId: 41, action: "replace_roles", entityType: "fuel_role_grants", entityId: 5, beforeValue: { roles: ["viewer"] }, afterValue: { roles: ["operator"], userName: "الموظف" }, reason: null, createdAt: new Date() }]);
    const caller = adminRouter.createCaller(context("admin"));
    await expect(caller.fuelRoles.audit({ limit: 20 })).resolves.toEqual([expect.objectContaining({ id: 9, entityId: 5 })]);
    expect(mockedAudit).toHaveBeenCalledWith(20);
  });

  it("يرفض عرض أو تعديل منح الوقود لغير المدير", async () => {
    const caller = adminRouter.createCaller(context("management"));
    await expect(caller.fuelRoles.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.fuelRoles.audit()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.fuelRoles.replace({ userId: 5, roles: ["viewer"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedList).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
    expect(mockedReplace).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, listPermissionGrants: vi.fn(), replaceUserPermissions: vi.fn() };
});

import { listPermissionGrants, replaceUserPermissions } from "../db";
import { adminRouter } from "./admin";

const mockedList = vi.mocked(listPermissionGrants);
const mockedReplace = vi.mocked(replaceUserPermissions);

function context(role: "admin" | "management"): TrpcContext {
  return {
    user: { id: 41, openId: "permission-admin", name: "Permission admin", email: "admin@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}

describe("إدارة مصفوفة الصلاحيات", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يعرض المدير منح الصلاحيات الحالية", async () => {
    mockedList.mockResolvedValue([{ userId: 5, userName: "الموظف", section: "energy", resource: "reports", action: "export", effect: "allow", updatedAt: new Date() }]);
    await expect(adminRouter.createCaller(context("admin")).permissions.list()).resolves.toEqual([expect.objectContaining({ userId: 5, resource: "reports", action: "export" })]);
  });

  it("يحفظ المنح مع هوية المدير من الجلسة", async () => {
    mockedReplace.mockResolvedValue({ success: true, permissions: [{ section: "energy", resource: "reports", action: "export", effect: "allow" }] });
    const permissions = [{ section: "energy" as const, resource: "reports", action: "export" as const, effect: "allow" as const }];
    await expect(adminRouter.createCaller(context("admin")).permissions.replace({ userId: 5, permissions })).resolves.toEqual(expect.objectContaining({ success: true }));
    expect(mockedReplace).toHaveBeenCalledWith({ userId: 5, permissions, actorUserId: 41 });
  });

  it("يرفض عرض أو تعديل المصفوفة لغير مدير النظام", async () => {
    const caller = adminRouter.createCaller(context("management"));
    await expect(caller.permissions.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.permissions.replace({ userId: 5, permissions: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedList).not.toHaveBeenCalled();
    expect(mockedReplace).not.toHaveBeenCalled();
  });
});

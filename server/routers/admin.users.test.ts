import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    archiveUser: vi.fn(),
    createUserInvitation: vi.fn(),
    listUsers: vi.fn(),
    setUserActive: vi.fn(),
    updateUserProfile: vi.fn(),
    updateUserRole: vi.fn(),
  };
});

import { archiveUser, createUserInvitation, listUsers, setUserActive, updateUserProfile, updateUserRole } from "../db";
import { adminRouter } from "./admin";

const mockedArchive = vi.mocked(archiveUser);
const mockedInvite = vi.mocked(createUserInvitation);
const mockedList = vi.mocked(listUsers);
const mockedActive = vi.mocked(setUserActive);
const mockedProfile = vi.mocked(updateUserProfile);
const mockedRole = vi.mocked(updateUserRole);

function context(role: "admin" | "management", id = 41): TrpcContext {
  return {
    user: { id, openId: "users-admin", name: "مدير المستخدمين", email: "admin@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}

describe("إجراءات إدارة المستخدمين بنمط ERP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يعرض قائمة المستخدمين مع الحالة", async () => {
    mockedList.mockResolvedValue([{ id: 5, name: "موظف", email: "employee@example.com", role: "user", isActive: true, createdAt: new Date(), lastSignedIn: new Date() }]);
    await expect(adminRouter.createCaller(context("admin")).users.list()).resolves.toEqual([expect.objectContaining({ id: 5, isActive: true })]);
  });

  it("يمرر الدعوة والتعديل والتوقيف والأرشفة بهوية المدير", async () => {
    mockedInvite.mockResolvedValue({ id: 10, success: true });
    mockedProfile.mockResolvedValue({ success: true });
    mockedRole.mockResolvedValue({ success: true });
    mockedActive.mockResolvedValue({ success: true, isActive: false });
    mockedArchive.mockResolvedValue({ success: true });
    const caller = adminRouter.createCaller(context("admin"));

    await caller.users.invite({ name: "موظف جديد", email: "new@example.com", role: "energy_operator" });
    await caller.users.updateProfile({ userId: 5, name: "موظف محدث", email: "updated@example.com" });
    await caller.users.setRole({ userId: 5, role: "accountant" });
    await caller.users.setActive({ userId: 5, isActive: false });
    await caller.users.archive({ userId: 5 });

    expect(mockedInvite).toHaveBeenCalledWith({ name: "موظف جديد", email: "new@example.com", role: "energy_operator", actorUserId: 41 });
    expect(mockedProfile).toHaveBeenCalledWith({ userId: 5, name: "موظف محدث", email: "updated@example.com", actorUserId: 41 });
    expect(mockedRole).toHaveBeenCalledWith({ userId: 5, role: "accountant", actorUserId: 41 });
    expect(mockedActive).toHaveBeenCalledWith({ userId: 5, isActive: false, actorUserId: 41 });
    expect(mockedArchive).toHaveBeenCalledWith({ userId: 5, actorUserId: 41 });
  });

  it("يرفض جميع إجراءات إدارة المستخدمين لغير مدير النظام", async () => {
    const caller = adminRouter.createCaller(context("management"));
    await expect(caller.users.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.invite({ name: "موظف", email: "employee@example.com", role: "user" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.updateProfile({ userId: 5, name: "موظف", email: "employee@example.com" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.setRole({ userId: 5, role: "user" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.setActive({ userId: 5, isActive: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.archive({ userId: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedList).not.toHaveBeenCalled();
    expect(mockedInvite).not.toHaveBeenCalled();
  });
});

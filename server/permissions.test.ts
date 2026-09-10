import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn(), getUserPermissionOverride: vi.fn() }));

import { router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { getDb, getUserPermissionOverride } from "./db";
import { fuelProcedureFor, granularProcedure, operationsProcedure, viewProcedure } from "./permissions";

const testRouter = router({
  read: viewProcedure.query(() => "visible"),
  write: operationsProcedure.mutation(() => "written"),
  fuelRead: fuelProcedureFor("viewer").query(() => "fuel visible"),
  settingsWrite: granularProcedure("platform", "settings", "update", "reviewer", "management").mutation(() => "settings written"),
});

const mockedGetDb = vi.mocked(getDb);
const mockedPermissionOverride = vi.mocked(getUserPermissionOverride);
const fuelDb = (roles: Array<"viewer" | "operator" | "supervisor" | "accountant" | "auditor">) => ({
  select: () => ({ from: () => ({ where: () => Promise.resolve(roles.map(role => ({ role }))) }) }),
});

function createContext(role: "admin" | "energy_operator" | "accountant" | "maintenance" | "reviewer" | "auditor" | "management", isActive = true) {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

describe("صلاحيات الخادم", () => {
  afterEach(() => vi.clearAllMocks());

  it("يسمح لمشغل الطاقة بتسجيل عمليات التشغيل", async () => {
    await expect(testRouter.createCaller(createContext("energy_operator")).write()).resolves.toBe("written");
  });

  it("يمنع دور الإدارة من تسجيل عمليات التشغيل", async () => {
    await expect(testRouter.createCaller(createContext("management")).write()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يسمح للمدقق بعرض المعلومات دون منحه صلاحية التشغيل", async () => {
    await expect(testRouter.createCaller(createContext("auditor")).read()).resolves.toBe("visible");
    await expect(testRouter.createCaller(createContext("auditor")).write()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يستخدم المنح التفصيلية للسماح بإجراء خارج الدور العام", async () => {
    mockedPermissionOverride.mockResolvedValue("allow");
    await expect(testRouter.createCaller(createContext("energy_operator")).settingsWrite()).resolves.toBe("settings written");
  });

  it("يحترم المنع الصريح حتى مع دور يسمح بالإجراء العام", async () => {
    mockedPermissionOverride.mockResolvedValue("deny");
    await expect(testRouter.createCaller(createContext("management")).settingsWrite()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يعود إلى الدور العام عند عدم وجود تخصيص تفصيلي", async () => {
    mockedPermissionOverride.mockResolvedValue(null);
    await expect(testRouter.createCaller(createContext("management")).settingsWrite()).resolves.toBe("settings written");
    await expect(testRouter.createCaller(createContext("energy_operator")).settingsWrite()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يمنع الحساب الموقوف من الإجراءات المحمية", async () => {
    await expect(testRouter.createCaller(createContext("admin", false)).read()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يفرض منح قسم الوقود حتى على أدوار الطاقة غير الإدارية", async () => {
    mockedGetDb.mockResolvedValue(fuelDb(["viewer"]) as Awaited<ReturnType<typeof getDb>>);
    await expect(testRouter.createCaller(createContext("management")).fuelRead()).resolves.toBe("fuel visible");
    mockedGetDb.mockResolvedValue(fuelDb([]) as Awaited<ReturnType<typeof getDb>>);
    await expect(testRouter.createCaller(createContext("reviewer")).fuelRead()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, getCycleById: vi.fn(), getGrantedSiteIds: vi.fn(), setCycleStatus: vi.fn() };
});

import { getCycleById, getGrantedSiteIds, setCycleStatus } from "../db";
import { energyRouter } from "./energy";

const mockedSetStatus = vi.mocked(setCycleStatus);
const mockedCycle = vi.mocked(getCycleById);
const mockedGrantedSites = vi.mocked(getGrantedSiteIds);

function context(role: "reviewer" | "accountant"): TrpcContext {
  return {
    user: { id: 31, openId: "status-test", name: "Status tester", email: "status@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}

describe("اعتماد وإقفال دورة الطاقة", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCycle.mockResolvedValue({ id: 9, siteId: 1, status: "reviewed" } as Awaited<ReturnType<typeof getCycleById>>);
    mockedGrantedSites.mockResolvedValue([1]);
  });

  it("يمرر الاعتماد إلى الخادم بهوية المراجع", async () => {
    mockedSetStatus.mockResolvedValue({ success: true });
    const caller = energyRouter.createCaller(context("reviewer"));
    await expect(caller.cycles.changeStatus({ cycleId: 9, status: "approved", reason: "تمت مطابقة الفاتورة والقراءات" })).resolves.toEqual({ success: true });
    expect(mockedSetStatus).toHaveBeenCalledWith({ cycleId: 9, status: "approved", reason: "تمت مطابقة الفاتورة والقراءات", userId: 31 });
  });

  it("يمرر الإقفال إلى الخادم بهوية المراجع", async () => {
    mockedSetStatus.mockResolvedValue({ success: true });
    const caller = energyRouter.createCaller(context("reviewer"));
    await expect(caller.cycles.changeStatus({ cycleId: 9, status: "closed", reason: "تم اعتماد نتائج الدورة" })).resolves.toEqual({ success: true });
    expect(mockedSetStatus).toHaveBeenCalledWith(expect.objectContaining({ cycleId: 9, status: "closed", userId: 31 }));
  });

  it("يرفض تغيير الحالة لدور لا يملك صلاحية المراجعة", async () => {
    const caller = energyRouter.createCaller(context("accountant"));
    await expect(caller.cycles.changeStatus({ cycleId: 9, status: "approved", reason: "محاولة دون صلاحية" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedSetStatus).not.toHaveBeenCalled();
  });

  it("يعرض رفض الانتقال غير المسموح الصادر من محرك حالة الدورة", async () => {
    mockedSetStatus.mockRejectedValue(new Error("انتقال حالة دورة الفوترة غير مسموح."));
    const caller = energyRouter.createCaller(context("reviewer"));
    await expect(caller.cycles.changeStatus({ cycleId: 9, status: "closed", reason: "إقفال قبل اعتماد" })).rejects.toThrow("غير مسموح");
  });
});

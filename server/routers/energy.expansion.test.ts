import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    getCycleById: vi.fn(),
    getGrantedSiteIds: vi.fn(),
    previewUtilityInvoice: vi.fn(),
    updateBillingCycle: vi.fn(),
    updateGenerator: vi.fn(),
    updateFuelRecord: vi.fn(),
  };
});

import { getCycleById, getGrantedSiteIds, previewUtilityInvoice, updateBillingCycle, updateFuelRecord, updateGenerator } from "../db";
import { energyRouter } from "./energy";

const mockedCycle = vi.mocked(getCycleById);
const mockedGrantedSites = vi.mocked(getGrantedSiteIds);
const mockedPreview = vi.mocked(previewUtilityInvoice);
const mockedUpdateCycle = vi.mocked(updateBillingCycle);
const mockedUpdateGenerator = vi.mocked(updateGenerator);
const mockedUpdateFuel = vi.mocked(updateFuelRecord);

function context(role: "admin" | "accountant" | "maintenance" | "energy_operator" | "management") {
  return {
    user: { id: 7, openId: "expansion-test", name: "Test", email: "test@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

describe("توسعة الفواتير والمولدات والوقود", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCycle.mockResolvedValue({ id: 11, siteId: 1, status: "data_entry" } as Awaited<ReturnType<typeof getCycleById>>);
    mockedGrantedSites.mockResolvedValue([1]);
  });

  it("يعرض معاينة التعرفة للمحاسب عبر إجراء الخادم", async () => {
    mockedPreview.mockResolvedValue({ consumptionKwh: 3727, unitRate: 220, analyticalAmount: 819940, bracket: { minKwh: 3000, maxKwh: 9999, unitRate: 220 }, tariffVersionId: 1, tariffVersionName: "التعرفة اليمنية" });
    const caller = energyRouter.createCaller(context("accountant"));
    await expect(caller.invoices.preview({ cycleId: 11, consumptionKwh: 3727 })).resolves.toMatchObject({ unitRate: 220, analyticalAmount: 819940 });
    expect(mockedPreview).toHaveBeenCalledWith({ cycleId: 11, consumptionKwh: 3727 });
  });

  it("يرفض معاينة الفاتورة لدور لا يملك صلاحية مالية", async () => {
    const caller = energyRouter.createCaller(context("energy_operator"));
    await expect(caller.invoices.preview({ cycleId: 11, consumptionKwh: 3727 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يعدل المحاسب اسم وفترة دورة قابلة للتعديل", async () => {
    mockedUpdateCycle.mockResolvedValue({ success: true });
    const caller = energyRouter.createCaller(context("accountant"));
    await expect(caller.cycles.update({ id: 11, title: "دورة النصف الأول — يناير 2026", periodStart: 1_767_225_600_000, periodEnd: 1_768_521_600_000 })).resolves.toEqual({ success: true });
    expect(mockedUpdateCycle).toHaveBeenCalledWith(expect.objectContaining({ id: 11, actorUserId: 7, title: "دورة النصف الأول — يناير 2026" }));
  });

  it("يرفض تعديل دورة مقفلة", async () => {
    mockedCycle.mockResolvedValue({ id: 11, siteId: 1, status: "closed" } as Awaited<ReturnType<typeof getCycleById>>);
    const caller = energyRouter.createCaller(context("accountant"));
    await expect(caller.cycles.update({ id: 11, title: "دورة مقفلة", periodStart: 1_767_225_600_000, periodEnd: 1_768_521_600_000 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mockedUpdateCycle).not.toHaveBeenCalled();
  });

  it("يسجل تعديل المولد بواسطة دور الصيانة مع هوية منفذ التعديل", async () => {
    mockedUpdateGenerator.mockResolvedValue({ success: true });
    const caller = energyRouter.createCaller(context("maintenance"));
    await expect(caller.generators.update({ id: 3, code: "GEN-01", name: "المولد الرئيسي", ratedKva: 500, defaultPowerFactor: 0.8, acquisitionCost: 1000000, residualValue: 0, usefulLifeMonths: 120, usefulLifeHours: 20000 })).resolves.toEqual({ success: true });
    expect(mockedUpdateGenerator).toHaveBeenCalledWith(expect.objectContaining({ id: 3, actorUserId: 7, code: "GEN-01" }));
  });

  it("يرفض تعديل المولد لدور لا يملك صلاحية الصيانة", async () => {
    const caller = energyRouter.createCaller(context("management"));
    await expect(caller.generators.update({ id: 3, code: "GEN-01", name: "المولد الرئيسي" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يسمح بتعديل بطاقة المولد حتى مع وجود دورات مقفلة لأن نتائجها تحفظ نسخة حساب مستقلة", async () => {
    mockedCycle.mockResolvedValue({ id: 11, siteId: 1, status: "closed" } as Awaited<ReturnType<typeof getCycleById>>);
    mockedUpdateGenerator.mockResolvedValue({ success: true });
    const caller = energyRouter.createCaller(context("maintenance"));
    await expect(caller.generators.update({ id: 3, code: "GEN-01", name: "المولد الرئيسي" })).resolves.toEqual({ success: true });
    expect(mockedUpdateGenerator).toHaveBeenCalled();
    expect(mockedCycle).not.toHaveBeenCalled();
  });

  it("يسجل تعديل الوقود لمشغل الطاقة في دورة قابلة للتعديل", async () => {
    mockedUpdateFuel.mockResolvedValue({ success: true });
    const caller = energyRouter.createCaller(context("energy_operator"));
    await expect(caller.fuel.update({ id: 5, cycleId: 11, generatorId: 3, transactionType: "refuel", quantityLiters: 200, unitPrice: 700, transactionAt: Date.now() })).resolves.toEqual({ success: true });
    expect(mockedUpdateFuel).toHaveBeenCalledWith(expect.objectContaining({ id: 5, cycleId: 11, actorUserId: 7 }));
  });

  it("يرفض تعديل الوقود لدور لا يملك صلاحية التشغيل", async () => {
    const caller = energyRouter.createCaller(context("management"));
    await expect(caller.fuel.update({ id: 5, cycleId: 11, generatorId: 3, transactionType: "refuel", quantityLiters: 200, unitPrice: 700, transactionAt: Date.now() })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

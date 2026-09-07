import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    createFuelInventoryClosure: vi.fn(),
    approveFuelInventoryClosure: vi.fn(),
    closeFuelInventoryClosure: vi.fn(),
  };
});

import { approveFuelInventoryClosure, closeFuelInventoryClosure, createFuelInventoryClosure } from "../db";
import { fuelRouter } from "./fuel";

const mockedCreate = vi.mocked(createFuelInventoryClosure);
const mockedApprove = vi.mocked(approveFuelInventoryClosure);
const mockedClose = vi.mocked(closeFuelInventoryClosure);

function context(): TrpcContext {
  return {
    user: { id: 17, openId: "fuel-test-admin", name: "Fuel Admin", email: "fuel@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const inventoryInput = { productId: 4, month: 1, year: 2026, meterReadingStart: 100, meterReadingEnd: 180, gaugeReadingCm: 54 };

describe("تدفق جرد الوقود عبر موجه الخادم", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ينشئ مسودة جرد بهوية صاحب الجلسة", async () => {
    mockedCreate.mockResolvedValue({ id: 71, bookBalance: 920, physicalBalance: 918, difference: -2, resultType: "shortage" });
    const caller = fuelRouter.createCaller(context());
    await expect(caller.inventory.create(inventoryInput)).resolves.toMatchObject({ id: 71, difference: -2 });
    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ ...inventoryInput, actorUserId: 17 }));
  });

  it("يرفض تعارض جرد ثانٍ للفترة كما تفرضه طبقة البيانات", async () => {
    mockedCreate.mockRejectedValue(new Error("يوجد جرد مسجل لهذا الصنف والفترة."));
    const caller = fuelRouter.createCaller(context());
    await expect(caller.inventory.create(inventoryInput)).rejects.toThrow("يوجد جرد مسجل");
  });

  it("يعتمد الجرد ثم يقفله بهوية صاحب الجلسة", async () => {
    mockedApprove.mockResolvedValue({ success: true });
    mockedClose.mockResolvedValue({ success: true });
    const caller = fuelRouter.createCaller(context());
    await expect(caller.inventory.approve({ closureId: 71 })).resolves.toEqual({ success: true });
    await expect(caller.inventory.close({ closureId: 71 })).resolves.toEqual({ success: true });
    expect(mockedApprove).toHaveBeenCalledWith({ closureId: 71, actorUserId: 17 });
    expect(mockedClose).toHaveBeenCalledWith({ closureId: 71, actorUserId: 17 });
  });

  it("يعرض رفض الإقفال قبل الاعتماد الصادر من طبقة البيانات", async () => {
    mockedClose.mockRejectedValue(new Error("لا يمكن إقفال الجرد قبل اعتماده."));
    const caller = fuelRouter.createCaller(context());
    await expect(caller.inventory.close({ closureId: 71 })).rejects.toThrow("قبل اعتماده");
  });
});

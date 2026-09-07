import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, getCycleById: vi.fn() };
});

import { getCycleById } from "../db";
import { energyRouter } from "./energy";

const mockedGetCycle = vi.mocked(getCycleById);

function context(role: "energy_operator" | "accountant") {
  return {
    user: { id: 1, openId: "energy-test", name: "Energy Test", email: "test@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

describe("إجراءات الدورة المقفلة", () => {
  beforeEach(() => {
    mockedGetCycle.mockResolvedValue({ id: 10, status: "closed" } as Awaited<ReturnType<typeof getCycleById>>);
  });

  it("يرفض إدخال قراءة عداد في دورة مقفلة", async () => {
    const caller = energyRouter.createCaller(context("energy_operator"));
    await expect(caller.meters.addReading({ cycleId: 10, meterId: 1, previousReading: 10, currentReading: 20, multiplier: 1, readAt: Date.now() })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("يرفض حفظ فاتورة في دورة مقفلة", async () => {
    const caller = energyRouter.createCaller(context("accountant"));
    await expect(caller.invoices.save({ cycleId: 10, officialAmount: 2000 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("يرفض إضافة تشغيل أو وقود في دورة مقفلة", async () => {
    const caller = energyRouter.createCaller(context("energy_operator"));
    await expect(caller.generators.addRun({ cycleId: 10, generatorId: 1, startedAt: Date.now(), endedAt: Date.now() + 3_600_000, runtimeHours: 1, measurementMode: "kwh", directKwh: 10, qualityStatus: "measured" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller.fuel.add({ cycleId: 10, generatorId: 1, transactionType: "consumption", quantityLiters: 3, unitPrice: 500, transactionAt: Date.now() })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller.fuel.update({ id: 1, cycleId: 10, generatorId: 1, transactionType: "consumption", quantityLiters: 3, unitPrice: 500, transactionAt: Date.now() })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

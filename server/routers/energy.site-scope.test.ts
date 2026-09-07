import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, getGrantedSiteIds: vi.fn(), getCycleById: vi.fn(), getCycleAnalysis: vi.fn(), listBillingCycles: vi.fn() };
});

import { getCycleAnalysis, getCycleById, getGrantedSiteIds, listBillingCycles } from "../db";
import { energyRouter } from "./energy";

const mockedGranted = vi.mocked(getGrantedSiteIds);
const mockedGetCycle = vi.mocked(getCycleById);
const mockedAnalysis = vi.mocked(getCycleAnalysis);
const mockedCycles = vi.mocked(listBillingCycles);

function context(role: "admin" | "management"): TrpcContext {
  return { user: { id: 23, openId: "site-scope", name: "مستخدم مواقع", email: "sites@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("نطاق المواقع في الطاقة", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يقصر قائمة الدورات على المواقع الممنوحة للمستخدم", async () => {
    mockedGranted.mockResolvedValue([4, 7]);
    mockedCycles.mockResolvedValue([]);
    const caller = energyRouter.createCaller(context("management"));
    await expect(caller.cycles.list()).resolves.toEqual([]);
    expect(mockedCycles).toHaveBeenCalledWith([4, 7]);
  });

  it("يمنع تحليل دورة في موقع غير ممنوح", async () => {
    mockedGranted.mockResolvedValue([4]);
    mockedGetCycle.mockResolvedValue({ id: 9, siteId: 7, status: "data_entry" } as Awaited<ReturnType<typeof getCycleById>>);
    const caller = energyRouter.createCaller(context("management"));
    await expect(caller.analysis({ cycleId: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedAnalysis).not.toHaveBeenCalled();
  });

  it("يتيح للمدير القائمة المركزية دون مرشح مواقع", async () => {
    mockedCycles.mockResolvedValue([]);
    const caller = energyRouter.createCaller(context("admin"));
    await expect(caller.cycles.list()).resolves.toEqual([]);
    expect(mockedCycles).toHaveBeenCalledWith(undefined);
  });
});

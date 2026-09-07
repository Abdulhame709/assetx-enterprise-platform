import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { settingsRouter } from "./settings";

const { mockCreateTariff, mockSaveSetting, mockListTariffs, mockGetUserPermissionOverride } = vi.hoisted(() => ({
  mockCreateTariff: vi.fn(),
  mockSaveSetting: vi.fn(),
  mockListTariffs: vi.fn(),
  mockGetUserPermissionOverride: vi.fn(),
}));

vi.mock("../db", () => ({
  createTariffVersion: mockCreateTariff,
  listTariffVersions: mockListTariffs,
  saveSettingVersion: mockSaveSetting,
  getUserPermissionOverride: mockGetUserPermissionOverride,
}));

function context(role: "admin" | "management" | "energy_operator"): TrpcContext {
  return {
    user: { id: 1, openId: "settings-test", name: "Settings tester", email: "settings@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("صلاحية إعدادات النظام", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserPermissionOverride.mockResolvedValue(null);
  });

  it("يسمح للحساب الرئيسي management بحفظ إعداد تشغيلي", async () => {
    mockSaveSetting.mockResolvedValue({ id: 22, settingKey: "default_power_factor" });
    const caller = settingsRouter.createCaller(context("management"));
    await expect(caller.versions.save({
      settingGroup: "generator",
      settingKey: "default_power_factor",
      value: { value: 0.8 },
      effectiveFrom: Date.now(),
      reason: "تحديث إعداد الاختبار",
    })).resolves.toEqual({ id: 22, settingKey: "default_power_factor" });
    expect(mockSaveSetting).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 1, settingKey: "default_power_factor" }));
  });

  it("يسمح للحساب الرئيسي management باعتماد التعرفة", async () => {
    mockCreateTariff.mockResolvedValue({ id: 23 });
    const caller = settingsRouter.createCaller(context("management"));
    await expect(caller.tariffs.createYemenDefault({ effectiveFrom: Date.now(), reason: "اعتماد التعرفة" })).resolves.toEqual({ id: 23 });
    expect(mockCreateTariff).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 1, name: "تعرفة المؤسسة اليمنية" }));
  });

  it("يرفض دور التشغيل energy_operator تعديل الإعدادات", async () => {
    const caller = settingsRouter.createCaller(context("energy_operator"));
    await expect(caller.versions.save({ settingGroup: "generator", settingKey: "default_power_factor", value: { value: 0.8 }, effectiveFrom: Date.now(), reason: "محاولة غير مخولة" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.tariffs.createYemenDefault({ effectiveFrom: Date.now(), reason: "محاولة غير مخولة" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockSaveSetting).not.toHaveBeenCalled();
    expect(mockCreateTariff).not.toHaveBeenCalled();
  });
});

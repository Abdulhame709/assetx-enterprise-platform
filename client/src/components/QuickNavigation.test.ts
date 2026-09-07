import { describe, expect, it } from "vitest";
import { getQuickNavigationItems } from "./QuickNavigation";

describe("البحث السريع للتنقل", () => {
  it("يعرض مسارات الطاقة والوقود الفعلية دون تكرار", () => {
    const items = getQuickNavigationItems("management");
    expect(items.map(item => item.path)).toEqual(expect.arrayContaining(["/energy", "/energy/reports", "/fuel", "/fuel/receipts", "/fuel/inventory"]));
    expect(new Set(items.map(item => item.path)).size).toBe(items.length);
  });

  it("يحصر سجل أدوار الوقود في قائمة مدير النظام", () => {
    expect(getQuickNavigationItems("management").some(item => item.path === "/fuel/role-audit")).toBe(false);
    expect(getQuickNavigationItems("admin").some(item => item.path === "/fuel/role-audit")).toBe(true);
  });
});

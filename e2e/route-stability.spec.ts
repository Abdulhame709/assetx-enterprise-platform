import { expect, test } from "@playwright/test";

const publicAndProtectedRoutes = [
  "/",
  "/energy",
  "/energy/cycles",
  "/energy/operations",
  "/energy/invoice-test",
  "/energy/reports",
  "/energy/alerts",
  "/energy/team-activity",
  "/energy/decisions",
  "/energy/sites",
  "/fuel",
  "/fuel/receipts",
  "/fuel/issues",
  "/fuel/inventory",
  "/fuel/role-audit",
];

test.describe("استقرار المسارات الأساسية", () => {
  for (const route of publicAndProtectedRoutes) {
    test(`يفتح ${route} دون صفحة مفقودة أو خطأ واجهة`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("#root")).not.toContainText("Page not found");
      await expect(page.locator("#root")).not.toContainText("حدث خطأ غير متوقع");
      await expect(page.getByRole("button", { name: "تسجيل الدخول" })).toBeVisible();
    });
  }
});

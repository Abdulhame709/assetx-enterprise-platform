import { expect, test } from "@playwright/test";

test.skip(Boolean(process.env.E2E_BASE_URL), "اختبار التأخير الاصطناعي للمصادقة مخصص لخادم المعاينة المحلي.");

test("يعرض هيكل تحميل منظم أثناء انتظار المصادقة", async ({ page }) => {
  await page.route("**/api/trpc/auth.me**", async route => {
    await new Promise(resolve => setTimeout(resolve, 900));
    await route.continue();
  });

  const navigation = page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("platform-loading")).toBeVisible();
  await expect(page.getByRole("status", { name: "جارٍ تجهيز مساحة العمل" })).toBeVisible();
  await navigation;
});

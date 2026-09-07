import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("تظل شاشة الدخول لمسار الوقود المحمي قابلة للاستخدام على الجوال", async ({ page }) => {
  await page.goto("/fuel/inventory", { waitUntil: "networkidle" });
  await expect(page.getByTestId("protected-route-login")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("button", { name: "تسجيل الدخول" })).toBeVisible();
  await expect(page.getByText("كل صفحة تبقى ضمن إطار واحد متسق، حتى عند فتح الرابط مباشرة.")).toBeVisible();
  const hasNoHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(hasNoHorizontalOverflow).toBe(true);
});

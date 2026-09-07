import { expect, test } from "@playwright/test";

test("تظهر طبقة انتقال للبوابة وتحترم تقليل الحركة", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".page-transition")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page.locator(".page-transition").evaluate(node => getComputedStyle(node).animationDuration);
  expect(duration).toBe("0.001s");
});

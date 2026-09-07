import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("واجهة الدخول العامة لا تحتوي مخالفات WCAG A أو AA قابلة للاكتشاف آليًا", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "ابدأ من مساحة عملك" })).toBeVisible();

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  await testInfo.attach("accessibility-scan", {
    body: JSON.stringify(scan, null, 2),
    contentType: "application/json",
  });
  expect(scan.violations).toEqual([]);
});

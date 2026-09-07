import { expect, test } from "@playwright/test";

const protectedRoutes = [
  { path: "/energy/reports", area: "الطاقة والمولدات" },
  { path: "/fuel/inventory", area: "إدارة وجرد الوقود" },
];

test.describe("هوية الدخول للمسارات المحمية", () => {
  for (const route of protectedRoutes) {
    test(`يعرض ${route.path} واجهة دخول موحّدة وملونة`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.getByTestId("protected-route-login")).toBeVisible({ timeout: 25_000 });
      await expect(page.getByRole("heading", { name: "سجّل الدخول لمتابعة العمل من حيث وصلت." })).toBeVisible();
      await expect(page.getByText(`قسم ${route.area}`)).toBeVisible();
      await expect(page.getByRole("button", { name: "تسجيل الدخول" })).toBeVisible();
      await expect(page.getByText("كل صفحة تبقى ضمن إطار واحد متسق، حتى عند فتح الرابط مباشرة.")).toBeVisible();
    });
  }
});

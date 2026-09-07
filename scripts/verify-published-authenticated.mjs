import { chromium } from "@playwright/test";
import { SignJWT } from "jose";
import { mkdir, writeFile } from "node:fs/promises";

const required = ["JWT_SECRET", "VITE_APP_ID", "OWNER_OPEN_ID", "OWNER_NAME"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const baseUrl = process.env.AUTH_VERIFY_URL ?? "https://energycosts-wtqhrhyv.manus.space";
const domain = new URL(baseUrl).hostname;
const targetPath = process.env.AUTH_VERIFY_PATH ?? "/energy";
const expectedHeadings = [
  ["/energy/alerts", "مركز التنبيهات الذكي"],
  ["/energy/team-activity", "سجل فريق المواقع"],
  ["/energy/decisions", "لوحة القرارات اليومية"],
  ["/energy/demo-report", "تقرير سيناريو بيانات التجربة"],
  ["/energy/reports", "تقارير الدورة والشهر"],
  ["/energy/sites", "المواقع والفروع والصلاحيات"],
  ["/fuel", "إدارة وجرد الوقود"],
  ["/energy", "صورة تكلفة الطاقة"],
];
const expectedHeading = process.env.AUTH_VERIFY_EXPECTED_HEADING ?? expectedHeadings.find(([prefix]) => targetPath.startsWith(prefix))?.[1];
if (!expectedHeading) throw new Error(`No verification heading configured for ${targetPath}`);
const verifyExports = process.env.VERIFY_EXPORTS === "1";
const verifyDarkTheme = process.env.VERIFY_DARK_THEME === "1";
const verifyMobile = process.env.VERIFY_MOBILE === "1";
const verifyTour = process.env.VERIFY_TOUR === "1";
const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const token = await new SignJWT({
  openId: process.env.OWNER_OPEN_ID,
  appId: process.env.VITE_APP_ID,
  name: process.env.OWNER_NAME,
})
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setExpirationTime(Math.floor(Date.now() / 1000) + 120)
  .sign(secret);

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const context = await browser.newContext({ viewport: verifyMobile ? { width: 390, height: 844 } : { width: 1366, height: 768 } });
  if (verifyTour) {
    const tourKey = targetPath === "/" ? "guided-tour-portal-v1" : targetPath.startsWith("/fuel") ? "guided-tour-fuel-v1" : "guided-tour-energy-v1";
    await context.addInitScript(key => window.localStorage.removeItem(key), tourKey);
  }
  await context.addCookies([{ name: "app_session_id", value: token, domain, path: "/", httpOnly: true, secure: true, sameSite: "None" }]);
  const page = await context.newPage();
  const outputDirectory = `/tmp/energy-cost-auth-verification/${domain}${verifyMobile ? "-mobile" : ""}`;
  await mkdir(outputDirectory, { recursive: true });
  const targetUrl = new URL(targetPath, baseUrl).toString();
  const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: expectedHeading }).waitFor({ state: "visible", timeout: 30_000 });

  if (verifyTour) {
    const tour = page.getByRole("dialog");
    await tour.waitFor({ state: "visible", timeout: 10_000 });
    if (targetPath === "/") {
      if (!(await tour.getByText("مرحبًا بك في المنصة الموحدة").isVisible())) throw new Error("Portal guided tour did not open");
    } else if (!(await tour.getByText("هذه هي قائمة العمل").isVisible())) {
      throw new Error("Workspace guided tour did not open");
    }
    await tour.getByText("تخطي الجولة", { exact: true }).click();
    await tour.waitFor({ state: "hidden", timeout: 5_000 });
    if (targetPath !== "/") {
      await page.getByRole("button", { name: "إعادة الجولة الإرشادية" }).click();
      await tour.waitFor({ state: "visible", timeout: 5_000 });
      await tour.getByRole("button", { name: "التالي" }).click();
      if (!(await tour.getByText("ابحث عن أي صفحة بسرعة").isVisible())) throw new Error("Workspace guided tour did not advance");
    }
  }

  if (verifyDarkTheme) {
    await page.getByRole("button", { name: "تفعيل الوضع الداكن" }).click();
    await page.locator("html").waitFor({ state: "attached" });
    const darkEnabled = await page.locator("html").evaluate(node => node.classList.contains("dark"));
    if (!darkEnabled) throw new Error("Dark theme did not activate");
  }

  if (verifyExports) {
    if (targetPath === "/energy/reports") {
      await page.locator("tbody tr").first().waitFor({ state: "visible", timeout: 30_000 });
    }
    const excelDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /Excel/ }).click();
    const excel = await excelDownload;
    if (!excel.suggestedFilename().endsWith(".xlsx")) throw new Error("Excel export did not create an XLSX file");
    await excel.saveAs(`${outputDirectory}/${excel.suggestedFilename()}`);
    const pdfDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /PDF/ }).click();
    const pdf = await pdfDownload;
    if (!pdf.suggestedFilename().endsWith(".pdf")) throw new Error("PDF export did not create a PDF file");
    await pdf.saveAs(`${outputDirectory}/${pdf.suggestedFilename()}`);
  }

  const protectedLoginVisible = await page.getByTestId("protected-route-login").isVisible().catch(() => false);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: `${outputDirectory}/energy-authenticated.png`, fullPage: false });
  await writeFile(`${outputDirectory}/result.json`, JSON.stringify({
    targetUrl,
    status: response?.status() ?? null,
    title: await page.title(),
    path: targetPath,
    darkThemeChecked: verifyDarkTheme,
    mobileViewportChecked: verifyMobile,
    exportsChecked: verifyExports,
    guidedTourChecked: verifyTour,
    protectedLoginVisible,
    hasHorizontalOverflow: overflow,
    verifiedAt: new Date().toISOString(),
  }, null, 2));

  if (protectedLoginVisible || overflow) throw new Error("Published authenticated dashboard failed visual stability checks");
  console.log(`Authenticated dashboard verification passed for ${domain}`);
} finally {
  await browser.close();
}

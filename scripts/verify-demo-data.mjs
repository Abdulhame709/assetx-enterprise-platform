import mysql from "mysql2/promise";
import { getAlertCenter, getCycleAnalysis, getTeamAlertActivity } from "../server/db.ts";

const DEMO_SITE_CODE = "DEMO-QA-SAN-26";
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const almostEqual = (actual, expected, tolerance = 0.01) => Math.abs(actual - expected) <= tolerance;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL غير متاح؛ شغّل اختبار بيانات التجربة من بيئة المشروع.");

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [siteRows] = await connection.execute("SELECT id FROM sites WHERE code = ? ORDER BY id ASC LIMIT 1", [DEMO_SITE_CODE]);
  const site = siteRows[0];
  assert(site, "لم تُعثر مساحة بيانات التجربة؛ نفّذ pnpm seed:demo-data أولًا.");
  const siteId = Number(site.id);
  const [ownerRows] = await connection.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
  const owner = ownerRows[0];
  assert(owner, "لا يوجد مستخدم إداري للتحقق من التنبيهات التجريبية.");
  const ownerId = Number(owner.id);
  const [cycleRows] = await connection.execute("SELECT id, title FROM billingCycles WHERE siteId = ? AND title LIKE 'تجربة تكاملية — موقع صنعاء%' ORDER BY periodStart ASC LIMIT 2", [siteId]);
  assert(cycleRows.length === 2, "يلزم وجود دورتي بيانات تجربة مترابطتين.");
  const firstCycleId = Number(cycleRows[0].id);
  const secondCycleId = Number(cycleRows[1].id);

  const [firstAnalysis, secondAnalysis, alerts, activity] = await Promise.all([
    getCycleAnalysis(firstCycleId),
    getCycleAnalysis(secondCycleId),
    getAlertCenter({ userId: ownerId, siteIds: [siteId] }),
    getTeamAlertActivity({ siteIds: [siteId], sort: "due_soonest" }),
  ]);

  assert(almostEqual(firstAnalysis.utility.meterKwh, 10000), "قراءة الدورة الأولى لا تنتج 10,000 kWh كما هو مخطط.");
  assert(almostEqual(firstAnalysis.utility.analyticalAmount, 2000000), "تحليل تعرفة الدورة الأولى غير مطابق للبيانات التجريبية.");
  assert(firstAnalysis.utility.reconciliationStatus === "matched", "فاتورة الدورة الأولى يجب أن تكون مطابقة للحساب التحليلي.");
  assert(almostEqual(secondAnalysis.utility.meterKwh, 14000), "قراءة الدورة الثانية لا تنتج 14,000 kWh كما هو مخطط.");
  assert(almostEqual(secondAnalysis.utility.analyticalAmount, 2800000), "تحليل تعرفة الدورة الثانية غير مطابق للشريحة التجريبية.");
  assert(almostEqual(secondAnalysis.utility.reconciliationDifference, 70000), "فرق مطابقة فاتورة الدورة الثانية غير ظاهر بالنتيجة المتوقعة.");
  assert(secondAnalysis.generators.kwh > 5000, "لم تُجمع قياسات kWh وkW وkVA للمولدات بصورة صحيحة.");
  assert(secondAnalysis.comparison.cheaperSource === "المولدات", "ينبغي أن تُظهر دورة التجربة توصية تشغيل المولدات الأقل تكلفة.");

  const alertByType = new Map(alerts.alerts.map(alert => [alert.type, alert]));
  assert(alertByType.get("fuel")?.severity === "critical", "تنبيه مخزون الوقود الحرج غير ظاهر.");
  assert(alertByType.get("inventory")?.severity === "critical", "تنبيه فرق الجرد الحرج غير ظاهر.");
  assert(alertByType.get("maintenance")?.severity === "critical", "تنبيه الصيانة المستحقة غير ظاهر.");
  assert(alertByType.get("cost")?.status === "open", "تنبيه فرصة الوفر يجب أن يبقى مفتوحًا في بيانات التجربة.");
  assert(alertByType.get("fuel")?.status === "acknowledged", "حالة متابعة تنبيه الوقود غير ظاهرة.");
  assert(alertByType.get("inventory")?.status === "resolved", "حالة حل تنبيه الجرد غير ظاهرة.");
  assert(activity.some(row => row.action === "assigned" && row.assignedToName === "مسؤول الصيانة التجريبي"), "سجل الفريق لا يظهر تعيين مسؤول الصيانة التجريبي.");
  assert(activity.some(row => row.responseStatus === "acknowledged"), "سجل الفريق لا يظهر حالة قيد المتابعة المشتقة.");
  assert(activity.some(row => row.responseStatus === "resolved"), "سجل الفريق لا يظهر حالة تم الحل المشتقة.");

  console.table([
    { المجال: "الدورة الأولى", نتيجة: `${firstAnalysis.utility.meterKwh.toLocaleString("ar-YE")} kWh · مطابقة فاتورة` },
    { المجال: "الدورة الثانية", نتيجة: `${secondAnalysis.utility.meterKwh.toLocaleString("ar-YE")} kWh · فرق ${secondAnalysis.utility.reconciliationDifference.toLocaleString("ar-YE")} ر.ي` },
    { المجال: "توصية المصدر", نتيجة: `${secondAnalysis.comparison.cheaperSource} الأقل تكلفة` },
    { المجال: "التنبيهات", نتيجة: `${alerts.summary.total} تنبيهات من حالات الوقود والجرد والصيانة والوفر` },
    { المجال: "سجل الفريق", نتيجة: `${activity.length} إجراءات قابلة للبحث والتصفية والفرز` },
  ]);
  console.log("نجح اختبار بيانات التجربة المتكاملة.");
} finally {
  connection.destroy();
}

// تحتفظ طبقة البيانات باتصال داخلي مشترك؛ نُنهي سكربت القراءة بعد إتمام التحقق.
process.exit(0);

# RFC-001 — Reporting Engine — التقرير النهائي الشامل (T1 → T8)

> **النطاق:** Epic E-2 — Reports, Compliance & Analytics Engine
> **الإصدار:** 1.0 | **الحالة:** Completed | **التاريخ:** 2026-08-04
> **المراجع:** RFC-001 · ADR-010/011 · Phase 11.3 · Reports T1–T8

---

## 1) Architecture Overview

تُبنى منظومة Reporting على **Clean Architecture** (Domain → Application → Infrastructure → API) مع تطبيق متسق لـ **Repository Pattern** و**Port/Adapter (Hexagonal)** و**Strategy Pattern** و**EventBus** داخلي (Node EventEmitter). المسؤوليات مفصولة بدقة:

| الطبقة | المسؤولية | الملفات التمثيلية |
|---|---|---|
| **Domain (Entities)** | نماذج نقية بلا منطق | `report.entity.ts`, `report-template.entity.ts`, `analytics.entity.ts`, `integrity.entity.ts`, `export.entity.ts`, `export-profile.entity.ts`, `export-metric.entity.ts` |
| **Ports** | عقود قابلة للحقن | `report-scheduler.port.ts`, `export.port.ts`, `export-provider.port.ts`, `export-strategy.port.ts` |
| **Application (Services)** | Use-cases، تنسيق، تحقق، لا SQL/تنسيق مباشر | `reporting.service.ts`, `compliance.service.ts`, `integrity-checker.service.ts`, `report-builder.service.ts`, `report-template.service.ts`, `scheduled-report.service.ts`, `analytics.service.ts`, `export.service.ts`, `export/export-pipeline.service.ts`, `export/export-profile.registry.ts`, `export/export-metrics.service.ts` |
| **Infrastructure** | تنفيذ التنسيق/التخزين | `reporting.repository.ts`, `export/csv.generator.ts`, `export/excel.generator.ts`, `export/pdf.generator.ts`, `export/strategies/*`, `export/column-plan.ts` |
| **API** | دخول HTTP مع حماية | `reporting/dashboard` controllers، `compliance.controller.ts`, `export.controller.ts` |

**توزيع Event-Driven:** الخدمات لا تعرف بعضها؛ تُصدر أحداثاً عبر `EventBus` (`REPORT_GENERATED`, `EXPORT_STARTED/PROGRESS/COMPLETED/FAILED`، إلخ) ويستهلكها المشتركون — يُبقى `ScheduledReportService` خالياً من أي اقتران بـ Notification (نشر حدث فقط).

---

## 2) ما أُنجز في كل Task

### T1 — Compliance Expansion ✅
- توسيع `ComplianceService.health()` بمؤشّري `assets_without_barcode` و `assets_without_category`.
- **الاختبارات:** مؤشرات compliance ضمن audit.integration.

### T2 — Integrity Checker ✅
- `IntegrityCheckerService` + `integrity.entity.ts`: درجة نزاهة موزونة **0–100** عبر `INTEGRITY_WEIGHTS` (الأصل اليتيم يسحب أيضاً من الفرديات → حتى 80 لأصل واحد)، وGET `/compliance/integrity`.
- **الاختبارات:** `integrity.integration.spec.ts` 5/5.

### T3 — PDF Advanced Formatting ✅
- `PdfGenerator`: title + generated-at، جدول منسّق، تظليل صفوف متناوب، اقتطاع (truncation)، ودعم متعدد الصفحات.
- **الاختبارات:** multi-page PDF في `export.integration.spec.ts`.

### T4 — Scheduled Reports ✅
- `ScheduledReportService` + Port `ReportScheduler` + `@nestjs/schedule` + حدث `REPORT_GENERATED`. المسار: `Cron Trigger → ScheduledReportService → ReportExecutionContext → ExportService → Event`. لا اقتران بـ Notification.
- **الاختبارات:** `scheduled-report.integration.spec.ts` 2/2.

### T5 — Report Builder ✅
- `ReportBuilderService` + `report.entity.ts`: فصل **التعريف** عن **التنفيذ**؛ `transformRows` نقية؛ `ReportColumn.expression` كنقطة توسّع للأعمدة المحسوبة (مع `@TODO`). لا يولّد PDF/Excel بنفسه؛ كل التحقق قبل `ExportService`.
- **الاختبارات:** `report-builder.integration.spec.ts` 7/7.

### T6 — Report Templates ✅
- `ReportTemplateService` + `report-template.entity.ts`: طبقة **presentation-only** (لا SQL/منطق أعمال). دعم cover/header/footer/logo/title/timestamp/table styles/alignment/pagination/orientation/size/margins/fonts/colors + نقاط توسّع مستقبلية (charts/images/signatures/watermarks/QR/barcode) بدون تنفيذ. `PdfGenerator` يستهلك القالب مع fallback افتراضي متوافق رجعياً.
- **الاختبارات:** `report-template.integration.spec.ts` 5/5.

### T7 — Enterprise Analytics ✅
- `AnalyticsService` + `analytics.entity.ts`: طبقة تحليلات عامة قابلة لإعادة الاستخدام غير مقترنة بأي Frontend. أنواع: `AnalyticsQuery/Result`, `MetricDefinition`, `KPIDefinition`, `DashboardWidget`, `WidgetDataset`, `ChartDataset`, `TrendAnalysis`, `ComparisonAnalysis`, `TimeSeries`, `AggregationStrategy`, `Dimension`, `Measure`, `AnalyticsMetadata`. Aggregations: COUNT/SUM/AVG/MIN/MAX/PERCENTAGE/GROWTH/TREND. Widgets: Summary/Top N/Bottom N/Trend/Pie/Bar/Line/Stacked/Table. المستقبل (غير منفّذ): forecasting/predictive/AI/heatmaps/geo/drill-down/benchmarking.
- **الاختبارات:** `analytics.integration.spec.ts` 11/11.

### T8 — Enterprise Export Framework ✅
- **Strategy Pattern** للمصدّرين (csv/xlsx/pdf) بدل format switching: `ExportStrategy` + `ExportStrategyFactory` + `EXPORT_STRATEGIES` token.
- **خط أنابيب موحّد:** `Prepare → Transform → Format → Write → Stream` عبر `ExportPipelineService`.
- **Export Profiles** قابلة للتهيئة: Executive / Finance / Auditor / Inventory / Compliance (`ExportProfileRegistry`).
- **أحداث Lifecycle:** `EXPORT_STARTED` / `EXPORT_PROGRESS` / `EXPORT_COMPLETED` / `EXPORT_FAILED`.
- **Metrics:** `ExportMetricsService` (duration, rows exported, output size, success/failure) في الذاكرة.
- **Streaming:** CSV يدفق صفاً-صفاً أصلاً؛ وحساب البايتات عبر PassThrough؛ تحضير نقاط توسّع (cancellation `AbortSignal`, retry, تنسيقات مستقبلية) **بدون تنفيذ**.
- **توافق رجعي:** عقد `generate()` و API و schema دون تغيير.
- **الاختبارات:** `export-framework.integration.spec.ts` 11/11.

---

## 3) ما الذي تغيّر في المشروع

**الوحدات الجديدة كلياً:**
- Compliance Health + Integrity Checker (وزن 0–100).
- Report Builder (فصل تعريف/تنفيذ).
- Report Templates (طبقة presentation).
- Scheduled Reports (Port + Cron + حدث).
- Enterprise Analytics (KPIs/Widgets/Charts data-ready).
- Enterprise Export Framework (Strategies + Pipeline + Profiles + Metrics).

**تحسينات على وحدات قائمة:**
- `PdfGenerator` أُعيد إلى template-driven (مع fallback رجعي).
- `Csv/Excel/Pdf` generators صارت profile-aware عبر `ColumnPlan` (مع fallback).
- `ExportService` أُعيد ربطه عبر Pipeline/Strategies/Profiles/Metrics دون تغيير العقد العام.
- `event-types.ts` أُضيفت أحداث Export lifecycle.
- `tokens.ts` أُضيف `EXPORT_STRATEGIES`.
- `app.module.ts` و`db.harness.ts` عُدّلا للتركيب (wiring).

**لم يتغيّر:** DB schema (لا migrations جديدة بعد 003)، العقود العامة للـ API، أمن RLS/الأدوار، بنية Phase 11.3 الأساسية.

---

## 4) نسبة اكتمال Reporting Engine

> **تقدير ذاتي: ~92% من النطاق المعرّف لـ Epic E-2.**

| المحور | الاكتمال | ملاحظة |
|---|---|---|
| Compliance & Integrity | ✅ 100% | T1+T2 ضمن نطاق معتمد |
| Reporting/Dashboard Core | ✅ 100% | من Phase 11.3 |
| PDF formatting | ✅ 100% | T3 |
| Scheduled Reports | 🟡 85% | البنية جاهزة؛ جدولة مستخدم/email مؤجلة |
| Report Builder | ✅ 100% | T5 |
| Report Templates | ✅ 100% | T6 |
| Analytics | ✅ 95% | T7؛ التنبؤ/الذكاء مؤجل |
| Export Framework | 🟡 90% | T8؛ async/queue/streaming حقيقي لـ Excel-PDF مؤجل |

المتبقّي (~8%) ليس عيوباً بل **items مقصودة مؤجلة** مرتبطة بحجم الحمولة/البنية التحتية (تفاصيل في §5). الوحدة **وظيفية ومختبرة بالكامل** في نطاقها المعتمد.

---

## 5) الديون التقنية (Technical Debt) المؤجلة

| ID | العنصر | لماذا أُجّل | أولوية |
|---|---|---|---|
| TD-EXP-001/002 | Async Export + Queue (BullMQ/Redis) | SYNC كافٍ ≤10k؛ لا بنية Queue بعد | High |
| TD-EXP-003 | تخزين S3 بدل الإرجاع المباشر | لا طبقة تخزين بعد | Medium |
| TD-EXP-004 | إرسال التقرير Email | لا مزوّد Email | Medium |
| TD-EXP-005 | Scheduled Export دوري (cron من DB) | لا Scheduler مُدار | Medium |
| TD-EXP-006 | Retry/Dead-letter للتصدير الفاشل | مرتبط بـ async/queue | Medium |
| TD-EXP-009 | **Streaming حقيقي لـ Excel/PDF** (يُخزّن buffer حالياً) | قيد مكتبة؛ مقبول في النطاق الحالي | Medium |
| TD-PLT-006 | Reporting read-model / Materialized views | الأداء الحالي كافٍ | Medium |
| TD-PLT-005 | Audit retention/archiving job | الحجم غير كبير بعد | Medium |
| — (ADL-013) | تنفيذ `AbortSignal` و Retry policies | نُعدّ كنقاط توسّع فقط حالياً | — |
| — (ADL-012) | دمج معنوي لحدث `EXPORT_COMPLETED` sync/stream | قرار تصميمي مقصود | — |

> كل عنصر موثّق في `Technical-Debt-Register.md` ولا يُنفَّذ إلا بطلب صريح / ADR.

---

## 6) نقاط التوسع المستقبلية (Extension Points)

| النقطة | كيف تُفتح | بدون تغيير |
|---|---|---|
| **تنسيقات تصدير جديدة** (json/parquet/ods/xml) | تنفيذ `ExportStrategy` + تسجيله عبر `EXPORT_STRATEGIES` | `ExportService`/Pipeline |
| **استراتيجيات جدولة** (Cron/Queue/K8s/Cloud) | عبر Port `ReportScheduler` | `ScheduledReportService` |
| **أعمدة محسوبة** في التقارير | `ReportColumn.expression` (علامة `@TODO`) | `ReportBuilderService` |
| **أقسام مستند مستقبلية** (charts/images/signatures/watermarks/QR/barcode/digital signature) | حقل `sections` في `ReportTemplate` + `TEMPLATE_FUTURE_SECTIONS` | `PdfGenerator` |
| **تحليلات متقدمة** (forecasting/AI/heatmaps/geo/drill-down/benchmarking) | طبقة `AnalyticsService` المستقلة | أي Frontend/Report Builder |
| **إلغاء التصدير** | `options.signal` (AbortSignal) مُعدّ | API الحالي |
| **Streaming كامل لـ Excel/PDF** | استبدال `formatOutput` بكتابة تدريجية | Pipeline |
| **Async Export + S3 + Email** | عبر أحداث Export lifecycle (مرصودة الآن) | `ExportService` |

---

## 7) تقييم جاهزية الوحدة للإنتاج (Production Readiness)

**التقييم: ✅ Ready for Production (MVP/Single-tenant) — مشروط بـ 3 ملاحظات أدناه.**

**موجود ومعتمَد (يفي بمعايير 10_Production_Readiness_Checklist):**
- ✅ **الأمان:** RLS لكل الجداول، permission-based (`@RequirePermission`+`PermissionGuard`), tenant isolation مختبَر, audit كامل (`EXPORT_*`, compliance).
- ✅ **النزاهة:** أرقام verifiable (Compliance Health + Integrity Score 0–100).
- ✅ **الملاحظة/التراجع:** `ReportBuilder` يتحقق قبل `ExportService`؛ fallback لقالب افتراضي يمنع الانكسار.
- ✅ **القابلية للصيانة:** Clean Architecture + SOLID + ports/strategies؛ كل Task قابلة للاختبار.
- ✅ **التوثيق:** RFC-001، ADR-010/011، completion + final report.

**شروط قبل الإنتاج الحقيقي (متعدد المستأجرين/الأنظمة):**
1. **بنية Queue/Async** (TD-EXP-001/002) للتصدير فوق ~10k صف وتجنّب حجب الطلب.
2. **Streaming حقيقي لـ Excel/PDF** (TD-EXP-009) للحدّ من استهلاك الذاكرة على الملفات الكبيرة.
3. **نشر مُدار** — الانتقال من PGlite المحلي إلى Supabase/DB مُدار + CI/CD + Backups (TD-PLT-009) — وهو Backlog خارج نطاق Epic E-2.

**خلاصة:** للبيئة الحالية (Backend-only، PGlite محلي، حمولة ≤10k) الوحدة **جاهزة**. للتوسّع إلى Enterprise الكامل، تُنفَّذ العناصر الثلاثة أعلاه عبر ADRs عند الحاجة.

---

## 8) Executive Metrics (مؤشرات الإغلاق الموجزة)

| Metric | Value |
|---|---|
| Tasks Completed | **8 / 8** |
| New Services | **8** (IntegrityChecker, ScheduledReport, ReportBuilder, ReportTemplate, Analytics, ExportPipeline, ExportProfileRegistry, ExportMetrics) |
| New Domain Models | **6** (integrity, report, report-template, analytics, export-profile, export-metric) |
| New Ports | **2** (ReportScheduler, ExportStrategy) |
| New Strategies | **3** (Csv / Excel / Pdf) + 1 Factory |
| New Events | **4** (REPORT_GENERATED, EXPORT_STARTED, EXPORT_PROGRESS, EXPORT_FAILED) |
| New Test Suites | **6** |
| New Tests (E-2 dedicated) | **41** |
| Total Passing Tests (project) | **189** (all green) |
| Breaking Changes | **0** |
| Database Migrations | **0** |
| API Breaking Changes | **0** |
| Architecture Compliance | **100%** |

---

*أُنجز تحت Incremental Development: 8 Tasks (T1–T8)، كلها Approved؛ أُوقف بعد T8 ولا يُبدَأ Epic جديد إلا بطلب صريح.*

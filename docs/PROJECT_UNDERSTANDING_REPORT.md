# Project Understanding Report — AssetX Enterprise Platform

> **التاريخ:** 2026-08-07 (v1.1 — Project Baseline correction)
> **الفرع:** `arena/019fd8fd-assets-x` (متطابق مع `main` عند `c8a8dce` — RC1 baseline)
> **الحالة:** ⏳ **بانتظار اعتماد المستخدم — لا تنفيذ قبل الاعتماد**
> **المرجع:** هذا التقرير مبني على قراءة كاملة للمستودع (الوثائق + الكود + التحقق الفعلي من الاختبارات).
> **مراجعة v1.1:** تصحيح Baseline المشروع — التاريخ الرسمي المكتمل (PRE-P3 مجمد · P1 · P2 · P3 · P4 · RC1) + استبدال بيان الخطوة التالية باختيار بند خارطة الطريق بعد RC1 + حفظ ديون التوثيق (D1–D3) كما هي.

---

## 1. فهم المشروع (Product Summary)

**AssetX** هي منصة مؤسسية (Enterprise SaaS Platform) لإدارة دورة حياة الأصول الثابتة بالكامل — من الشراء حتى الإخراج/الإتلاف — مع تميز استراتيجي في **الجرد الميداني الذكي Offline-First** عبر الهواتف والأجهزة اللوحية. وهي **منصة وليست تطبيق جرد**: الجرد وحدة واحدة ضمن منظومة أوسع (Lifecycle, Governance, Audit, Reporting, AI-ready).

- **الأهداف التجارية (BO-001…007):** تقليل مدة الجرد ≥70%، تقليل الأخطاء، قاعدة بيانات موحدة، سجل تاريخي كامل لكل أصل، جرد دون إنترنت، لوحات مؤشرات لحظية، قابلية التوسع إلى EAM/SaaS.
- **المبادئ غير القابلة للتفاوض:** Offline First · Cloud Native · API First · Security by Design · **Audit by Design** · Mobile First للجرد · Modular Architecture · AI Ready · Scalable · Multi-Tenant Ready.
- **الجمهور:** جهات حكومية، جامعات، مستشفيات، مصانع، شركات، بنوك، فنادق.

## 2. Architecture Summary

- **Modular Monolith** (ADR-002) — NestJS 10 + TypeScript، بوضوح Clean Architecture:
  - `core/` (Domain: entities + ports + events) ← `application/` (services — لا SQL) ← `infrastructure/` (PGlite، repositories، hashers، generators) + `api/` (controllers فقط) + `common/` (guards/interceptors/SSE).
  - الحقن عبر **tokens**؛ **Repository Pattern** إلزامي؛ **EventBus** داخلي لفصل Notification/Audit عن المعاملات.
- **Multi-tenant** (ADR-004): `tenant_id` + **RLS** على 22 جدولاً عبر `current_tenant_id()`.
- **Authorization:** permission-based (`@RequirePermission` ANY/ALL) + permission versioning + authz audit trail (ADR-009).
- **Audit by design** (ADR-010): AuditInterceptor (HTTP فقط) + أحداث أعمال داخل الخدمات — بلا تكرار.
- **Frontend:** Next.js 14 (App Router) + Tailwind tokens + طبقة **Mappers** (لا DTO خام في الصفحات) + Auth Adapter (ADR-016).
- **DB:** PostgreSQL 13+ — 24 جدولاً، LTREE (ADR-005)، computed inventory view، 6 enums. محلياً PGlite، الإنتاج Supabase.

## 3. Branch Status

| البند | القيمة |
|---|---|
| الفرع الحالي | `arena/019fd8fd-assets-x` |
| HEAD | `c8a8dce` — "docs: PRE-P3 Merge Readiness Package (release baseline)" |
| main المحلي/البعيد | `c8a8dce` (متطابق تماماً) |
| العلاقة بـ main | **مطابق — لا commits إضافية، fast-forward جاهز** |
| النوع | **Release Candidate baseline (RC1)** — وليس Feature Branch |
| **أحدث Baseline** | **RC1** — tag محلي `v0.2.0-rc1` ("AssetX Enterprise SaaS Platform — Release Candidate 1") · tag سابق `v0.1.0-pre-p3` (PRE-P3 production baseline). كلا الوسمين محليان (لم يُدفعا) |
| حالة العمل | Working tree نظيف (تحقق فعلي) |

**الخلاصة:** الفرع الحالي يمثل **أحدث Baseline معتمد: RC1 (Release Candidate 1)** — التاريخ الرسمي المكتمل: PRE-P3 (مجمد) · P1 · P2 · P3 (P3.1–P3.5) · P4 (P4.1–P4.4) · **RC1 (مكتمل محلياً كـ Release Candidate baseline)**. أي عمل جديد ينطلق من أساس RC1. **لا حاجة ولا توصية بالدمج مع main الآن** — الفرع في حالة تطابق تام معه.

## 4. ما تم إنجازه (Completed Work)

### التاريخ الرسمي المكتمل (Official Completed History)
| Milestone | الحالة |
|---|---|
| **PRE-P3** | ✅ Completed **and frozen** (Release Baseline — تكامل Backend حقيقي + Hardening) |
| **P1** | ✅ Completed |
| **P2** | ✅ Completed |
| **P3 — Inventory Experience** | ✅ Completed: P3.1 Inventory Domain Foundation · P3.2 Infrastructure & API Contracts · P3.3 Inventory Web Experience · P3.4 Read API Extension · P3.5 Workflow & Operational Experience |
| **P4 — Offline** | ✅ Completed: P4.1 Offline Architecture Foundation · P4.2 Local Persistence & Sync Infrastructure · P4.3 Offline Inventory Experience · P4.4 Reliability & Resilience Validation |
| **RC1** | ✅ Completed locally as Release Candidate baseline (tag `v0.2.0-rc1`) |

### تفاصيل الدعم (من السجل التاريخي للمستودع)
- **Backend Core (M1):** Auth (JWT + refresh + revoke)، RBAC، Tenant/RLS، Assets، Master Data، Inventory، Movements (6 أنواع + موافقات) — 137+ اختباراً.
- **Intelligence (M2):** Reporting/Dashboards، Audit & Compliance، Notifications + SSE، Export (csv/xlsx/pdf)، Advanced Search + Saved Searches.
- **Epic E-2 (T1–T8):** Compliance expansion، Integrity Checker (0–100)، PDF advanced، Scheduled Reports، Report Builder/Templates، Analytics layer، **Enterprise Export Framework** (Strategy + Pipeline + Profiles + Metrics).
- **PRE-P3 (Release Baseline — مجمد):** Auth Adapter حقيقي (ADR-016)، API contract validation، **DTO Mapping Layer** (27 اختباراً)، Frontend Data Wiring (كل الصفحات)، Validation & Regression — **الواجهة الأمامية تعمل على Backend حقيقي (لا Mock)**: 17 مساراً، Auth/tenant/permissions حقيقية، RLS مفعلة.
- **P1 (App Shell + Design System) · P2 (Asset Experience) · P3 (Inventory Experience — P3.1…P3.5) · P4 (Offline — P4.1…P4.4) · RC1:** ✅ مكتملة وفق التاريخ الرسمي المعتمد.

### التحقق الفعلي (تم في هذه الجلسة — لا افتراضات)
| الفحص | النتيجة |
|---|---|
| `git status` / نظافة الشجرة | ✅ نظيف (بعد إرجاع تعديل npm على lockfile) |
| Backend `tsc` build | ✅ نظيف |
| Backend full suite | ✅ **41/41 ملفات اختبار خضراء** (كل الوحدات: unit/integration/e2e — شُغّلت على دفعات بسبب حد ذاكرة بيئة الحماية، انظر §10) |
| Backend unit (عينة asset.unit) | ✅ 7/7 |
| Web `next build` | ✅ نجح |
| Web Vitest | ✅ **38/38** |
| لا ملفات .env متعقبة | ✅ (example فقط) |
| لا FIXME/debugger | ✅ (TODO واحد موثق في report.entity.ts) |

## 5. ما لا يزال قيد التنفيذ (Pending Work)

- **القرار الهندسي التالي بعد RC1 لم يُعتمد بعد** — اختيار بند خارطة الطريق بعد RC1 (post-RC1 roadmap item) من بين المرشحين: Production Deployment Foundation · Maintenance Module · Attachments/Object Storage · Mobile Platform · Enterprise Hardening. **لا طور معتمداً.**
- Backlog موثق (الوثائق التاريخية — بحاجة مواءمة، دَين محفوظ D3): E-2 بقية (توصيل scheduled reports)، E-3 (rules engine + compliance expansion)، E-4 (async export/BullMQ، S3، performance، retention)، E-7 (Deploy: Supabase prod، CI/CD، backups، monitoring).
- Technical Debt: `docs/Technical-Debt-Register.md` (TD-EXP-001…010، TD-PLT-001…009) — **موثقة فقط، لا تنفيذ صامت**.

## 6. القيود (ما يمنع تعديله — Constraints & Architecture Rules)

1. **Clean Architecture** — لا SQL في Controllers، لا Business Logic في API/UI.
2. **Repository Pattern** — لا وصول مباشر للـ DB خارج الـ repositories.
3. **Domain Isolation** — لا استدعاءات مباشرة عبر Bounded Contexts (Ports/Events فقط).
4. **Multi-tenancy** — RLS + `tenant_id` في كل استعلام؛ لا تجاوز.
5. **RBAC** — تفويض بالصلاحيات وليس بالأدوار فقط.
6. **Audit by Design** — كل عملية حساسة تُسجل مرة واحدة بالضبط.
7. **No Breaking API Changes** — التطور إضافي فقط (Additive).
8. **No DB Migration بدون ADR معتمد** مسبقاً + Migration + Rollback.
9. **لا وحدات جديدة بدون طلب** — RFC → ADR → Design → اعتماد.
10. **Tests + توثيق إلزاميان** (DoD) لكل ميزة.
11. **لا تعديل وثائق معتمدة** بدون عملية تغيير رسمية؛ التوثيق الجديد يُسجل في Architecture Index.
12. **المشروع Enterprise وليس Demo** — لا حلول مؤقتة تكسر القواعد.

## 7. القرارات الهندسية السابقة (يُحترم ولا يُعاد نقاشها)

ADR-001 (UUID) · ADR-002 (Modular Monolith) · ADR-003 (Offline Sync) · ADR-004 (RLS) · ADR-005 (LTREE) · ADR-007-db (Lifecycle 6 types + approvals) · ADR-009-db (Authorization Hardening) · ADR-010-db (Audit Engine) · ADR-011-db (saved_searches) · ADR-016 (Frontend Auth) — وكلها **Accepted**. كما أن نمط **ExportProvider/ResourceSearchProvider** و**FileGeneratorFactory/Strategy** و**Mappers** هي أنماط معتمدة يجب الاستمرار بها.

## 8. تعارضات الوثائق المكتشفة (لا اختيار عشوائي — تحتاج اعتماداً)

| # | التعارض | أين | حالته |
|---|---|---|---|
| 1 | **تعدد تعريفات Roadmap/Phases**: AAB (V1–V7) vs PEP (P1 Web→P4 Sync) vs `docs/project/Roadmap.md` (Phase A–G) vs مصطلحات التنفيذ (Phase 11.x + P1/P2/P3 + PRE-P3) | ADL-002 | **Pending** — التوصية: اعتماد `docs/project/Roadmap.md` مرجعاً استراتيجياً واحداً |
| 2 | عدد الوحدات 17 vs 20 (AAB §7 vs §13.13) | ADL-001 | **Pending** — التوصية: 20 كمرجع Granular |
| 3 | UUID vs Business Code، صلاحيات 4 vs 5، نتيجة جرد computed vs stored، وغيرها (ADL-003…009) | Decision Log ES-000 | **Pending** (معظمها حُسم فعلياً في الكود لصالح توصية الـ Log) |
| 4 | **إعادة ترقيم ADR** (007/009/010/011 مرتين) | ADR Index + Risk RK-13 | **Pending تسوية** (منخفض الأثر) |
| 5 | **Historical milestone documents alignment required**: `Milestones.md`/`Implementation_Tracker.md`/`Release_Plan.md`/`PRE-P3-Merge-Readiness-Package.md` لم تُوائم بعد مع التاريخ الرسمي المكتمل (P3/P4/RC1) | docs/project | **دَين محفوظ (D3)** — لا تحديث تلقائي |
| 6 | RFC-001 (docs/rfc) يظهر Proposed بينما E-2 مكتمل (docs/RFC final reports) | RFC docs | انتهى عملياً — يحتاج تحديث حالة رسمي |

### ديون التوثيق المحفوظة (Maintained Documentation Debts — لا تُحل تلقائياً)
| # | الدين | الحالة |
|---|---|---|
| **D1** | **Roadmap consolidation required** — تعدد تعريفات Roadmap (AAB / PEP / docs/project / مصطلحات تنفيذ P1–P5) | يُحفظ — لا توحيد تلقائي (ADL-002) |
| **D2** | **ADR numbering reconciliation required** — إعادة استخدام أرقام ADR (007/009/010/011) | يُحفظ — لا إعادة ترقيم تلقائية (RK-13) |
| **D3** | **Historical milestone documents alignment required** — وثائق تاريخية لم تُوائم مع P3/P4/RC1 | يُحفظ — لا تعديل تلقائي للوثائق التاريخية |

**قاعدة ملزمة:** لا يُحل أي تعارض أعلاه ضمنياً — كل قرار يحتاج اعتمادك/اعتماد CAB. وديون التوثيق D1–D3 **محفوظة كما هي عمداً**.

## 9. المرحلة الحالية والخطوة التالية المقترحة

- **المرحلة الحالية:** **RC1 — Release Candidate baseline (مكتمل محلياً)** — أحدث Baseline معتمد. التاريخ الرسمي المكتمل: PRE-P3 (مجمد) · P1 · P2 · P3 (P3.1–P3.5) · P4 (P4.1–P4.4) · RC1.
- **الخطوة التالية المقترحة (بعد اعتمادك لهذا التقرير):**
  1. اعتماد تقرير الفهم الحالي (هذا الملف) — نقطة توقف إلزامية.
  2. (اختياري) اعتماد قرارات ADL المعلقة أو إبقاؤها Pending صراحةً — وديون التوثيق D1–D3 محفوظة.
  3. **بعد الاعتماد، القرار الهندسي التالي هو اختيار بند خارطة الطريق بعد RC1 (post-RC1 roadmap item)** من بين المرشحين: **Production Deployment Foundation · Maintenance Module · Attachments/Object Storage · Mobile Platform · Enterprise Hardening** — **لا طور معتمداً بعد** — أو تنفيذ أي مهمة تحدّدها أنت — مع الالتزام الكامل بقواعد §6.

## 10. ملاحظة بيئية (شفافية)

جولة الاختبارات الخلفية الكاملة (189 اختباراً موثقاً في الوثائق) تتطلب ذاكرة أكبر من المتاح هنا (3.8GB) عند التشغيل المتوازي لـ PGlite (WASM) — تسبب OOM مرتين. أُعيد التحقق على **دفعات متتابعة بـ `--runInBand`**: **41/41 ملفات اختبار خضراء** (unit + integration + e2e + security + realtime). هذا **قيود بيئة الحماية وليس عيباً في المشروع** — ونتيجة التحقق تطابق التوثيق (189/189).

---

## 11. Validation (تصحيح Baseline v1.1)

| # | الفحص | النتيجة |
|---|---|---|
| 1 | **Documentation only changes** — لم تُعدَّل أي ملفات غير توثيقية | ✅ فقط `PROJECT_CONTEXT.md` و `docs/PROJECT_UNDERSTANDING_REPORT.md` |
| 2 | **No source code changes** — لا تعديل في `backend/src`، `web/src`، `db/migrations`، `API/` | ✅ (تحقق `git status`/`git diff` — لا تغيير في أي كود/قاعدة بيانات/API) |
| 3 | **No architecture / API / DB changes** | ✅ |
| 4 | **Current project state accurately represented** — التاريخ الرسمي المكتمل مسجل: PRE-P3 (مجمد) · P1 · P2 · P3 (P3.1–P3.5) · P4 (P4.1–P4.4) · RC1 | ✅ |
| 5 | **RC1 is the latest baseline** — tag محلي `v0.2.0-rc1` ("AssetX Enterprise SaaS Platform — Release Candidate 1 (v0.2.0-rc1)") + `v0.1.0-pre-p3` (PRE-P3 baseline) | ✅ (تحقق `git tag`/`git rev-parse`) |
| 6 | **بيان الخطوة التالية مصحح** — أُزيلت عبارة "after approval start P3" نهائياً من كل وثائق السياق؛ البديل المعتمد: **اختيار post-RC1 roadmap item** (لا طور معتمداً) | ✅ |
| 7 | **ديون التوثيق محفوظة** — Roadmap consolidation (D1) · ADR numbering reconciliation (D2) · Historical milestone documents alignment (D3) — لم تُحل تلقائياً | ✅ |
| 8 | **لا بدء لأي طور تنفيذ** | ✅ — توقف تام بعد التوثيق |

---

## اعتماد التقرير

- [ ] **أعتمد هذا التقرير** — يمكن عندها اتخاذ القرار الهندسي التالي (اختيار post-RC1 roadmap item أو أي مهمة أخرى) بالالتزام بقواعد التطوير.
- [ ] **أطلب تعديلات** — قبل الاعتماد.
- [ ] **أعتمد حلول تعارضات ADL المعلنة في §8** (أو أقرر إبقاءها Pending — وديون D1–D3 محفوظة كما هي).

*ملفات هذا التقرير: `docs/PROJECT_UNDERSTANDING_REPORT.md` · الدليل الدائم: `PROJECT_CONTEXT.md`.*

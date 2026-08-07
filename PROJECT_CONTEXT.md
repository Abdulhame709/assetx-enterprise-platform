# 📌 PROJECT_CONTEXT.md — AssetX Enterprise Platform

> **Document Type:** Permanent AI/Engineer Context Handoff Document (companion to `AssetX_README (3).md` — the Master Context Document)
> **Version:** 1.1 | **Status:** Approved Baseline (requires CAB/TRB approval of updates)
> **Date:** 2026-08-07
> **Revision v1.1 (2026-08-07):** Project Baseline corrected — official completed history (PRE-P3 frozen · P1 · P2 · P3 · P4 · RC1) recorded; next-step statement replaced with post-RC1 roadmap selection. Documentation debts (roadmap consolidation, ADR numbering reconciliation, historical milestone documents alignment) intentionally maintained, not solved.
> **Usage:** أي محادثة جديدة تبدأ بـ: *"اقرأ PROJECT_CONTEXT.md وجميع الوثائق المرتبطة به، ثم أنشئ Project Understanding Report قبل تنفيذ أي مهمة."*

---

## 1. ما هو AssetX؟ (Vision)

**AssetX** هي منصة مؤسسية متكاملة (Enterprise SaaS Platform) لإدارة **دورة حياة الأصول الثابتة بالكامل** — من الشراء حتى الإخراج/الإتلاف — مع تركيز استراتيجي على **الجرد الميداني الذكي Offline-First** عبر الهواتف والأجهزة اللوحية.

- **الرؤية:** أن تصبح المنصة المرجعية لإدارة الأصول الثابتة والجرد الذكي في المؤسسات (حكومة، جامعات، مستشفيات، مصانع، شركات).
- **الرسالة:** تقليل الفاقد والأخطاء التشغيلية وتحويل الجرد من إجراءات ورقية إلى عمليات رقمية ذكية.
- **التصنيف:** منصة مؤسسية (وليست "تطبيق جرد") — الجرد وحدة واحدة ضمن منظومة Lifecycle & Governance.

### الأهداف التجارية (Business Objectives — BO-001…007)
| الرمز | الهدف |
|---|---|
| BO-001 | تقليل مدة الجرد السنوي ≥ 70% |
| BO-002 | تقليل الأخطاء البشرية أثناء الجرد |
| BO-003 | قاعدة بيانات موحدة لكل الأصول |
| BO-004 | سجل تاريخي كامل لكل أصل (Lifecycle + Audit) |
| BO-005 | جرد يعمل دون اتصال (Offline First) |
| BO-006 | لوحات مؤشرات لحظية للإدارة العليا |
| BO-007 | قابلية التوسع إلى EAM متكامل ثم SaaS |

### مبادئ المنتج غير القابلة للتفاوض (Product Principles)
Offline First · Cloud Native · API First · Security by Design · **Audit by Design** · Mobile First للجرد · Modular Architecture · AI Ready · Scalable · Multi-Tenant Ready.

---

## 2. الحالة الحالية (Current State — 2026-08-07)

| البند | الحالة |
|---|---|
| Backend (NestJS) | ✅ مكتمل — 23 وحدة خدمية، Clean Architecture، 189 اختباراً (unit/integration/e2e) |
| Web (Next.js 14) | ✅ مكتمل — P1 (App Shell) · P2 (Asset Experience) · P3 (Inventory Web Experience) · مبني على Backend حقيقي (لا Mock في الوضع real) |
| Database | ✅ 24 جدولاً + RLS + LTREE + computed inventory view (PGlite محلياً، Supabase/Postgres للإنتاج) |
| **المرحلة الحالية** | **RC1 — Release Candidate baseline (اكتمل محلياً — tag `v0.2.0-rc1`)** — أحدث Baseline معتمد |
| التوثيق | نظام ES-000.5 (Architecture Index) + قرارات معلقة (ADL) — انظر §8 |

### التاريخ الرسمي المكتمل (Official Completed History)
| Milestone | الحالة |
|---|---|
| **PRE-P3** | ✅ Completed **and frozen** (Release Baseline — تكامل Backend حقيقي + Hardening) |
| **P1** | ✅ Completed |
| **P2** | ✅ Completed |
| **P3 — Inventory Experience** | ✅ Completed: P3.1 Inventory Domain Foundation · P3.2 Infrastructure & API Contracts · P3.3 Inventory Web Experience · P3.4 Read API Extension · P3.5 Workflow & Operational Experience |
| **P4 — Offline** | ✅ Completed: P4.1 Offline Architecture Foundation · P4.2 Local Persistence & Sync Infrastructure · P4.3 Offline Inventory Experience · P4.4 Reliability & Resilience Validation |
| **RC1** | ✅ Completed locally as Release Candidate baseline (tag `v0.2.0-rc1`) |

### ما تم إنجازه (Completed)
- **M1/M2 — Backend Core + Intelligence:** Auth (JWT + refresh + revoke) · RBAC (permission-based + permission versioning) · Multi-tenant (RLS) · Assets CRUD · Master Data · Inventory cycles/records/results · Movements (6 أنواع + موافقات) · Reporting/Dashboards · Audit & Compliance · Notifications + SSE · Export (csv/xlsx/pdf) · Advanced Search + Saved Searches · Rules/Workflow Engine · Integrity Checker.
- **Epic E-2 (Reporting & Compliance Engine):** T1–T8 — compliance expansion، integrity score، PDF advanced، scheduled reports، report builder/templates، analytics layer، Enterprise Export Framework (Strategy + Pipeline + Profiles + Metrics).
- **PRE-P3 (Release Baseline — مجمد):**
  - PRE-P3.1 — Frontend Auth Adapter (JWT decode + `/tenant/current` + token-store + 401-refresh-retry + session recovery) — ADR-016.
  - PRE-P3.2.1 — API Contract Validation.
  - PRE-P3.2.2 — DTO Alignment & Mapping Layer (27 اختباراً).
  - PRE-P3.2.3 — Frontend Data Wiring (كل الصفحات عبر Mappers — لا DTO خام في الصفحات).
  - PRE-P3.2.4 — Validation & Regression (GO).
- **P1 — App Shell + Design System:** ✅ مكتمل (أساس الواجهة الأمامية).
- **P2 — Asset Experience:** ✅ مكتمل.
- **P3 — Inventory Experience:** ✅ مكتمل (P3.1 Inventory Domain Foundation · P3.2 Infrastructure & API Contracts · P3.3 Inventory Web Experience · P3.4 Read API Extension · P3.5 Workflow & Operational Experience).
- **P4 — Offline:** ✅ مكتمل (P4.1 Offline Architecture Foundation · P4.2 Local Persistence & Sync Infrastructure · P4.3 Offline Inventory Experience · P4.4 Reliability & Resilience Validation).
- **RC1 — Release Candidate 1:** ✅ مكتمل محلياً كـ Release Candidate baseline (tag `v0.2.0-rc1`) — أحدث Baseline.

### ما لم يُنفَّذ بعد (Pending)
- **القرار الهندسي التالي بعد RC1 لم يُعتمد بعد** — الاختيار من بين الأطوار المرشحة (انظر §13): Production Deployment Foundation · Maintenance Module · Attachments/Object Storage · Mobile Platform · Enterprise Hardening. **لا طور معتمداً.**
- Backlog موثق (الوثائق التاريخية بحاجة مواءمة — دَين محفوظ، انظر §8): E-2 بقية (scheduled reports delivery، custom templates) · E-3 (rules engine notifications) · E-4 (async export/BullMQ، S3، performance، retention) · E-7 (Deploy: Supabase prod، CI/CD، backups).
- Tech debt الكامل: `docs/Technical-Debt-Register.md` (TD-EXP-001…010، TD-PLT-001…009).

---

## 3. العمارة (Architecture Summary)

### القرارات المعمارية الجوهرية (ADRs المختصرة — التفاصيل في `db/ADR-*.md` و`docs/project/Architecture_Decision_Index.md`)
| ADR | القرار | الحالة |
|---|---|---|
| ADR-001 | **UUID** للمفاتيح التقنية (وليست IDENTITY) | ✅ Accepted |
| ADR-002 | **Modular Monolith** أولاً (وليس Microservices) | ✅ Accepted |
| ADR-003 | Offline Sync Strategy | ✅ Accepted |
| ADR-004 | **Multi-Tenant: `tenant_id` + RLS** | ✅ Accepted |
| ADR-005 | **Materialized Path / LTREE + GIN** للمواقع الهرمية | ✅ Accepted |
| ADR-007 (db) | تمديد دورة حياة الأصل: 6 أنواع حركة + حالة موافقة (pending/approved/rejected) — Migration 002 | ✅ Accepted |
| ADR-009 (db) | **Authorization Hardening**: permission versioning + authz audit trail + ANY/ALL guard | ✅ Accepted |
| ADR-010 (db) | **Audit & Compliance Engine** (audit_events + catalog + interceptor + no duplicate events) | ✅ Accepted |
| ADR-011 (db) | **جدول `saved_searches`** (Migration 003) | ✅ Accepted |
| ADR-016 | **Frontend Auth Integration** (Adapter، JWT decode، localStorage — httpOnly مستقبلاً) | ✅ Accepted |
| ADR-006…015 (AAB) | Observability، Backup، Integration، Governance، Monitoring، Event Bus، Cost، AI، Release، DR | ✅ Accepted (استراتيجيات — انظر AAB §11AC/11AD) |

> ⚠️ **ملاحظة:** ترقيم ADR معاد استخدامه جزئياً (007/009/010/011 ظهرت مرتين في الفهرس) — بند تسوية موثّق في Decision Log ولا يُحل صامتاً.

### طبقات Clean Architecture (إلزامية)
```
api/            → Controllers فقط (لا Business Logic، لا SQL)
application/    → Services (Use-cases؛ لا SQL، لا HTTP details)
core/           → Domain: entities + ports (عقود) + events + constants
infrastructure/ → تنفيذ الـ Ports: PGlite DB، repositories، hashers، generators
common/         → Guards (auth/rbac/tenant/permission) · interceptors · sse
bootstrap/      → db-init، seeds (permissions/notifications)
```
- **حقن بالـ tokens** (`DATABASE_PORT`، `PASSWORD_HASHER`، `TOKEN_MANAGER`، `EXPORT_PROVIDERS`…) — Domain لا يعرف Infrastructure.
- **Repository Pattern** إلزامي — لا SQL خارج الـ repositories.
- **EventBus** داخلي (Node EventEmitter) — الأحداث تفصل Notification/Audit/Analytics عن المعاملات (ADR-011 AAB).

### Stack
- **Backend:** NestJS 10 + TypeScript + PGlite (PostgreSQL WASM) + JWT + bcryptjs + exceljs/pdfkit + @nestjs/schedule.
- **Web:** Next.js 14 (App Router) + React 18 + Tailwind (design tokens) + lucide-react + Vitest — لا مكتبة State خارجية (SessionProvider Context).
- **DB:** PostgreSQL 13+ (RLS، LTREE، computed view `v_inventory_result`) — الإنتاج: Supabase.

---

## 4. هيكل المستودع (Folder Structure)

```
ASSETS-X/
├── README.md                        → Product README (تعريف مختصر)
├── AssetX_README (3).md             → DOC-01 Master Context Document (المرجع السياقي الشامل)
├── PROJECT_CONTEXT.md               → هذا الملف (Context Handoff الدائم)
├── AssetX-Architecture-Bible/       → AAB (المرجع الرسمي — 01-Executive/000_Project_Charter)
├── Requirements/                    → PRD (DOC-05) · FRS (DOC-06) · NFR (DOC-07)
├── Architecture/                    → SAD (DOC-08)
├── Database/                        → DDS (DOC-09)
├── API/                             → API_Specification.md (DOC-10 — العقد المعتمد)
├── Mobile/ · UI-UX/ · Security/ · Testing/ · DevOps/ · Operations/
├── Administration/ · User_Guides/   → أدلة الاستخدام
├── Engineering-Specifications/      → ES-000 Decision Log · ES-000.5 Architecture Index · 01 Entities · 02 Business Rules · 04 Data Dictionary
├── Execution/                       → PEP — Project Execution Plan
├── docs/
│   ├── architecture/                → 1_Principles … 10_Production_Readiness (Engineering Handbook)
│   ├── project/                     → Roadmap · Milestones · Backlog · Release Plan · Tracker · ADR Index · Traceability · Risks
│   ├── rfc/ + RFC/                  → RFC-001 (Reporting Engine) + التقارير النهائية
│   ├── PRE-P3-Merge-Readiness-Package.md  → ⭐ وثيقة تاريخية (PRE-P3) — المواءمة مع RC1 دَين محفوظ (D3)
│   ├── Technical-Debt-Register.md
│   └── *.md                         → Advanced Search specs، Phase 11.3 report
├── db/
│   ├── migrations/                  → 001_init.sql · 002_movement_lifecycle.sql · 003_saved_searches.sql
│   ├── seed/001_seed.sql · verification/verify.sql · spec/ERD.mmd
│   └── ADR-*.md                     → ADRs التنفيذية (007/009/010/011/016)
├── backend/                         → NestJS (Clean Architecture) — v0.1.0
└── web/                             → Next.js — v0.1.0
```

---

## 5. الواجهة الخلفية (Backend Overview)

- **البوابة:** `main.ts` (CORS + HttpExceptionFilter) → `app.module.ts` (Composition Root).
- **المسارات الرئيسية:** `/auth/*`، `/users/*`، `/tenant/current`، `/assets*`، `/inventory/*`، `/movements*`، `/lifecycle*`، `/dashboard/*`، `/compliance/*`، `/audit/*`، `/notifications*` (+ `/notifications/stream` SSE)، `/exports/{resource}?format=`، `/search/{resource}` + `/saved-searches`، `/employees|locations|categories|models`، `/analytics`، `/administration` (users/roles/permissions/tenants).
- **الأمان:** AuthGuard (JWT + permission version) → TenantGuard (`app.tenant_id` → RLS) → PermissionGuard (`@RequirePermission` — ANY/ALL) → AuditInterceptor (API_REQUEST) → AuditService (أحداث أعمال داخل Application Services فقط — بلا تكرار).
- **التشغيل المحلي:** `npm run build && npm start` على المنفذ 3001 (env: `PORT`، `CORS_ORIGIN`، `JWT_*_SECRET`).
- **الاختبار:** `NODE_OPTIONS="--experimental-vm-modules" npm test` (jest — PGlite يتطلب experimental-vm-modules). 189 اختباراً موثقاً.
- **ملاحظة أداء البيئة الحالية:** الجولة الكاملة للاختبارات تتطلب ذاكرة كافية (PGlite WASM) — يُفضّل `--runInBand` على البيئات منخفضة الذاكرة.

---

## 6. الواجهة الأمامية (Frontend Overview)

- **المسارات (17):** `/login` + `/` (redirect) + 12 وحدة (dashboard, assets, assets/[id], assets/dashboard, inventory, movements, audit, compliance, reports, search, analytics, administration, maintenance) داخل AppShell.
- **طبقات البيانات:** `lib/api/client.ts` (Bearer auto + 401-refresh-retry) → `features/*/api.ts` → **Mappers** (تطبيع الاستجابة — لا DTO خام في الصفحات) → صفحات/مكونات.
- **الجلسة:** `lib/auth/` — auth-adapter (JWT decode + `/tenant/current`) · token-store · session-context · permissions (مطابقة `@RequirePermission`).
- **الأوضاع:** `NEXT_PUBLIC_AUTH_MODE=mock` (عرض P1 فقط) أو `real` (الافتراضي — Backend حقيقي). `NEXT_PUBLIC_API_URL` (افتراضي `/api`).
- **الاختبار:** `npm test` (Vitest 38 اختباراً) · البناء: `npm run build` (output: standalone — منفذ 3000).
- **القيود المعتمدة:** التصميم Token-driven في `globals.css` · لا مكتبة State خارجية · كل صفحة عبر مكونات `components/ui/*`.

---

## 7. قاعدة البيانات (Database Overview)

- **24 جدولاً** في `db/migrations/001_init.sql`: users، roles، permissions، role_permissions، tenants، organizations، assets، categories، locations (LTREE)، asset_models، employees، inventory_cycles/records (+ computed view)، asset_movements، notifications (+templates)، audit_events، saved_searches، settings، workflows، rules، reports، report_templates، exports…
- **6 enums:** cycle_status · inventory_result · location_type · movement_type (6 قيم) · notification_channel · tenant_status.
- **الأعمدة القياسية في كل جدول أعمال:** `id UUID PK` · `tenant_id NOT NULL` · `created_at/updated_at` · `created_by/updated_by` · `is_active`.
- **RLS:** 22 جدولاً محمياً — العزل عبر `current_tenant_id()` (ADR-004).
- **قاعدة ثابتة:** أي تغيير Schema يتطلب **ADR معتمد قبل الـ Migration** (قاعدة حاكمة — لا استثناء).

---

## 8. القرارات المعلقة (Pending Conflicts — لا تُحل بدون اعتماد)

| ID | التعارض | ملخص |
|---|---|---|
| ADL-001 | عدد الوحدات 17 vs 20 (AAB §7 vs §13.13) | الاقتراح: اعتماد 20 كمرجع Granular مع خريطة ربط |
| ADL-002 | **Roadmap متعدد التعريفات** (AAB V1–V7 / PEP P1–P4 / docs/project Phase A–G) | الاقتراح: توحيد على `docs/project/Roadmap.md` |
| ADL-003 | UUID (تقني) vs Business Code (عرض/بحث/طباعة) | الاقتراح: `id`=UUID · `asset_code`=Business Code |
| ADL-004 | مواقع legacy (FullPath) vs LTREE | LTREE يبقى canonical + خريطة ترحيل |
| ADL-005 | الصلاحيات 4 vs 5 (إضافة CanPrint) | الاقتراح: اعتماد 5 |
| ADL-006 | نتيجة الجرد computed vs stored | computed تبقى canonical |
| ADL-007 | Soft-delete semantics موحدة | بانتظار قرار |
| ADL-008 | UNIQUE دورات الجرد لكل Tenant | الاقتراح: `(tenant_id, year)` |
| ADL-009 | PII field-level handling | بانتظار قرار |
| ADL-G01…G07 | فجوات توثيق (Data Dictionary كامل، Business Rules Catalog، Offline Sync protocol، Error Codes، File Storage، Config/Flags، فهرس موحد) | معظمها أُنجز جزئياً (01/02/04 موجودة) |
| ADR numbering | إعادة استخدام 007/009/010/011 | بند تسوية — Risk RK-13 (منخفض) |

### ديون التوثيق المحفوظة (Maintained Documentation Debts — لا تُحل تلقائياً)
> **القاعدة:** الديون الثلاثة التالية **محفوظة كما هي عمداً** — لا يُنفَّذ أي حل تلقائي لها دون اعتماد صريح:

| # | الدين | الحالة |
|---|---|---|
| D1 | **Roadmap consolidation required** — تعدد تعريفات Roadmap (AAB V1–V7 / PEP P1–P4 / docs/project Phase A–G / مصطلحات تنفيذ P1–P5) | يُحفظ — لا توحيد تلقائي (مرتبط بـ ADL-002) |
| D2 | **ADR numbering reconciliation required** — إعادة استخدام أرقام ADR (007/009/010/011 في الفهرس) | يُحفظ — لا إعادة ترقيم تلقائية (مرتبط بـ Risk RK-13) |
| D3 | **Historical milestone documents alignment required** — وثائق تاريخية (Milestones.md، Implementation_Tracker.md، Release_Plan.md، PRE-P3-Merge-Readiness-Package.md) لم تُوائم بعد مع التاريخ الرسمي المكتمل (P3/P4/RC1) | يُحفظ — لا تعديل تلقائي للوثائق التاريخية |

**القاعدة:** لا يُحل أي ADL صامتاً — يُرجع إليه بالمعرّف ويُنتظر اعتماد CAB/TRB (انظر ES-000). وديون التوثيق الثلاثة (D1–D3) لا تُحل تلقائياً.

---

## 9. الفرع الحالي وهدفه (Branch Status)

- **الفرع الحالي:** `arena/019fd8fd-assets-x` — فرع عمل الجلسة (Session Working Branch) عند **RC1 Release Candidate baseline**.
- **علاقته بـ main:** متطابق تماماً مع `main` (`c8a8dce` — "docs: PRE-P3 Merge Readiness Package (release baseline)") — لا commits إضافية، قابل للـ fast-forward.
- **أحدث Baseline:** **RC1** — `v0.2.0-rc1` (annotated tag محلي: "AssetX Enterprise SaaS Platform — Release Candidate 1 (v0.2.0-rc1)") مع `v0.1.0-pre-p3` (PRE-P3 production baseline). كلا الوسمين محليان (لم يُدفعا).
- **النوع:** Release Candidate baseline (وليس Feature Branch) — يمثل **أحدث أساس مجمد** يجب أن ينطلق منه أي عمل جديد.
- **الهدف:** قاعدة مستقرة يتم من بعدها **اختيار بند خارطة الطريق التالي بعد RC1** (لا يوجد طور معتمد بعد).
- **قاعدة:** لا دمج إلى `main` قبل التحقق من الجاهزية واعتماد المستخدم.

---

## 10. خارطة الطريق (Roadmap — مرجع استراتيجي موثق: `docs/project/Roadmap.md`)

> ⚠️ **دَين محفوظ D1:** Roadmap consolidation required — لا توحيد تلقائي للمصادر المتعددة. الجدول أدناه انعكاس للحالة الرسمية المكتملة فقط.

| Phase | التركيز | الحالة |
|---|---|---|
| **Phase A** | Backend Core + Intelligence | ✅ Done |
| **Phase B** | Reporting Enhancements + Automation (E-2) | ✅ Done (T1–T8) |
| **Phase C** | Production Hardening (async export، performance، retention) | ⏳ مرشح/Backlog — غير معتمد |
| **Phase D** | Web Frontend | ✅ Done — P1 (Shell) · P2 (Asset Experience) · P3 (Inventory Web Experience) + PRE-P3 |
| **Phase E** | Mobile + Offline | ✅ P4 Offline Done (P4.1–P4.4) — منصة Mobile نفسها مرشح لاحق غير معتمد |
| **Phase F** | Deploy & Ops (v1.0) | ⏳ مرشح (Production Deployment Foundation) — غير معتمد |
| **Phase G** | SaaS (billing، integrations) | ⏳ Backlog |

**خريطة الواجهة الأمامية (مصطلحات التنفيذ):** P1 (App Shell) ✅ → P2 (Asset Experience) ✅ → **P3 (Inventory Experience) ✅ (P3.1–P3.5)** → P4 (Offline) ✅ (P4.1–P4.4) → **RC1 ✅ (baseline)** → الأطوار اللاحقة قيد الاختيار (لا شيء معتمد بعد).

---

## 11. قواعد التطوير (Development Rules — إلزامية)

1. **Clean Architecture** — لا SQL في Controllers، لا Business Logic في API/UI.
2. **Repository Pattern** — لا وصول مباشر للـ DB خارج الـ repositories.
3. **Domain Isolation** — لا استدعاءات مباشرة بين Bounded Contexts (عبر Ports/Events فقط).
4. **Multi-tenancy** — `tenant_id` + RLS في كل استعلام — لا تجاوز أبداً.
5. **RBAC** — تفويض بالصلاحيات (`@RequirePermission`)، ليس بالدور فقط.
6. **Audit by Design** — كل عملية حساسة تُسجل مرة واحدة (لا تكرار: Interceptor لـ HTTP فقط، والخدمات لأحداث الأعمال).
7. **No Breaking API Changes** — التطور إضافي (additive) داخل Major Version.
8. **No DB Migration بدون ADR معتمد** مسبقاً + Migration + خطة Rollback.
9. **لا وحدات جديدة بدون طلب** — إضافة أي وحدة/ميزة كبرى تمر بـ RFC → ADR → Design → Approval.
10. **Tests** — unit/integration/e2e لكل ميزة (DoD).
11. **التوثيق إلزامي** — RFC/ADR/Design/Completion + تحديث Backlog/Tracker/Traceability.
12. **Technical Debt** — يسجل في `docs/Technical-Debt-Register.md` ولا يُنفذ صامتاً.
13. **المشروع Enterprise Product وليس Demo** — لا حلول مؤقتة "سريعة" تكسر القواعد أعلاه.
14. **عدم تعديل وثائق معتمدة** بدون عملية تغيير (CAB/TRB) — والتعديلات الجديدة تسجل في Architecture Index (ES-000.5).

---

## 12. الوثائق المرتبطة (Must-Read قبل أي مهمة)

| الأولوية | الوثيقة |
|---|---|
| 1 | هذا الملف + `docs/PROJECT_UNDERSTANDING_REPORT.md` (حالة RC1 الحالية) |
| 2 | `docs/PRE-P3-Merge-Readiness-Package.md` (مرجع تاريخي — PRE-P3، مواءمته مع RC1 دَين محفوظ D3) |
| 3 | `docs/architecture/1_Architecture_Principles.md` + `2_Architecture_Governance.md` |
| 4 | `Engineering-Specifications/00_Documentation_Audit_Decision_Log.md` + `00.5_Architecture_Index.md` |
| 5 | `docs/project/Roadmap.md` + `Project_Backlog.md` + `Release_Plan.md` (وثائق تاريخية — دَين D1/D3) |
| 6 | `db/README.md` + ADRs ذات الصلة بالمهمة |
| 7 | `docs/Technical-Debt-Register.md` + `docs/project/Architecture_Decision_Index.md` |

---

## 13. الخطوة التالية المقترحة (Next Step)

1. **اعتماد Project Understanding Report** (الموجود في `docs/PROJECT_UNDERSTANDING_REPORT.md`).
2. **حسم تعارضات ADL المعلقة** أو إبقاؤها Pending بشكل صريح (لا تُحل صامتاً) — وديون التوثيق D1–D3 محفوظة كما هي.
3. **بعد الاعتماد، القرار الهندسي التالي هو اختيار بند خارطة الطريق بعد RC1** (post-RC1 roadmap item).

### الأطوار المرشحة بعد RC1 (Possible Next Phases — لا طور معتمداً بعد)
| المرشح | ملاحظات |
|---|---|
| **Production Deployment Foundation** | النشر والإنتاج (Supabase prod، CI/CD، backups، monitoring) — Phase F |
| **Maintenance Module** | وحدة الصيانة |
| **Attachments/Object Storage** | المرفقات والتخزين الخارجي |
| **Mobile Platform** | منصة الجوال (بعد اكتمال أساس Offline في P4) |
| **Enterprise Hardening** | تقوية مؤسسية (async export، performance، retention…) |

> **قاعدة:** **لا طور معتمداً بعد** — أي بدء لأي طور يتطلب قراراً صريحاً قبل التنفيذ.

---

*Last updated: 2026-08-07 (v1.1 — Baseline correction) · Companion to `AssetX_README (3).md` (DOC-01) — لا يغني عنها ولا يعدلها.*

# 📦 AssetX — Enterprise Asset Lifecycle Platform

> **وثيقة تسليم السياق (Context Handoff Document)**
> انسخ هذا الملف بالكامل والصقه في بداية أي دردشة جديدة لتبدأ بناء وتصميم المنصة بفهم كامل للمشروع.

---

## 1. ما هو AssetX؟

**AssetX** هي منصة مؤسسية متكاملة (SaaS Platform) لإدارة **دورة حياة الأصول الثابتة بالكامل** — من الشراء حتى الإخراج/الإتلاف — مع تركيز خاص على **الجرد الميداني الذكي** عبر الهواتف والأجهزة اللوحية.

- **اسم المشروع المؤقت:** AssetX Enterprise Platform
- **النوع:** Enterprise Asset Lifecycle & Smart Field Inventory Platform
- **الفئة:** SaaS — Cloud & Offline First — Cross Platform
- **التصنيف:** ليست "تطبيق جرد"، بل **منصة مؤسسية** يُعدّ الجرد إحدى وحداتها.

---

## 2. الرؤية والرسالة

### الرؤية
أن تصبح AssetX **المنصة المرجعية** لإدارة الأصول الثابتة والجرد الذكي في المؤسسات، من خلال نظام يعتمد على البيانات والأتمتة والذكاء الاصطناعي، ويجمع بين سهولة الاستخدام والموثوقية وقابلية التوسع.

### الرسالة
تمكين المؤسسات من إدارة دورة حياة أصولها بكفاءة عالية، وتقليل الفاقد والأخطاء التشغيلية، وتحويل عمليات الجرد من إجراءات ورقية مرهقة إلى عمليات رقمية ذكية مدعومة بالتحليلات والذكاء الاصطناعي.

---

## 3. المشكلة التجارية والحل

### المشاكل الحالية لدى المؤسسات
- عدم وجود قاعدة بيانات موحدة للأصول.
- صعوبة معرفة الموقع الحقيقي للأصل.
- الاعتماد على ملفات Excel أو النماذج الورقية.
- استغراق الجرد السنوي وقتاً طويلاً.
- تكرار تسجيل الأصول أو فقدانها.
- ضعف تتبع عمليات النقل بين الإدارات.
- عدم وجود سجل تاريخي كامل لحركة الأصل.
- الاعتماد على الإنترنت أثناء الجرد (يتوقف العمل في المواقع البعيدة).

### الحل الذي تقدمه AssetX
- منصة ويب للإدارة والتحكم.
- تطبيق جوال (Android / iOS / Tablet) للجرد الميداني.
- قاعدة بيانات مركزية (سحابية) + قاعدة بيانات محلية داخل الهاتف.
- محرك مزامنة ذكي (Sync Engine) + حل التعارضات (Conflict Resolution).
- دعم QR Code و Barcode، مع إمكانية دعم NFC و GPS و Bluetooth Beacon مستقبلاً.
- محرك تقارير وتحليلات + Dashboard لحظي.
- مساعد ذكاء اصطناعي لتحليل البيانات واكتشاف الحالات غير الطبيعية.

---

## 4. الأهداف التجارية (Business Objectives)

| الرمز | الهدف |
|---|---|
| BO-001 | تقليل مدة تنفيذ الجرد السنوي بنسبة لا تقل عن **70%** |
| BO-002 | تقليل نسبة الأخطاء البشرية أثناء الجرد |
| BO-003 | توفير قاعدة بيانات موحدة لجميع الأصول |
| BO-004 | توفير سجل تاريخي كامل لكل أصل |
| BO-005 | إتاحة الجرد **دون اتصال بالإنترنت** (Offline First) |
| BO-006 | توفير لوحات مؤشرات لحظية للإدارة العليا |
| BO-007 | قابلية التوسع لتصبح Enterprise Asset Management متكامل |

---

## 5. مبادئ المنتج (Product Principles)

هذه المبادئ **غير قابلة للتفاوض** — كل قرار تصميمي يجب أن يحترمها:

1. **Offline First** — يعمل بدون إنترنت ثم يزامن.
2. **Cloud Native** — مصمم للسحابة من الأساس.
3. **API First** — كل وظيفة لها API قبل الواجهة.
4. **Security by Design** — الأمان مدمج وليس إضافة.
5. **Audit by Design** — كل عملية قابلة للتتبع والتدقيق.
6. **Mobile First** للجرد الميداني.
7. **Modular Architecture** — وحدات مستقلة قابلة للتفعيل.
8. **AI Ready** — مهيأة للذكاء الاصطناعي.
9. **Scalable** — قابلة للتوسع الأفقي.
10. **Multi-Tenant Ready** — جاهزة لتعدد المستأجرين (للبيع كـ SaaS).

---

## 6. نطاق الإصدارات — إعادة تعريف MVP (Phased Approach) ⚠️

> **قرار معماري معتمد:** الـMVP لن يكون "منصة كاملة". نبدأ بأصغر منتج قابل للإطلاق.

### MVP 1 — Core Asset Platform (الأساس)
- ✅ Assets (CRUD + كود فريد + Soft Delete)
- ✅ Locations (هرمي: مبنى/طابق/غرفة)
- ✅ Employees (الموظفون والعهد)
- ✅ Inventory Foundation (دورات الجرد — Snapshot، بدون Mobile Offline بعد)
- ✅ RBAC (أدوار وصلاحيات أساسية)
- ✅ Audit (سجل تدقيق تلقائي)
- ✅ Basic Reporting (قائمة، توزيع، حالة)

### Version 2 — Field Inventory + Governance
- ✅ Offline Mobile App + Sync Engine + Conflict Resolution
- ✅ QR Scanning + GPS
- ✅ Advanced Reporting (فروقات، حركة، جرد)
- ✅ Enterprise Governance (Maker-Checker، Approval Engine، SoD)
- ✅ Field Operations Management (Sync Monitoring)

### Version 3 — AI Layer + Analytics
- ✅ AI Level 1 (Smart Search، NL Reports، Duplicate، Anomaly)
- ✅ Audit Intelligence (Root Cause Analysis)
- ✅ Dashboard تفاعلي (Live Charts)
- ✅ Maintenance + Depreciation (طرق متعددة)
- ✅ Transfers/Disposal + Notifications

### Version 4 — Full SaaS + Enterprise
- ✅ Multi-Tenant (تفعيل كامل + RLS) + Subscription/Billing
- ✅ API Gateway + Integration Hub (ERP، HR، AD)
- ✅ AI Level 2 (Image Comparison، تصنيف آلي)
- ✅ White-Label + Webhooks + Scheduled Reports

### Version 5+ — Advanced
- AI Level 3 (Predictive Maintenance، Voice، Smart Route)
- NFC + Beacon + IoT + PWA

### Version 6 — Enterprise Operating Model
- Platform Operations (ITSM, Runbooks, Escalation)
- Observability (Metrics, Logs, Tracing, SLO/SLA, Error Budgets)
- SecOps (Threat Detection, Vulnerability Mgmt, SIEM)
- Business Continuity (Backup, DR, Geo-Redundancy)
- Enterprise Integration Hub (ERP, HR, AD, WhatsApp)
- Data Governance + Platform Governance
- Performance Engineering + Cost Optimization
- Product Analytics

### Version 7 — AI-Native Enterprise Platform (مستقبلية)
- AI مدمج في كل طبقة
- Event-Driven الكامل
- Autonomous Operations (Self-healing, Auto-scaling)
- Advanced Predictive Analytics
- Digital Twin للمنشآت

### خارج نطاق الإصدارات الأولى
إدارة المخزون، المركبات، العقود، ERP، IoT، NFC، Beacon، Voice، Subscription/Billing.

---

## 7. الوحدات الرئيسية (High-Level Modules)

| # | الوحدة | الوصف |
|---|---|---|
| 01 | Authentication | المصادقة وتسجيل الدخول |
| 02 | Organization Management | إدارة المؤسسة والفروع |
| 03 | Asset Management | إدارة الأصول (CRUD، QR، صور) |
| 04 | Asset Categories | تصنيفات الأصول |
| 05 | Location Management | المواقع الهرمية (مبنى/طابق/غرفة) |
| 06 | Employee Management | الموظفون والعهد |
| 07 | Inventory Campaigns | حملات الجرد |
| 08 | Field Inventory | الجرد الميداني بالهاتف (Offline) |
| 09 | Asset Transfers | نقل الأصول |
| 10 | Attachments | المرفقات والصور |
| 11 | Reporting | التقارير والتصدير |
| 12 | Dashboard | لوحات المؤشرات (KPIs) |
| 13 | Notifications | الإشعارات |
| 14 | AI Assistant | مساعد الذكاء الاصطناعي |
| 15 | Administration | الإدارة والصلاحيات |
| 16 | Audit Logs | سجل التدقيق |
| 17 | Settings | الإعدادات العامة |

---

## 8. الجمهور المستهدف (Target Customers)

الجهات الحكومية، الجامعات، المستشفيات، البلديات، المصانع، الشركات التجارية، الفنادق، المدن الترفيهية، شركات الاتصالات، البنوك.

---

## 9. منهجية البناء — Architecture First Development

> **أي قرار هندسي لا يُوثّق داخل Architecture Bible يُعتبر غير معتمد.**

لن نبدأ بكتابة كود. سنبدأ ببناء **AssetX Architecture Bible (AAB)** — المرجع الرسمي الوحيد (Single Source of Truth) الذي يحتوي على كل ما يتعلق بالنظام من الفكرة حتى النشر.

القواعد:
- كل رد = وثيقة واحدة مكتملة.
- لن ننتقل لمرحلة قبل اعتماد السابقة.
- كل قرار يُوثّق ولن يُعاد نقاشه إلا بطلب تعديل.
- لا برمجة قبل اكتمال الـ Architecture Bible.

---

## 10. هيكل الـ Architecture Bible

```
AssetX-Architecture-Bible/
├── 01-Executive/           (الرؤية، الأهداف، السوق، المنافسون)
├── 02-Business/            (قواعد العمل، BPMN، Personas، Use Cases)
├── 03-Requirements/        (PRD: المتطلبات الوظيفية وغير الوظيفية)
├── 04-Domain/             (Domain Model — الكيانات والعلاقات)
├── 05-Architecture/        (المعمارية التقنية، Microservices، Data Flow)
├── 06-Database/            (ERD، الجداول، RLS، Audit Tables، Triggers)
├── 07-Backend/             (API Design، REST، Auth، Rate Limiting، Cache)
├── 08-Mobile/              (Offline First، SQLite، Sync Engine، QR/NFC/GPS)
├── 09-AI/                  (مقارنة الصور، اكتشاف التكرار، Anomaly Detection)
├── 10-Security/            (RBAC، MFA، JWT، OAuth، Encryption، OWASP)
├── 11-UI-UX/               (Design System، Tokens، Components، Dark Mode)
├── 12-Testing/             (Unit، Integration، E2E، Performance، Security)
├── 13-DevOps/              (CI/CD، Docker، Rollback، Blue/Green، Canary)
├── 14-Deployment/          (Runbook، Monitoring، Logging، Backup)
├── 15-Documentation/       (User Guide، Admin Guide، Developer Guide)
├── 16-Prompt-Library/      (كتالوج البرومبتات القياسية للمشروع)
├── 17-Roadmap/             (MVP → v1 → v2 → v3 → Enterprise)
└── 18-Legacy-System-Analysis/  (تحليل النظام القديم — معرفة لا كود)
```

### وثائق إضافية مقترحة (تميز المشروع)
- **Decision Log (ADR):** توثيق كل قرار معماري والبدائل المرفوضة.
- **Coding Standards:** معايير موحدة للتسمية وهيكل المجلدات.
- **Feature Specifications:** وثيقة مستقلة لكل ميزة.
- **Integration Catalog:** دليل التكاملات المستقبلية (ERP، HR، AD، WhatsApp).
- **Data Dictionary:** قاموس بيانات لكل جدول وحقل.

---

## 11. العمارة التقنية العامة (High-Level Architecture)

```
Mobile App (Android/iOS/Tablet)
        ↓
   API Gateway
        ↓
   Authentication (OAuth / JWT)
        ↓
┌───────────┬──────────────┬────────────────┬──────────────┐
│ Asset     │ Inventory    │ Maintenance    │ Notification │
│ Service   │ Service      │ Service        │ Service      │
├───────────┼──────────────┼────────────────┼──────────────┤
│ Reporting │ AI Service   │ ...            │ ...          │
│ Service   │              │                │              │
└───────────┴──────────────┴────────────────┴──────────────┘
        ↓                              ↓
   Database (Cloud)              Storage (Files/Photos)
```

### محرك المزامنة (Sync Engine) — أهم ميزة
```
Phone → SQLite (Local) → Queue → API → Server (Cloud) → Ack → Update Local DB
```
- **Offline First:** كل العمليات تعمل محلياً ثم تُزامن.
- **Conflict Resolution:** استراتيجية حل التعارضات عند المزامنة.
- **Incremental Sync:** مزامنة التغييرات فقط.

### تقنيات مقترحة (يُحسم في وثيقة Technology Decision Record)
- **Frontend Web:** إطار حديث (مثل Next.js / React)
- **Mobile:** متعدد المنصات (مثل Flutter / React Native)
- **Backend:** REST API
- **Database:** قاعدة علائقية (مثل PostgreSQL / Supabase)
- **Mobile Local DB:** SQLite
- **Deployment:** Docker + CI/CD

### ⚠️ قرار معماري: Modular Monolith (ليس Microservices من البداية)
> Microservices من اليوم = مخاطرة لفريق صغير/منتج جديد.

**البداية:** Modular Monolith — تطبيق واحد بـ modules منفصلة داخلياً:
```
AssetX Backend
├── /Assets      (module)    ├── /Reports     (module)
├── /Inventory   (module)    ├── /Audit       (module)
├── /Users       (module)    └── /Notifications (module)
```
كل module له: models، services، routes مستقلة. لكن تعمل في process واحد. **الانتقال لاحقاً** إلى Microservices عندما يزيد الحمل/تتعدد الفرق.

---

## 11A. Domain Driven Design — Bounded Contexts

| Bounded Context | الكيانات | المسؤولية |
|---|---|---|
| **Asset Context** | Asset, Category, Model, Status | دورة حياة الأصل |
| **Location Context** | MainLocation, SubLocation, Room | الهيكل المكاني الهرمي |
| **Inventory Context** | Cycle, Record, Verification, Team | الجرد + الفروقات |
| **Identity Context** | User, Role, Permission | المصادقة والصلاحيات |
| **Movement Context** | Movement, Transfer, Disposal | النقل والتغييرات |
| **Maintenance Context** | Order, Technician, SparePart | الصيانة |
| **Audit Context** | AuditEvent (Append-Only) | التدقيق الرقابي |
| **Notification Context** | Notification, Template, Channel | الإشعارات |

كل Context له حدود واضحة ولا يستدعي Context آخر مباشرة (بل عبر Events/API).

---

## 11B. Non-Functional Requirements (NFRs)

| المؤشر | الهدف |
|---|---|
| Dashboard Load | < 2 ثانية |
| Search | < 500 ms |
| Asset List (10K) | < 1 ثانية |
| Sync Rate | 1000 سجل/دقيقة |
| QR Scan → Display | < 300 ms |
| SLA (MVP) | 99.5% |
| SLA (Enterprise) | 99.9% |
| MVP Scale | 10,000 أصل / 100 مستخدم |
| Enterprise Scale | 10,000,000 أصل / 10,000 مستخدم |

الأمان: OWASP ASVS L2 · AES-256 · TLS 1.3 · bcrypt (cost≥12) · JWT 15min + Refresh 7d.

---

## 11C. Event-Driven Architecture

```
Asset Created Event → ┬→ Audit (سجل)
                       ├→ AI Engine (تحليل)
                       └→ Notification (إشعار)
```
أحداث: `AssetCreated/Updated/Deleted` · `InventoryCompleted` · `DiscrepancyDetected` · `MaintenanceScheduled`.
MVP: Event Bus داخلي. لاحقاً: Message Queue (Redis/RabbitMQ).

---

## 11D. Database Strategy — Tenant Isolation

| الخيار | الوصف | القرار |
|---|---|---|
| A: `tenant_id` + RLS | عمود في كل جدول | ✅ **معتمد** |
| B: Schema per tenant | schema منفصل | لاحقاً |
| C: DB per tenant | قاعدة كاملة | مرفوض |

> **MVP:** Multi-Tenant **Ready** (تصميم) لكن **دون** Billing/Subscription. مؤسسة واحدة.

---

## 11E. تصنيف الذكاء الاصطناعي (AI Tiering)

| المستوى | الميزات | التوقيت |
|---|---|---|
| **AI L1** (تنفيذ فوري) | Smart Search، كشف تكرار، NL Query، Report Gen | MVP 3 |
| **AI L2** (بيانات تراكمية) | Image Analysis، تصنيف آلي، Anomaly | v4+ |
| **AI L3** (بيانات ضخمة) | Predictive Maintenance، Voice، Smart Route | v5+ |

---

## 11F. التحليل التنافسي (Competitive Analysis)

| المنافس | القوة | الضعف | تميّز AssetX |
|---|---|---|---|
| SAP EAM | Enterprise قوي | مكلف، معقد | أبسط، أسرع، أرخص |
| IBM Maximo | صيانة صناعية | معقد، واجهة قديمة | UX حديثة + Mobile |
| Snipe-IT | مفتوح المصدر | محدود، لا Offline | Offline + AI + Mobile |
| Asset Panda | SaaS جيد | مكلف، تخصيص محدود | مرن + عربي أصيل |

**لماذا AssetX؟** Offline First · Mobile Native · عربي أصيل · AI مدمج · SaaS منافس · سرعة نشر.

---

## 11G. مصفوفة أولوية الميزات

```
          │ HIGH IMPACT              │ LOW IMPACT
LOW EFFORT │ ✅ MVP 1                 │ 🕐 لاحقاً
          │ Assets,QR,RBAC,Audit     │ Dark Mode,CSV
HIGH EFFORT│ 📅 MVP 2-3              │ ❌ Reject
          │ Offline,Mobile,AI,Maint  │ Voice,IoT,Beacon
```

---

## 11H. رحلات المستخدم (User Journeys)

**مدير الأصول:** Login → Dashboard → Create Campaign → مراقبة → مراجعة → اعتماد → تقرير
**جامع ميداني:** فتح Offline → اختيار حملة → مسح QR → تأكيد → صورة → حفظ → مزامنة
**مدقق:** Login → Review → فلترة فروقات → تحقق → ملاحظات → اعتماد

---

## 11I. عقد الـ API (API Contract)

```
POST   /api/assets              → إنشاء (كود تلقائي)
GET    /api/assets?q=&page=     → قائمة + فلترة
GET    /api/assets/{id}         → تفاصيل
PATCH  /api/assets/{id}         → تعديل
DELETE /api/assets/{id}         → Soft Delete
POST   /api/inventory/cycles    → إنشاء دورة (Snapshot)
POST   /api/inventory/records/{id}     → نتيجة جرد
POST   /api/inventory/records/{id}/verify → تحقق
POST   /api/sync/upload         → رفع التغييرات
GET    /api/sync/download       → تنزيل (Incremental)
POST   /api/auth/login          → JWT
POST   /api/auth/refresh        → تجديد
```

---

## 11J. SaaS Architecture Design — Multi-Tenant

### استراتيجية التعدد
> **القرار:** Multi-Tenant **Ready** (تصميم) وليس Fully Implemented في MVP. مؤسسة واحدة في البداية، التصميم جاهز للتوسع.

### علاقة Tenant / Organization / User
```
Tenant (المؤسسة المستأجرة)
  └── Organization (فرع/جهة داخل المؤسسة)
       └── Users (المستخدمون)
            └── Roles + Permissions
```
- `Tenant` = الحد الأعلى للعزل. كل البيانات تنتمي لـ Tenant.
- `Organization` = subdivision داخل Tenant (فروع، إدارات).
- `User` ينتمي لـ Tenant واحد + Organization واحدة أو أكثر.

### Technical ID (UUID) vs Business Code

| النوع | الحقل | الاستخدام | المثال |
|---|---|---|---|
| **Technical ID** | UUID (`id`) | مفتاح تقني داخلي — فريد عالمياً، لا يتغير، لا يُعرض للمستخدم | `550e8400-e29b-41d4-...` |
| **Business Code** | `asset_code` | معرّف بشري — يُطبع على QR، يُبحث به، يُعرض | `ASSET-2026-0001` |

> **القاعدة:** كل العلاقات (FK) تستخدم UUID. كل العرض والبحث والطباعة يستخدم Business Code.

### TenantID في جميع Business Tables
كل جدول أعمال يحوي `tenant_id UUID NOT NULL` + **RLS Policy**: `WHERE tenant_id = current_tenant_id()`.

---

## 11K. Database Architecture Improvements

### الأعمدة القياسية (Standard Audit Columns)
كل جدول في AssetX يحوي: `id (UUID PK)` · `tenant_id` · `created_at` · `updated_at` · `created_by` · `updated_by` · `is_active`.

### قرار المواقع الهرمية — مقارنة + قرار

| المعيار | Recursive CTE | Closure Table | **Materialized Path** ✅ |
|---|---|---|---|
| قراءة شجرة كاملة | بطيء | سريع | **سريع** (LIKE/GIN) |
| إدراج عقدة | فوري | متوسط | متوسط |
| بحث الأبناء | CTE متكرر | `WHERE ancestor=X` | **`WHERE path <@ 'X'`** فوري |
| التعقيد | منخفض | متوسط | **منخفض** |
| المساحة | الأقل | الأعلى (n²) | متوسط |

**✅ القرار المعتمد: Materialized Path + GIN Index (LTREE في PostgreSQL).**
السبب: أعلى أداء قراءة (مطلوب للجرد الميداني) + بساطة + النظام القديم يخزّن FullPath أصلاً → انتقال سلس.
> لا يُطبّق قبل إصدار ADR-005 الرسمي.

---

## 11L. Enterprise Governance Layer

> **خارج MVP** — تُضاف في Version 2. التصميم يُبنى بحيث يسهل إضافتها لاحقاً.

### Maker-Checker Workflow
```
Maker (ينشئ الطلب) → Checker (يوافق/يرفض) → System (ينفذ + Audit)
```
لا يمكن لنفس المستخدم أن يكون Maker و Checker (Segregation of Duties).

### Approval Engine — العمليات الحساسة
| العملية | المُعتمد المطلوب |
|---|---|
| إتلاف/استغناء أصل | مدير الأصول + الإدارة |
| اعتماد فروقات الجرد | المدقق + الإدارة |
| تعديل أصل حساس (قيمة عالية) | مدير الأصول |
| نقل أصل عالي القيمة | مدير الأصول |
| تعديل الصلاحيات | مدير النظام |

---

## 11M. Data Migration Framework (Legacy → AssetX)

### خط أنابيب الترحيل (7 مراحل)
```
Extract → Profile → Cleansing → Validation → Transformation → Import → Reconciliation
```

| المرحلة | الوصف |
|---|---|
| **Extract** | استخراج من SQL Server القديم (17 جدول) |
| **Profile** | تحليل الجودة: فراغات، تكرارات، أنواع |
| **Cleansing** | توحيد أسماء، إزالة مسافات، تصحيح ترميز، معالجة Nulls |
| **Validation** | فحص FK، أرقام معقولة، عدم تكرار كود |
| **Transformation** | ID→UUID، أسماء جداول، إضافة tenant_id + audit columns |
| **Import** | Batch Insert مع تتبّع أخطاء لكل سجل |
| **Reconciliation** | مطابقة العدد: القديم vs الجديد |

### قواعد التنظيف
1. كشف مكررة: Levenshtein ≥ 90% + نفس الموقع → تنبيه دمج.
2. كشف ناقصة: أصل بدون موقع/حالة/نوع → تحذير.
3. كشف غير منطقية: قيمة سالبة، تاريخ مستقبلي، إهلاك > 100%.
4. توحيد UTF-8 + trim + إزالة مسافات مزدوجة.

### نتائج الترحيل (Migration Report) — مستوحى من `TableImportResult`
| الجدول | مُستورد | متجاهل | فاشل | تحذيرات |
|---|---|---|---|---|
| Assets | 1,982 | 3 | 0 | 12 (تكرار) |
| Locations | 45 | 0 | 0 | 0 |
| Employees | 120 | 2 | 0 | 1 |

> منطق `ImportDataForm` (3070 سطر) سيُعاد بناؤه كـ **Background Migration Job**.

---

## 11N. Field Operations Management

> ضمان عدم فقد البيانات في بيئة Offline First.

### مراقبة المزامنة (Sync Monitoring)
| المؤشر | الوصف |
|---|---|
| **Device Status** | حالة كل جهاز (Online/Offline/Last Seen) |
| **Last Sync** | وقت آخر مزامنة ناجحة لكل جهاز |
| **Pending Records** | عدد السجلات المنتظرة في Queue (لم تُرفع بعد) |
| **Failed Sync** | عدد السجلات الفاشلة + سبب الفشل |
| **Conflicts** | عدد التعارضات غير المحلولة |

### Conflict Resolution Dashboard
```
Device: Tablet-A (Floor 2)
  Pending: 47 records
  Failed: 2 records (Network timeout)
  Conflicts: 1 (Asset modified by another user)
    → Asset "Printer-HP-001": 
       Local:  Qty=3  |  Server:  Qty=2
       → [Take Local] [Take Server] [Merge]
```

### إدارة الأجهزة
- تسجيل كل جهاز (Device ID + User + Assigned Campaign).
- إلغاء تسجيل الجهاز عند فقدانه (Revoke + Wipe Queue).
- حد التخزين المحلي + تنبيه عند الامتلاء.

---

## 11O. Audit Intelligence & Analytics

### Root Cause Analysis (تحليل الأسباب الجذرية)
| التحليل | السؤال | المخرجات |
|---|---|---|
| الإدارة الأكثر فقداناً | أي قسم أعلى نسبة أصول مفقودة؟ | ترتيب + نسب + اتجاه |
| الموقع الأكثر فروقات | أي موقع أعلى عجز/زيادة؟ | خريطة حرارية |
| الأصول عالية المخاطر | أصول قيمتها تتناقص بسرعة أو تحتاج صيانة متكررة؟ | قائمة + تنبيهات |
| أداء فرق الجرد | أي فريق أبطأ/أدق؟ | زمن الإنجاز + نسبة الخطأ |
| اتجاه الفقدان | هل معدل الفقدان يرتفع أم ينخفض عبر الدورات؟ | رسم بياني زمني |

### تصنيف الذكاء الاصطناعي (محدّث)
| المستوى | الميزات | التوقيت | المتطلبات |
|---|---|---|---|
| **AI L1** | Smart Search، NL Reports، Duplicate Detection، Anomaly | Version 3 | بيانات موجودية |
| **AI L2** | Image Comparison، تصنيف آلي، Root Cause | Version 4 | صور + سجل تراكمي |
| **AI L3** | Predictive Maintenance، Voice، Smart Route | Version 5+ | بيانات ضخمة |

---

## 11P. Architecture Decision Records (ADR)

> **أي قرار معماري لا يُوثّق في ADR يُعتبر غير معتمد.**

**ADR-001: UUID بدل IDENTITY** — فريد عالمياً يدعم المزامنة Offline بلا تعارض. الأكواد البشرية تبقى كأعمدة عرض منفصلة.

**ADR-002: Modular Monolith قبل Microservices** — وحدات منفصلة في process واحد. الانتقال لاحقاً عند: مستخدمين > 5000 / فرق متعددة / حمل مرتفع.

**ADR-003: Offline Sync Strategy** — Offline First + Sync Queue + Conflict Resolution (LWW للحقول البسيطة + Manual للحرجة).

**ADR-004: Multi-Tenant Strategy** — `tenant_id` + RLS (Option A). MVP = Tenant واحد. Ready للتعدد. Schema/DB-per-tenant لاحقاً.

**ADR-005: Hierarchy Strategy** — Materialized Path (LTREE + GIN). أعلى أداء قراءة + انتقال سلس من النظام القديم.

---

## 11Q. Platform Operations (تشغيل المنصة)

> هذه طبقة تشغيل مؤسسية — ليست ميزات للمستخدم النهائي.

### IT Service Management (ITSM)
| المجال | الوصف |
|---|---|
| **Incident Management** | تصنيف الحوادث (P1/P2/P3/P4) → تشخيص → إصلاح → تسجيل |
| **Problem Management** | تحليل الأسباب الجذرية للحوادث المتكررة → حل دائم (RCA) |
| **Change Management** | أي تغيير في الإنتاج يتطلب طلب تغيير (CR) + موافقة CAB |
| **Release Management** | إدارة الإصدارات + Rollback + Release Notes |
| **Configuration Management** | سجل أصول التكنولوجيا (CMDB) + إصدارات + تكوينات |
| **Service Desk** | قناة واحدة للتذاكر (مستخدمون/فريق الدعم) + SLA للاستجابة |

### Escalation Matrix
| الأولوية | زمن الاستجابة | زمن الحل | الإشعار إلى |
|---|---|---|---|
| P1 (حرج — النظام متوقف) | 15 دقيقة | 2 ساعة | CTO + On-Call |
| P2 (عالٍ — ميزة رئيسية معطلة) | 1 ساعة | 8 ساعات | Team Lead |
| P3 (متوسط — ميزة ثانوية) | 4 ساعات | 3 أيام | Developer |
| P4 (منخفض — تحسين) | 24 ساعة | أسبوعان | Backlog |

### Operations Schedule
| الدورية | المهام |
|---|---|
| **يومي** | فحص الصحة (Health) + مراجعة التنبيهات + النسخ الاحتياطي + فحص الأخطاء |
| **أسبوعي** | مراجعة الأداء + تقرير الحوادث + فحص السعة + مراجعة Sync Failures |
| **شهري** | مراجعة الأمان + اختبار الاستعادة + تحليل الاتجاهات + Technical Debt Review |
| **ربع سنوي** | Penetration Testing + Disaster Recovery Drill + Capacity Planning |
| **سنوي** | مراجعة معمارية شاملة + تحديث ADRs + تدقيق الامتثال الكامل |

### Runbooks (أدلة التشغيل)
لكل سيناريو تشغيلي Runbook موثّق:
- `RB-001` — استعادة قاعدة البيانات من النسخة الاحتياطية
- `RB-002` — التعامل مع فشل المزامنة الجماعي (Mass Sync Failure)
- `RB-003` — Rollback إصدار معيب
- `RB-004` — توسيع الخادم (Scale Up/Out)
- `RB-005` — إيقاف حساب Tenant مخترق
- `RB-006` — استعادة بعد كارثة (DR Failover)

---

## 11R. Observability & Monitoring

### الأعمدة الثلاثة للمراقبة (Three Pillars)
```
Metrics (المقاييس)     Logs (السجلات)        Tracing (التتبع)
   │                      │                      │
   ▼                      ▼                      ▼
Counter / Gauge /      Structured JSON        Request ID →
Histogram              (level, trace_id,      Service A → B → C
                       tenant_id, user_id)    Latency per span
```

### SLI / SLO / SLA + Error Budget
| المفهوم | التعريف | المثال |
|---|---|---|
| **SLI** (مؤشر الخدمة) | قياس فعلي | 99.95% من طلبات API تنجح |
| **SLO** (هدف الخدمة) | الهدف الداخلي | 99.9% توفر شهرياً |
| **SLA** (اتفاقية الخدمة) | العقد مع العميل | 99.5% أو تعويض |
| **Error Budget** | المسموح من الأخطاء | 0.1% = ~43 دقيقة/شهر توقف مسموح |

> إذا استُنفد Error Budget → تجميد الميزات الجديدة + التركيز على الاستقرار.

### Monitoring Stack المقترح
```
Application → [Prometheus/Grafana] Metrics
            → [Loki/ELK] Logs
            → [Jaeger] Tracing
            → [AlertManager] Alerts → Slack/Email/PagerDuty
            → [Uptime Kuma] Health Checks (External)
```

### Monitoring KPIs
| المؤشر | الهدف |
|---|---|
| Uptime | ≥ 99.9% |
| API p95 Latency | < 500ms |
| API Error Rate | < 0.1% |
| Sync Success Rate | ≥ 99.5% |
| DB Query p95 | < 100ms |
| Background Jobs Success | ≥ 99% |

### Audit Monitoring
- مراقبة العمليات الحساسة في الوقت الفعلي (حذف جماعي، تغيير صلاحيات).
- تنبيه عند أنماط غير طبيعية (محاولات دخول متكررة، تصدير كبير).

---

## 11S. Security Operations (SecOps)

| المجال | الوصف |
|---|---|
| **Security Monitoring** | مراقبة 24/7 للأنماط المشبوهة + SIEM |
| **Threat Detection** | IDS/IPS + Anomaly Detection على حركة المرور |
| **Vulnerability Management** | فحص دوري (SAST/DAST/SCA) + إصلاح حسب CVSS Score |
| **Secrets Management** | Vault (HashiCorp/AWS Secrets) — لا أسرار في الكود أبداً |
| **Key Rotation** | تدوير مفاتيح التشفير + JWT Signing Keys كل 90 يوماً |
| **Certificate Management** | تجديد SSL/TLS تلقائي (Let's Encrypt / ACM) |
| **SIEM Integration** | تجميع السجلات الأمنية + تحليل + تنبيهات |
| **Incident Response** | خطة استجابة: Detect → Contain → Eradicate → Recover → Lessons |
| **Penetration Testing** | ربع سنوي + بعد كل إصدار رئيسي |
| **OWASP Verification** | ASVS Level 2 للـMVP، Level 3 للـEnterprise |
| **Compliance Monitoring** | فحص الامتثال المستمر (GDPR + معايير محلية) |

### Security Incident Response Phases
```
Detect → Contain → Eradicate → Recover → Post-Mortem (RCA + Lessons)
```

---

## 11T. Business Continuity & Disaster Recovery

### Backup Strategy
| النوع | التكرار | المحتوى | الاحتفاظ |
|---|---|---|---|
| **Full Backup** | أسبوعي | قاعدة البيانات كاملة + الملفات | 4 أسابيع |
| **Incremental** | يومي | التغييرات منذ آخر نسخة | 30 يوماً |
| **Continuous (WAL)** | مستمر | سجلات المعاملات (Point-in-Time) | 7 أيام |
| **Snapshot** | كل 6 ساعات | لقطة لحظية للقرص | أسبوع |
| **Archive** | شهري | نسخة باردة للتخزين طويل المدى | سنة+ |

### Recovery Objectives
| المؤشر | الهدف (MVP) | الهدف (Enterprise) |
|---|---|---|
| **RPO** (فقدان البيانات المسموح) | 24 ساعة | 15 دقيقة |
| **RTO** (زمن الاستعادة) | 8 ساعات | 1 ساعة |

### Disaster Recovery Plan
```
Declare Disaster
  ↓
Activate DR Team (On-Call)
  ↓
Assess Damage (DB / App / Network)
  ↓
Failover to DR Region (if geo-redundancy)
  ↓
Restore from Backup / Promote Replica
  ↓
Verify Data Integrity (Reconciliation)
  ↓
Switch DNS / Traffic
  ↓
Communicate to Stakeholders
  ↓
Post-Mortem + Update DR Plan
```

### High Availability
- **MVP:** Single Region + Hot Standby (Read Replica).
- **Enterprise:** Multi-AZ + Multi-Region + Auto-Failover.
- **Failover Strategy:** Automatic health-check-based failover (RDS/CockroachDB/Supabase).

> **اختبار الاستعادة إلزامي** شهرياً — نسخة احتياطية لم تُختبر = لا نسخة احتياطية.

---

## 11U. Enterprise Integration Strategy

### Integration Channels
| القناة | النوع | الاستخدام |
|---|---|---|
| **REST API** | Sync | واجهة قياسية لكل العمليات |
| **GraphQL** | Sync | استعلامات مرنة للواجهات (اختياري لاحقاً) |
| **Webhooks** | Async (Push) | إشعار الأنظمة الخارجية بالأحداث |
| **Event Bus** | Async (Pub/Sub) | تكامل داخلي بين الخدمات |
| **Message Queue** | Async | مهام طويلة (استيراد، تقارير، مزامنة) |

### Integration Targets
| النظام | البروتوكول | الاتجاه | التوقيت |
|---|---|---|---|
| **ERP (SAP/Oracle)** | REST API | ثنائي | V4 |
| **HR System** | REST/LDAP | استيراد موظفين | V3 |
| **Finance/Accounting** | REST API | تصدير قيم | V4 |
| **Microsoft Entra ID / AD** | OAuth2/SAML | SSO + مزامنة مستخدمين | V3 |
| **LDAP** | LDAP Bind | مصادقة | V3 |
| **Email (SMTP)** | SMTP | إشعارات + تقارير | V2 |
| **SMS** | REST API (Twilio/local) | تنبيهات حرجة | V3 |
| **WhatsApp Business** | API | إشعارات | V4 |

### Webhook Retry Strategy
```
Webhook Delivery Failed
  ↓
Retry 1: بعد 30 ثانية
  ↓
Retry 2: بعد 5 دقائق
  ↓
Retry 3: بعد 30 دقيقة
  ↓
Retry 4: بعد 2 ساعة
  ↓
Retry 5: بعد 12 ساعة (الأخير)
  ↓
Dead Letter Queue + تنبيه للمشرف
```

### Integration Security
- mTLS للتكاملات الحساسة (ERP/Finance).
- API Keys + IP Allowlist لكل تكامل.
- Rate Limiting لكل تكامل (منع الإغراق).
- Signature Verification للـ Webhooks (HMAC).

---

## 11V. Platform Governance

### Governance Bodies
| الهيئة | التركيب | المسؤولية |
|---|---|---|
| **Technical Review Board (TRB)** | Architect + Tech Leads | مراجعة القرارات التقنية الكبرى |
| **Change Approval Board (CAB)** | Product + Eng + QA | اعتماد التغييرات قبل الإنتاج |
| **Security Review Board** | SecOps + Architect | مراجعة التغييرات الأمنية الحساسة |

### Decision Process
```
Proposal → TRB Review → ADR Documentation → CAB Approval → Implementation
```

### Technical Debt Register
| البند | الوصف | الأثر | الأولوية | الحالة |
|---|---|---|---|---|
| TD-001 | Recursive CTE → Materialized Path | أداء | متوسطة | مخطط |
| TD-002 | Code-Behind → API-first | بنية | عالية | قيد التنفيذ |
| ... | ... | ... | ... | ... |

### Risk Register
| الخطر | الاحتمالية | الأثر | المستوى | الإجراء الوقائي |
|---|---|---|---|---|
| فقدان بيانات الجرد Offline | متوسطة | حرج | عالٍ | Sync Queue + Conflict Resolution |
| اختراق حساب Tenant | منخفض | حرج | متوسط | MFA + RLS + Audit |
| فشل النسخ الاحتياطي | منخفض | حرج | متوسط | اختبار شهري + مراقبة |

---

## 11W. Data Governance

| المجال | السياسة |
|---|---|
| **Data Ownership** | كل مجموعة بيانات لها Data Owner (مسؤول الجودة + الوصول) |
| **Master Data** | البيانات المرجعية (الموظفون، الأقسام، التصنيفات) = مصدر واحد للحقيقة |
| **Reference Data** | الحالات، الوحدات، العملات — ثوابت يديرها المسؤول فقط |
| **Data Quality Rules** | اكتمال (لمًا 95%+) · دقة · اتساق · توقيت · تفرّد |
| **Retention Policies** | سجلات الأصول: دائم · Audit Log: 7 سنوات · سجلات الجرد: 5 سنوات |
| **Archiving** | الأصول المستبعدة → أرشيف بارد بعد سنة (لا تُحذف) |
| **Soft Delete** | كل حذف = `is_active=false` (لا DELETE فعلي) |
| **Data Classification** | Public / Internal / Confidential / Restricted (PII) |
| **PII Handling** | أسماء الموظفين + الهواتف = Confidential → تشفير + وصول محدود |
| **Audit Retention** | سجل التدقيق = Append-Only، غير قابل للتعديل، 7 سنوات |

---

## 11X. Enterprise Performance Engineering

### Caching Strategy
| الطبقة | التقنية | المثال |
|---|---|---|
| L1: In-Memory | Redis / Memory Cache | قوائم المواقع، الحالات، التصنيفات |
| L2: CDN | Cloudflare/Vercel Edge | الصور، QR، الأصول الثابتة |
| L3: DB Query Cache | Materialized Views | لوحة التحكم، إحصائيات الجرد |
| L4: HTTP Cache | ETag / Cache-Control | بيانات الأصول (تتغير نادراً) |

### Database Optimization
| التقنية | الاستخدام |
|---|---|
| **Indexing** | GIN على path (LTREE)، B-Tree على asset_code/tenant_id، Partial Index على is_active |
| **Pagination** | Cursor-based (لا OFFSET — أداء ثابت مع ملايين السجلات) |
| **Partitioning** | حسب tenant_id للجداول الكبيرة (Inventory Records, Audit Log) |
| **Connection Pooling** | PgBouncer / Supabase Pooler |
| **Read Replicas** | القراءات (تقارير، Dashboard) ← Replica · الكتابة ← Primary |

### Background Jobs & Queue Design
```
User Request (Sync) → API → DB (Fast)
         ↓ (Heavy Task)
    Job Queue (Redis/RabbitMQ)
         ↓
    Background Worker (Async)
    - Import (10K rows)
    - Report Generation (PDF)
    - Sync Processing
    - Depreciation Calculation
         ↓
    Notification (Done/Failed)
```

### Performance Testing Plan
| النوع | الأداة | الهدف |
|---|---|---|
| **Load Test** | k6 / Artillery | محاكاة 1000 مستخدم متزامن |
| **Stress Test** | k6 | إيجاد نقطة الكسر |
| **Soak Test** | k6 | 24 ساعة حمل مستمر (Memory Leaks) |
| **Spike Test** | k6 | قفزة مفاجئة 10× (موسم الجرد) |

### Capacity Planning
| المرحلة | الأصول | المستخدمون | الخوادم | قاعدة البيانات |
|---|---|---|---|---|
| MVP | 10K | 100 | 1 | Small |
| Growth | 100K | 1K | 2-3 | Medium + Replica |
| Enterprise | 1M+ | 10K+ | Auto-Scale | Large + Sharding |

---

## 11Y. Cost Optimization

### Cloud Cost Management
| المجال | الاستراتيجية |
|---|---|
| **Compute** | Auto-scaling (Scale to Zero عند الخمول) + Spot Instances للمهام غير الحرجة |
| **Storage** | Tiered Storage (Hot/Warm/Cold) + ضغط الصور + أرشفة |
| **Database** | Read Replicas للمهام الثقيلة (تقارير) + Connection Pooling (تقليل الاتصالات) |
| **Network** | CDN لتقليل نقل البيانات + ضغط الاستجابات (Gzip/Brotli) |
| **AI** | Caching لنتائج AI + Batch Processing (لا استدعاء فردي) + Model Quantization |

### Cost KPIs
| المؤشر | الهدف |
|---|---|
| Cost per Tenant / Month | < $X (حسب التسعير) |
| Cost per Asset / Month | < $0.01 |
| API Cost per 1M Requests | < $Y |
| Storage Cost per GB / Month | < $Z |
| AI Inference Cost per Request | < $W |

### Reserved Capacity
- Reserved Instances للخوادم الأساسية (توفير 30-60%).
- Committed Use Discounts لقواعد البيانات.
- مراجعة شهرية للتكلفة + إيقاف الموارد غير المستخدمة.

---

## 11Z. Product Analytics

### Business KPIs
| المؤشر | الوصف |
|---|---|
| Active Tenants | عدد المؤسسات النشطة |
| Total Assets Managed | إجمالي الأصول عبر كل Tenants |
| Inventory Completion Rate | متوسط نسبة إنجاز الجرد |
| Discrepancy Rate | متوسط نسبة الفروقات |
| Time-to-Inventory | متوسط زمن حملة الجرد |
| User Retention (M1/M3/M6) | الاحتفاظ بالمستخدمين |

### Product Analytics Events
```
Asset Created → track('asset_created', {tenant, type, value})
QR Scanned → track('qr_scanned', {asset_id, location, device})
Inventory Completed → track('inventory_completed', {cycle, duration, result})
Sync Success → track('sync_success', {records, duration})
Feature Used → track('feature_used', {module, action})
```

### Dashboards
| اللوحة | الجمهور | المحتوى |
|---|---|---|
| **Executive Dashboard** | الإدارة | نمو الأصول، الإيراد، Tenants نشطون |
| **Operational Dashboard** | فريق التشغيل | الصحة، الأداء، الحوادث |
| **Product Dashboard** | فريق المنتج | Feature Adoption، Funnel، Retention |
| **AI Usage Dashboard** | فريق AI | استخدام النماذج، التكلفة، الدقة |

### Cohort & Funnel Analysis
- **Funnel:** Sign-up → First Asset → First Inventory → First Report → Retention.
- **Cohort:** مستخدمو يناير vs فبراير — من يحتفظ أكثر؟
- **Feature Adoption:** أي ميزة تُستخدم أكثر؟ أيها مهجورة؟

---

## 11AA. Enterprise Design Standards

### Naming Conventions
| النوع | القاعدة | المثال |
|---|---|---|
| Database Tables | `snake_case`, جمع | `assets`, `inventory_cycles` |
| Database Columns | `snake_case` | `created_at`, `tenant_id` |
| API Endpoints | `kebab-case`, جمع | `/api/inventory-cycles` |
| API Fields | `camelCase` (JSON) | `assetCode`, `createdAt` |
| Files / Classes | `PascalCase` | `AssetService.ts` |
| Variables | `camelCase` | `assetCount` |
| Constants | `UPPER_SNAKE` | `MAX_PAGE_SIZE` |
| Enums | `PascalCase` values | `InventoryStatus.InProgress` |

### Folder Structure
```
assetx-backend/
├── src/
│   ├── modules/
│   │   ├── assets/
│   │   │   ├── asset.model.ts
│   │   │   ├── asset.service.ts
│   │   │   ├── asset.controller.ts
│   │   │   └── asset.routes.ts
│   │   ├── inventory/
│   │   ├── users/
│   │   └── ...
│   ├── shared/ (common utils, guards, decorators)
│   ├── config/
│   └── main.ts
├── tests/
├── docs/
└── package.json
```

### Git Workflow (Trunk-Based)
```
main (محمية — Production)
 ├── feature/asset-qr-generation → PR → Review → Merge
 ├── fix/sync-conflict-resolution → PR → Review → Merge
 └── release/v2.0 (tagged releases)
```
- **Commit Standards:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- **PR Standards:** PR Template + Checklist + Code Review (1+ approver) + CI Green.
- **Versioning:** Semantic Versioning (`MAJOR.MINOR.PATCH`).

---

## 11AB. Enterprise Quality Framework

### Definition of Ready (DoR)
- [ ] القصة مكتوبة بمعايير واضحة (User Story format).
- [ ] معايير القبول محددة (Acceptance Criteria).
- [ ] التصميم التقني مراجع (Technical Design).
- [ ] لا توجد عوائق (No Blockers).
- [ ] مُقدّرة من الفريق (Estimated).

### Definition of Done (DoD)
- [ ] الكود مكتوب ويتبع المعايير.
- [ ] Unit Tests (Coverage ≥ 80%).
- [ ] Integration Tests.
- [ ] Code Review معتمد (1+ approver).
- [ ] لا تحذيرات (No Warnings/Lint Errors).
- [ ] التوثيق محدّث.
- [ ] Security Scan نظيف.
- [ ] Deploy على Staging ناجح.
- [ ] UAT معتمد (للميزات الكبرى).

### Quality Gates (Pipeline Stages)
```
Commit → Lint → Unit Test → Build → Security Scan → Integration Test
  → Deploy Staging → E2E Test → Performance Check → Manual Approval → Deploy Prod
```

### Production Readiness Checklist
- [ ] Health Check endpoint يعمل.
- [ ] Metrics + Logs + Tracing مفعّلة.
- [ ] Alerts مُعدّة.
- [ ] Backup مُتحقّق منه.
- [ ] Rollback مُختبَر.
- [ ] Runbook مكتوب.
- [ ] Rate Limiting مفعّل.
- [ ] Secrets في Vault (ليس في الكود).
- [ ] SSL/TLS ساري.
- [ ] Load Test ناجح.

---

## 11AC. Future Architecture Vision (Evolution Roadmap)

```
Stage 1: Modular Monolith (MVP)
  │  وحدة واحدة، modules منفصلة داخلياً
  │  متى الانتقال: عند تجاوز 5000 مستخدم أو بطء في وحدة محددة
  ▼
Stage 2: Distributed Modular Monolith
  │  استخراج الوحدات الثقيلة (Inventory, Reporting) كخدمات منفصلة
  │  متى الانتقال: عند تعدد فرق التطوير أو الحاجة لعزل مستقل
  ▼
Stage 3: Microservices
  │  كل وحدة = خدمة مستقلة بـ DB خاص
  │  متى الانتقال: عند الحاجة لتوسع مستقل لكل خدمة
  ▼
Stage 4: Event-Driven Platform
  │  كل الخدمات تتواصل عبر Events فقط (لا استدعاء مباشر)
  │  متى الانتقال: عند الحاجة لمعالجة أحداث لحظية واسعة النطاق
  ▼
Stage 5: AI-Native Enterprise Platform
     الذكاء الاصطناعي مدمج في كل طبقة (Search، Analytics، Prediction، Automation)
     متى الانتقال: عند توفر بيانات كافية + نضج المنصة
```

### معايير الانتقال بين المراحل
| الانتقال | المحفّز | المخاطر | القرار |
|---|---|---|---|
| Monolith → Distributed | بطء/تعقيد في وحدة محددة | تعقيد تشغيلي | ADR جديد |
| Distributed → Microservices | فرق متعددة + توسع مستقل | توزيع البيانات | ADR جديد |
| Microservices → Event-Driven | أحداث لحظية + تكامل واسع | اتساق البيانات (Eventual Consistency) | ADR جديد |
| Event-Driven → AI-Native | بيانات كافية + أتمتة | تكلفة AI + دقة | ADR جديد |

---

## 11AD. Architecture Decision Records — Extended (ADR-006 to ADR-015)

> استكمال لـ ADR-001 إلى ADR-005 الموجودة في القسم 11P.

**ADR-006: Observability Strategy** — ثلاث ركائز (Metrics + Logs + Tracing) مع Grafana/Prometheus/Loki/Jaeger. SLO 99.9% + Error Budget.

**ADR-007: Backup Strategy** — Full (أسبوعي) + Incremental (يومي) + WAL (مستمر، PITR) + اختبار استعادة شهري إلزامي.

**ADR-008: Integration Strategy** — REST للـSync + Event Bus للـAsync + Webhooks للأنظمة الخارجية + mTLS للحساس + Retry Exponential Backoff (5 محاولات).

**ADR-009: Governance Strategy** — TRB للمراجعة التقنية + CAB لاعتماد التغييرات + ADR لكل قرار + Technical Debt Register + Risk Register.

**ADR-010: Monitoring Stack** — Prometheus (Metrics) + Loki (Logs) + Jaeger (Tracing) + AlertManager → PagerDuty/Slack + Uptime Kuma (External).

**ADR-011: Event Bus Strategy** — MVP: In-Process Event Bus. V2+: Redis Pub/Sub. V4+: Kafka/RabbitMQ للأحمال العالية.

**ADR-012: Cost Optimization Strategy** — Auto-scaling + Tiered Storage + Read Replicas للقراءات + Reserved Instances + مراجعة شهرية للتكلفة.

**ADR-013: AI Usage Strategy** — AI Tiered (L1 فوري / L2 تراكمي / L3 ضخم) + Caching للنتائج + Batch Processing + مراقبة تكلفة الاستدلال.

**ADR-014: Release Strategy** — Trunk-Based + Feature Flags + Blue/Green للإصدارات الكبرى + Canary للتجريبية + Rollback تلقائي عند فشل Health Check.

**ADR-015: Disaster Recovery Strategy** — MVP: Single Region + Hot Standby + PITR. Enterprise: Multi-Region + Auto-Failover + Geo-Redundancy. RPO 15min / RTO 1h.


---

## 12. الذكاء الاصطناعي في المنصة (AI Layer)

| الاستخدام | الوصف |
|---|---|
| مقارنة صور الأصل | المقارنة بين صورة الجرد الحالية والصورة الأصلية لكشف التلف/الكسر/الصدأ |
| اكتشاف الأصول المكررة | تحديد التسجيلات المتكررة أو المتشابهة |
| اقتراح تصنيف الأصل | اقتراح التصنيف المناسب عند الإضافة |
| اكتشاف الشذوذ (Anomaly Detection) | تنبيه عند بيانات غير منطقية (كرسي قيمته 100,000) |
| تنبيهات ذكية | "هذا الأصل لم يُجرد منذ 14 شهراً" / "تكلفة صيانته أعلى من قيمته" |
| تلخيص تقارير الجرد | مساعد ذكي للمراجع الداخلي |

---

## 13. علاقة النظام القديم بالمنصة الجديدة

### ⚠️ قرار معتمد: الهندسة العكسية (Reverse Engineering)

> **النظام القديم لن يكون مصدراً للكود، بل مصدراً للمعرفة (Knowledge Source).**

- **النظام القديم:** تطبيق WPF / C# / .NET + SQL Server (Desktop App).
- **المنصة الجديدة (AssetX):** منصة SaaS حديثة مختلفة جذرياً.

سنستخرج من النظام القديم: **منطق العمل، قواعد العمل، حالات الاستخدام، القيود** — ثم نقرر هل تستحق الدمج في AssetX. لن ننقل الكود كما هو.

---

### 13.1 قواعد العمل المستخرجة (Business Rules)

| الرمز | القاعدة |
|---|---|
| BR-ASSET-001 | كل أصل يجب أن يمتلك رقم تعريف فريد (لا يتكرر) |
| BR-ASSET-002 | لا يُنشأ أصل بدون: اسم، تصنيف، موقع، حالة |
| BR-ASSET-009 | لا يُسمح بالحذف النهائي إذا كان للأصل حركات/صيانة |
| BR-ASSET-010 | يُستخدم Soft Delete بدلاً من الحذف الفعلي |
| BR-CODE-001 | رقم الأصل يُولّد آلياً (Prefix + Sequence): Base Code + Full Code |
| BR-MOV-001 | أي نقل أصل يُسجَّل كحركة مستقلة |
| BR-MOV-004 | سجل الحركة لا يُحذف أبداً (سجل رقابي) |
| BR-MNT-002 | عند بدء الصيانة تتغير حالة الأصل تلقائياً |
| BR-SEC-005 | كل مستخدم يحصل فقط على الصلاحيات المطلوبة لعمله (Least Privilege) |
| BR-INV-001 | إنشاء دورة جرد ينسخ تلقائياً جميع الأصول النشطة (Snapshot) |
| BR-INV-002 | الدورة المغلقة لا تقبل أي تعديل على سجلات الجرد |
| BR-INV-003 | لا يمكن التحقق من سجل لم يتم جرده |

---

### 13.2 نظام دورات الجرد (Inventory Cycles) ⭐ — الميزة المحورية

النظام القديم يعتمد على نموذج **دورات الجرد (Inventory Cycles)** بدلاً من جرد مباشر على الأصول. هذا المنطق يجب تبنيه في AssetX:

- **دورة الجرد = لقطة (Snapshot):** عند إنشاء دورة جديدة تُنسخ جميع الأصول النشطة تلقائياً مع بياناتها (الموقع، الكمية، الحالة، الموظف) كبيانات **متوقعة (Expected)**.
- **حالات الدورة:** `جديدة (New)` ← `قيد التنفيذ (In Progress)` ← `مغلقة (Closed)`.
- **قفل الدورة:** بعد الإغلاق لا يمكن تعديل أي سجل جرد.
- **البيانات لكل سجل:** بيانات متوقعة (Expected) + بيانات فعلية (Actual) + نتيجة المقارنة (Result).
- **النتائج الست:** `مطابق (Matched)` · `عجز (Deficit)` · `زيادة (Surplus)` · `منقول (Transferred)` · `مفقود (Missing)` · `لم يُجرد (Not Inventoried)`.
- **الإحصائيات اللحظية:** الإجمالي، المجرد، المطابق، العجز، الزيادة، المنقول، المفقود، غير المجرد، نسبة الإنجاز %.

---

### 13.3 ميزات الجرد الميداني المستخرجة (Field Inventory Features)

| الميزة | الوصف |
|---|---|
| **المطابقة السريعة (Quick Match)** | زر يطابق الأصل المحدد كـ"مطابق" بنقرة واحدة |
| **المطابقة الجماعية حسب الموقع** | مطابقة جميع أصول موقع محدد دفعة واحدة |
| **إلغاء جرد سجل** | إعادة ضبط سجل إلى حالة "لم يُجرد" |
| **التحقق (Verification)** | نظام تحقق مستقل: Verify / Unverify / VerifyAll — مع تتبّع من تحقق ومتى |
| **الانتقال التلقائي** | بعد حفظ سجل، ينتقل المؤشر تلقائياً للسجل التالي (تسريع الجرد) |
| **طباعة نموذج جرد فارغ** | طباعة قائمة الأصول المتوقعة كنموذج ورقي للجرد اليدوي |
| **تتبع الموظف الفعلي** | تسجيل من يحوز الأصل فعلياً أثناء الجرد (قد يختلف عن المتوقع) |
| **مراجعة الجرد** | شاشة منفصلة لمراجعة الفروقات مع ملاحظات المراجع وإمكانية إلغاء التحقق |

---

### 13.4 نظام النقل والإتلاف (Transfer & Disposal)

| نوع الحركة | السلوك |
|---|---|
| **نقل (Transfer)** | تغيير الموقع/الموظف/الحالة مع تسجيل السبب ورقم المرجع والمعتمد |
| **إتلاف (Disposal)** | تعطيل الأصل + ضبط الحالة تلقائياً على "تالف" + إخفاء حقول الموقع الجديد |
| **استغناء (Retirement)** | تعطيل الأصل + ضبط الحالة تلقائياً على "مستغنى عنه" |

- كل حركة تسجل: الموقع/الموظف/الحالة (من ← إلى) + السبب + رقم المرجع + المعتمد + الملاحظات + الكمية + المنفذ.
- **تلوين أنواع الحركة** (Movement Type Color Coding) في العرض.
- **إحصائيات حسب نوع الحركة** + فلترة بالنوع/الموقع/الموظف/التاريخ.

---

### 13.5 الصلاحيات الدقيقة (Granular Permissions) ⭐

النظام القديم يطبّق **مصفوفة صلاحيات دقيقة** يجب تبنيها:

- لكل وحدة (Module) أربع صلاحيات مستقلة: `CanView` · `CanAdd` · `CanEdit` · `CanDelete`.
- الصلاحيات تُمنح **لكل مستخدم على حدة** (وليس فقط على مستوى الدور).
- عند إنشاء مستخدم جديد تُنشأ صلاحيات افتراضية.
- الوحدات المسجّلة (System Modules Registry): الأصول، التصنيفات، المواقع، الموظفون، الحركة، الجرد، التقارير، المستخدمون، الإعدادات، النسخ الاحتياطي، سجل التدقيق.

---

### 13.6 ميزات الإدارة والأمان المستخرجة

| الميزة | الوصف |
|---|---|
| **تشفير كلمات المرور** | `SecurityHelper.HashPassword()` — لا تُخزَّن كنص صريح |
| **الحذف الآمن للمستخدمين** | تعطيل (`IsActive=0`) + حذف الصلاحيات المرتبطة، وليس حذفاً نهائياً |
| **ربط المستخدم بالموظف** | كل مستخدم مرتبط بسجل موظف (EmployeeID) |
| **تتبع آخر دخول** | `LastLogin` لكل مستخدم |
| **سجل التدقيق** | `ActionType` + `TableName` + `RecordID` + `UserID` + `ActionDate` + `Details`، مع فلترة (تاريخ/نوع/مستخدم/بحث) |
| **النسخ الاحتياطي** | ملفات `.bak` + استعادة + أسماء مولّدة تلقائياً + **نسخ احتياطي مجدول تلقائي** (تكرار/وقت/مدة احتفاظ) |
| **الإعدادات كمخزن Key-Value** | `tblSettings` (SettingKey, SettingValue): اسم المؤسسة، الشعار، إعدادات النسخ التلقائي |

---

### 13.7 نظام استيراد البيانات (Data Import) ⭐

النظام القديم يحتوي على نظام استيراد متقدم (3070 سطر) يجب تبني منطقه:

- **استيراد متعدد الجداول** من Excel / Access مع اختيار الجداول المطلوبة.
- **ثلاث أوضاع استيراد:**
  1. `Import Selected` — إضافة السجلات الجديدة فقط.
  2. `Clear & Import` — مسح الجدول الهدف ثم الاستيراد.
  3. `Update Import` — تحديث السجلات الموجودة.
- **تتبع الأخطاء (Error Tracking):** كل خطأ يسجل (الجدول، العنصر، المعرّف، الرسالة).
- **نتائج لكل جدول (TableImportResult):** عدد المُستورد / المتجاهل / الفاشل.
- **شريط التقدم (Progress)** + سجل عمليات حي.
- **تصدير نتائج الاستيراد** (النجاحات/الأخطاء) إلى Excel/PDF.

---

### 13.8 نظام التقارير المستخرج (Reporting)

- **فلاتر متعددة هرمية:** الموقع الرئيسي ← الفرعي (شجرة قابلة للبحث مع **اختيار تكراري يشمل الأبناء**)، النوع، الحالة، الموظف، الموديل.
- **الاختيار التكراري للمواقع الفرعية:** اختيار موقع أب يجلب تلقائياً جميع المواقع الأبناء (Recursive CTE).
- **تقرير ملخص الجرد حسب الموقع:** المتوقع / الفعلي / الفرق لكل موقع.
- **تصدير وطباعة:** Excel + طباعة مباشرة مع رؤوس مخصصة.
- **معاينة التقارير (Report Preview Window):** قبل الطباعة.

---

### 13.9 مؤشرات لوحة التحكم (Dashboard Metrics)

| المؤشر | طريقة الحساب |
|---|---|
| إجمالي الأصول النشطة | `COUNT WHERE IsActive=1` |
| أصول سليمة | الحالات: جديد/جيد/مستعمل |
| أصول تحتاج صيانة | الحالات: يحتاج صيانة/تحت الصيانة |
| أصول مستبعدة | الحالات: تالف/مفقود/مستغنى عنه |
| **القيمة الإجمالية** | `SUM(PurchasePrice × Quantity)` |
| دورة الجرد الحالية | الحالة + نسبة الإنجاز |
| أحدث الحركات | آخر 8 حركات |
| توزيع حسب النوع | رسم بياني بنسب مئوية |
| توزيع حسب الحالة | مع ألوان مميزة لكل حالة (StatusColor) |

---

### 13.10 المواقع الهرمية (Hierarchical Locations) ⭐

النظام القديم يطبّق نموذجاً هرمياً متقدماً للمواقع يجب تبنيه بدقة:

- **مواقع رئيسية ← فرعية** مع علاقة أب-ابن (`ParentLocationID`).
- **عرض هرمي (Hierarchical Display):** `DisplayName` يعرض المسار الكامل (FullPath) مع مستوى الشجرة (TreeLevel).
- **الفلترة الشاملة:** اختيار موقع رئيسي يجلب جميع أبنائه تلقائياً.
- **منع الحلقات (Loop Prevention):** لا يسمح بأن يكون الموقع أباً لنفسه.
- أنواع المواقع: مبنى (Building)، غرفة (Room)، مخزن (Warehouse)، ورشة (Workshop)، منطقة خارجية (Outdoor Area).

---

### 13.11 مميزات إضافية مستحب الاحتفاظ بها

- حماية الأصول المرتبطة قبل الحذف/التعديل (`AssetProtectionHelper.CanDeleteAsset / CanEditAsset`).
- البحث الذكي بـ Debounce Timer (300ms) لتقليل الاستعلامات.
- التعديل الجماعي (Bulk Edit) بـ 5–11 حقلاً.
- اكتشاف الأصول المتشابهة (Similarity %) مع نسبة حد أدنى.
- تتبع التغييرات غير المحفوظة (`_isDirty` + `CanLeaveCurrentRecord`).
- توليد كود أساسي وكامل (Base Code مشترك + Full Code فريد لكل موقع).
- اختصارات لوحة المفاتيح (Ctrl+S حفظ، F3 جديد، F4 نسخ، F5 تحديث، Esc تراجع).
- النسخ من أصل موجود (Copy From) لتسريع الإدخال.
- البحث عن الأسماء المتشابهة مع اقتراح الدمج (Merge) أو المتغير الجديد (New Variant).

---

### 13.12 الخوارزميات الأساسية المستخرجة (Core Algorithms) ⭐⭐⭐

هذه الخوارزميات هي **الذهب** المستخرج من طبقة الخدمات. يجب تنفيذها في AssetX:

#### أ) خوارزمية مقارنة الجرد (Inventory Result)
```
if actualQty == 0 → "مفقود" (Missing)
else if actualQty < expectedQty → "عجز" (Deficit)
else if actualQty > expectedQty → "زيادة" (Surplus)
else if (actualLoc ≠ expectedLoc) → "منقول" (Transferred)
else → "مطابق" (Matched)
```
> 💡 **تحديث لـ AssetX:** النتيجة محسوبة (Computed/Derived) عبر DB View أو API logic، لا حقل ثابت، لتبقى متزامنة دائماً.

#### ب) خوارزمية لقطة الجرد (Snapshot)
عند إنشاء دورة: 1) التحقق لا توجد دورة لنفس السنة. 2) التحقق من وجود أصول نشطة. 3) نسخ جميع الأصول النشطة (`IsActive=1`) مع بياناتها كـ **Expected** (الموقع رئيسي+فرعي، الكمية، الحالة، الموظف). 4) ضبط النتيجة على `لم يُجرد`.

#### ج) فحص حماية الأصل (Asset Protection) — 4 فحوصات
قبل الحذف/التعديل: 1) هل للأصل **حركات**؟ 2) هل له **سجلات جرد**؟ 3) هل له **سجلات صيانة**؟ 4) هل مرتبط **بدورة جرد نشطة**؟ غير مرتبط ← مسموح للجميع. مرتبط ← مدير النظام فقط.
> 💡 **تحديث:** كـ Authorization Policy في API middleware لا في الواجهة.

#### د) خوارزمية النقل (Transfer)
1) تسجيل الحركة الكاملة (من←إلى: موقع، موظف، حالة + سبب + مرجع + معتمد + كمية). 2) تحديث بيانات الأصل الحالية. 3) إذا إتلاف/استغناء ← تعطيل الأصل (`IsActive=0`).

#### هـ) الاستعلام الهرمي للمواقع (Recursive CTE)
جلب شجرة المواقع مع `DisplayName` (بمسافات بادئة `└─`) و`FullPath` و`TreeLevel` و`SortKey`. وكذلك `GetAllDescendantSubLocationIds` يجلب كل الأبناء والأحفاد للفلترة الشاملة.
> 💡 **تحديث:** استخدام Closure Table أو Materialized Path لأداء أفضل من Recursive CTE المتكرر.

#### و) نظام توليد الأكواد (Code Generation) ⭐⭐⭐ — المنطق الأكثر تفرّداً

النظام القديم يستخدم نظام أكواد ذكي ثنائي المستوى:

| الكود | الصيغة | المثال | القاعدة |
|---|---|---|---|
| **BaseAssetCode** | `YYYY-NNNN` | `2025-0001` | فريد لكل اسم أصل. **يُشارك** بين نفس الأصل في مواقع مختلفة |
| **FullAssetCode** | `BaseCode@Location` | `2025-0001@المكتب-الرئيسي` | فريد تماماً لكل سجل |

**خوارزمية توليد الكود الأساسي:**
1. البحث عن أول **فجوة** في تسلسل الأكواد المحذوفة (`FindFirstAvailableCodeNumber`): يفحص `1, 2, 3...` ويعيد أول رقم غير مستخدم (إعادة تدوير الأكواد).
2. تنسيق الكود: `{السنة}-{الرقم:D4}`.
3. التحقق من عدم التكرار مع محاولات حتى 1000 مرة.

**خوارزمية توليد الكود الكامل:**
1. تنظيف اسم الموقع (`CleanLocationName`): استبدال المسافات/الشرطات/الفواصل بشرطة واحدة.
2. دمج: `BaseCode@CleanLocation`.
3. إذا تكرر ← إضافة لاحقة `-01, -02...` حتى 100 محاولة.
4. حالة نادرة ← إضافة طابع زمني.

**مشاركة الكود الأساسي (`GetExistingBaseCode`):** عند إضافة أصل بنفس اسم أصل موجود، يُعيد استخدام نفس الـ BaseAssetCode (بدلاً من توليد جديد)، ويولّد FullAssetCode جديداً للموقع الجديد فقط.

> 💡 **تحديث لـ AssetX:** استخدام UUID/Nanoid كمعرف فني + الكود كبطاقة عرض (Display Code) منفصلة + Sequence Table في قاعدة البيانات بدلاً من مسح الفجوات بـ HashSet.

---

#### ز) خوارزمية كشف التشابه (Levenshtein Distance) ⭐⭐

النظام القديم يطبّق **مسافة ليفنشتاين** لاكتشاف الأسماء المتشابهة:

```
CalculateSimilarity(str1, str2):
  1. تطبيع النص (NormalizeText): حروف صغيرة + إزالة الرموز + مسافة واحدة (يدعم العربية)
  2. حساب LevenshteinDistance (مصفوفة برمجة ديناميكية: حذف/إضافة/استبدال)
  3. النتيجة = 1.0 − (المسافة ÷ أقصى طول)
  → 1.0 = متطابقان | 0.0 = مختلفان تماماً
```
- **عتبة التحذير:** 75% (`SIMILARITY_THRESHOLD`) — فوقها يُحذّر المستخدم.
- **عتبة العرض:** 50% (`SIMILARITY_DISPLAY_THRESHOLD`) — تظهر في قائمة المشابهات.
- `FindSimilarAssetNames` يجلب كل الأسماء، يحسب التشابه لكل واحد، ويرتّب تنازلياً.

> 💡 **تحديث لـ AssetX:** يمكن استخدام **Trigram/PG_TRGM** في PostgreSQL لبحث تشابه أسرع على مستوى قاعدة البيانات، أو خوارزمية Jaro-Winkler للأسماء.

---

#### ح) نظام كشف التكرار ثلاثي المستويات (Duplicate Detection) ⭐⭐

عند إضافة أصل جديد، يُحدد النظام نوع العملية عبر `CheckForDuplicates`:

| المستوى | الشرط | الإجراء |
|---|---|---|
| **1. Merge (دمج)** | تطابق تام (كل الحقول متطابقة: الاسم+الموقع+النوع+الحالة+الموظف+الموديل) | إضافة الكمية للأصل الموجود (`Quantity += newQty`) |
| **2. NewVariant (متغير جديد)** | نفس الاسم لكن حقول مختلفة (موقع/حالة مختلفة) | مشاركة BaseAssetCode + توليد FullAssetCode جديد + عرض الاختلافات |
| **3. NewAsset (جديد)** | لا تشابه | توليد BaseAssetCode جديد + FullAssetCode جديد |

النتائج تُغلف في `SaveResult` مع: `RequiresMergeConfirmation`, `IsNewVariant`, `IsMerged`, `Differences`.

---

#### ط) البحث الذكي متعدد الحقول (SmartSearch)

يبحث في **9 حقول** بآن واحد مع ترتيب النتائج حسب الصلة:
`AssetName` · `BaseAssetCode` · `FullAssetCode` · `SerialNumber` · `Barcode` · `Description` · `LocationName` · `AssetTypeName` · `EmployeeName`

الترتيب: تطابق الاسم أولاً ← ثم تطابق الكود ← ثم أبجدياً. (الحد الأدنى: حرفان).

---

#### ي) حساب الإهلاك والقيمة الدفترية (Depreciation)

```
CurrentBookValue = PurchasePrice − (PurchasePrice × DepreciationRate% × yearsOwned)
                 → لا تقل عن صفر
yearsOwned = (today − PurchaseDate) / 365.25

DepreciationPercentage = ((PurchasePrice − BookValue) / PurchasePrice) × 100
AssetAge = years + months since PurchaseDate
```
> 💡 **تحديث لـ AssetX:** دعم طرق إهلاك متعددة (Straight-Line / Declining Balance / Units of Production) + Scheduled Job يومي لإعادة الحساب.

---

#### ك) قواعد التحقق الشاملة (Validation Rules)

| الحقل | القاعدة |
|---|---|
| AssetName | مطلوب، حرفان على الأقل |
| AssetTypeID | مطلوب |
| MainLocationID | مطلوب |
| StatusID | مطلوب |
| Quantity | > 0 (افتراضي 1) |
| PurchasePrice | ≥ 0 |
| DepreciationRate | بين 0 و 100 |
| UsefulLife | ≥ 0 |

---

### 13.13 السجل الكامل لوحدات النظام (20 Module Registry)

لكل وحدة 4 صلاحيات (View / Add / Edit / Delete):

Assets · AssetTypes · MainLocations · SubLocations · AssetStatus · AssetModels · Employees · InventoryCycles · InventoryEntry · InventoryReview · TransferAsset · MovementHistory · ReportInventory · ReportAssets · ReportMovement · Users · Backup · SystemSettings · AuditLog · ImportData

---

### 13.14 التحديثات الحديثة المقترحة (Modernization) 🚀

طبقاً لمبدأ "ليس بالضرورة نسخ المنطق القديم":

| المنطقة | القديم | التحديث لـ AssetX |
|---|---|---|
| تشفير كلمة المرور | SHA256 | **bcrypt / argon2** (salt + cost factor) |
| الجلسة | CurrentUser ثابت | **JWT + Refresh Token** + Redis |
| حماية الأصول | MessageBox في الواجهة | **Authorization Policy** في API |
| النسخ الاحتياطي | Timer محلي + `.bak` | **Cloud scheduled** + Point-in-Time Recovery |
| التدقيق | MachineName | **IP + Device Fingerprint + Geo + User Agent** |
| نتيجة الجرد | حقل مخزَّن | **Computed field** (DB View) |
| الجرد الميداني | مربوط بالشبكة | **Offline First** (SQLite + Sync Queue) |
| الأدوار | نص حر | **RBAC مُنظَّم** (Roles + RolePermissions) |
| التنبيهات | MessageBox | **Push + Email + WhatsApp** |

---

### 13.15 المخطط الكامل لقاعدة البيانات القديمة (Legacy DB Schema) 🗄️

قاعدة البيانات `AssetsDB` (SQL Server) تتكون من **17 جدولاً** مترابطاً. هذا المخطط هو الأساس المرجعي لتصميم قاعدة بيانات AssetX الجديدة.

#### الجداول الرئيسية ووظائفها

| الجدول | الوظيفة | المفتاح | قيود التفرّد |
|---|---|---|---|
| tblAssets | الأصول الرئيسية | AssetID | FullAssetCode (UNIQUE) |
| tblAssetTypes | أنواع الأصول (هرمي) | AssetTypeID | AssetTypeName |
| tblSubTypeAssets | الأنواع الفرعية (هرمي ذاتي) | SubTypeID | (SubTypeName + AssetTypeID) |
| tblAssetModels | الموديلات | ModelID | ModelName |
| tblMainLocations | المواقع الرئيسية | MainLocationID | MainLocationName |
| tblSubLocations | المواقع الفرعية (هرمي ذاتي) | SubLocationID | — |
| tblStatus | حالات الأصول | StatusID | StatusName |
| tblEmployees | الموظفون | EmployeeID | — |
| tblAssetMovements | حركة الأصول | MovementID | — |
| tblMaintenance | سجلات الصيانة | MaintenanceID | — |
| tblInventoryCycles | دورات الجرد | CycleID | CycleYear |
| tblInventoryRecords | سجلات الجرد (متوقع/فعلي) | RecordID | (CycleID + AssetID) |
| tblInventoryTeam | فرق الجرد | TeamMemberID | (CycleID + EmployeeID) |
| tblUsers | المستخدمون | UserID | Username |
| tblUserPermissions | الصلاحيات الدقيقة | PermissionID | (UserID + ModuleName) |
| tblAuditLog | سجل التدقيق | AuditID | — |
| tblSettings | الإعدادات (Key-Value) | SettingID | SettingKey |

#### مكتشفات جديدة مهمة من المخطط الفعلي ⚠️

1. **tblSubTypeAssets هرمي ذاتي** — له `ParentSubTypeID` + `FullPath` + `LevelNumber` (مثل المواقع الفرعية تماماً)، أي أن التصنيفات الفرعية تدعم التعشيش.
2. **tblSubLocations يخزّن `FullPath` و`LevelNumber`** كأعمدة فعلية (Materialized)، وليس محسوباً عبر CTE فقط — هذا تحسين أداء.
3. **tblUserPermissions لها `CanPrint`** — صلاحية خامسة (View/Add/Edit/Delete/**Print**) وليس أربعاً فقط.
4. **tblInventoryTeam** — جدول منفصل لربط أعضاء فريق الجرد بالدورة مع `TeamRole` (افتراضي: 'عضو').
5. **tblAuditLog فيها `IPAddress`** — لا يقتصر التدقيق على اسم الجهاز فقط.
6. **tblMaintenance كامل** — `MaintenanceCode`, `MaintenanceType`, `Cost`, `TechnicianName/Contact`, `StartDate/EndDate`, `NextMaintenanceDate`, `StatusID`, `Priority`.
7. **tblStatus فيها `StatusColor`** (Hex color) لتمييز كل حالة بصرياً.
8. **القيود المركبة:** `UNIQUE(CycleID, AssetID)` في سجلات الجرد (لا يتكرر الأصل في نفس الدورة)، `UNIQUE(UserID, ModuleName)` في الصلاحيات.

#### الأعمدة المحورية في tblAssets (الجدول المركزي)

```
AssetID (PK, IDENTITY) | AssetName (NOT NULL) | BaseAssetCode (NOT NULL) |
FullAssetCode (NOT NULL, UNIQUE) | Description |
AssetTypeID (FK) | SubTypeID (FK) | ModelID (FK) |
MainLocationID (FK) | SubLocationID (FK) |
Quantity (default 1) | StatusID (FK) | EmployeeID (FK) |
PurchasePrice (decimal 18,2) | PurchaseDate (date) |
DepreciationRate (decimal 5,2) | UsefulLife (int) |
SerialNumber | Barcode | ReferenceNumber | InventoryYear |
Notes | IsActive (default 1) |
DateEntered (default GETDATE) | CreatedBy | ModifiedDate | ModifiedBy
```

#### بنية tblInventoryRecords (نموذج متوقع/فعلي)

```
RecordID (PK) | CycleID (FK) | AssetID (FK) |
─ Expected: ExpectedMainLocID, ExpectedSubLocID, ExpectedQuantity, ExpectedStatusID, ExpectedEmployeeID
─ Actual:   ActualMainLocID,   ActualSubLocID,   ActualQuantity,   ActualStatusID,   ActualEmployeeID
─ Result:   InventoryResult (default 'لم يُجرد'), InventoryDate, InventoryBy
─ Verify:   IsVerified (default 0), VerifiedBy, VerifiedDate
─ Notes
CONSTRAINT UNIQUE (CycleID, AssetID)
```

#### العلاقات الرئيسية (Foreign Keys)

```
tblAssets ─┬─→ tblAssetTypes
           ├─→ tblSubTypeAssets
           ├─→ tblAssetModels ─→ tblAssetTypes, tblSubTypeAssets
           ├─→ tblMainLocations
           ├─→ tblSubLocations ─→ tblMainLocations + (self-ref: ParentSubLocationID)
           ├─→ tblStatus
           └─→ tblEmployees

tblAssetMovements ─→ tblAssets + (From/To: MainLocations, SubLocations, Employees) + (Old/New: Status)

tblInventoryRecords ─→ tblInventoryCycles + tblAssets
                     + (Expected/Actual: MainLocations, SubLocations, Status)

tblInventoryTeam ─→ tblInventoryCycles + tblEmployees
tblMaintenance ─→ tblAssets + tblStatus
tblUsers ─→ tblEmployees
tblUserPermissions ─→ tblUsers
tblAuditLog ─→ tblUsers
```

#### الإجراءات المخزنة (Stored Procedures)

| الإجراء | الوظيفة |
|---|---|
| `sp_CreateInventoryCycle` | إنشاء دورة + نسخ الأصول النشطة تلقائياً (Snapshot) |
| `sp_UpdateInventoryRecord` | تحديث نتيجة جرد مع حساب النتيجة (مفقود/عجز/زيادة/منقول/مطابق) |
| `sp_GetInventorySummary` | ملخص الجرد مجمّع حسب النتيجة (متوقع/فعلي/الفرق) |
| `sp_GetAssetMovements` | تقرير حركة الأصول مع فلاتر (الأصل/التاريخ) |

> 💡 **تحديث لـ AssetX:** في المنصة الجديدة ستُترجم هذه الإجراءات إلى **API endpoints** + **DB functions/views**، مع إضافة: Triggers للتدقيق التلقائي، RLS (Row Level Security) للتعدد، و UUID بدل IDENTITY.

---

### 13.16 الميزات الجديدة المقترحة لمنصة AssetX 🚀 (ما يتجاوز النظام القديم)

النظام القديم تطبيق سطح مكتب محدود. فيما يلي الميزات **الجديدة كلياً** المقترحة لـ AssetX، مرتبة حسب الأولوية والأثر:

#### 🔹 أ) ميزات الجرد الميداني المتقدمة (غير موجودة في القديم)

| الميزة | الوصف | القيمة |
|---|---|---|
| **Offline Sync Engine** | محرك مزامنة كامل: العمل بدون إنترنت + Queue + Conflict Resolution + Incremental Sync | حرج — جوهر Offline First |
| **QR Code توليد ومسح** | توليد QR تلقائياً لكل أصل + مسح بالكاميرا من الهاتف + بحث بالمسح | تسريع الجرد 10× |
| **GPS Verification** | إثبات أن جامع البيانات كان فعلاً في الموقع الجغرافي | منع التلاعب |
| **Bluetooth Beacon** | اكتشاف الغرفة/الطابق تلقائياً عند الدخول | أتمتة كاملة |
| **NFC Tags** | لمس بطاقة NFC على الأصل لفتح بياناته فوراً | مستقبل الصناعة |
| **Photo Capture + AI Comparison** | التقاط صورة + مقارنة آلية مع الصورة الأصلية لكشف التلف/الصدأ/الكسر | كشف الأضرار بدون فحص يدوي |
| **Inventory Heat Map** | خريطة حرارية للمباني تُظهر تقدّم الجرد (🟢🟡🔴) لكل غرفة/طابق | رؤية إدارية لحظية |
| **Smart Route Suggestions** | الذكاء الاصطناعي يقترح أفضل مسار جرد داخل المبنى | توفير وقت الفريق |
| **Bulk Quick Scan** | مسح متتابع سريع (عن طريق الكاميرا) لجرّد غرفة كاملة بثوانٍ | جرد غرفة في 30 ثانية |

#### 🔹 ب) ميزات الذكاء الاصطناعي (AI Layer)

| الميزة | الوصف |
|---|---|
| **Anomaly Detection** | تنبيه تلقائي عند بيانات غير منطقية (كرسي قيمته 100,000 / أصل لم يُجرد منذ سنتين) |
| **Predictive Maintenance** | توقع موعد التعطل بناءً على العمر + تاريخ الصيانة + نمط الاستخدام |
| **Smart Asset Classification** | اقتراح التصنيف المناسب تلقائياً عند الإدخال |
| **Duplicate ML Detection** | اكتشاف الأصول المكررة بخوارزميات أقوى من Levenshtein (Embeddings/Trigram) |
| **Natural Language Reports** | "اكتب تقريراً عن الأصول عالية التكلفة في الصيانة هذا العام" ← يُولّد تلقائياً |
| **Smart Alerts** | "تكلفة صيانة هذا الأصل تجاوزت قيمته السوقية — يُنصح بالاستبدال" |
| **Audit Assistant** | مساعد ذكي للمدقق يلخّص الفروقات ويقترح التحقيقات |

#### 🔹 ج) ميزات المنصة السحابية (SaaS / Multi-Tenant)

| الميزة | الوصف |
|---|---|
| **Multi-Tenant Architecture** | كل مؤسسة = Tenant منفصل (عزل بيانات كامل) — قابل للبيع كـ SaaS |
| **Subscription / Billing** | خطط اشتراك (Starter / Pro / Enterprise) + إدارة التراخيص |
| **White-Label Branding** | تخصيص الشعار والألوان لكل عميل |
| **API Gateway** | REST API كامل + Swagger/OpenAPI للتكامل الخارجي |
| **Webhooks** | إشعارات للأحداث (أصل جديد / جرد مكتمل / تنبيه صيانة) للأنظمة الخارجية |
| **Integration Hub** | تكامل جاهز مع: ERP (SAP/Oracle)، HR Systems، Active Directory، WhatsApp، Email، SMS |

#### 🔹 د) ميزات إدارة الأصول المتقدمة

| الميزة | الوصف |
|---|---|
| **Asset Photos & Documents** | مرفقات متعددة (صور، فواتير، عقود، كتيبات) لكل أصل — غير موجودة في القديم |
| **Warranty Tracking** | تتبع الضمانات + تنبيه قبل الانتهاء |
| **Spare Parts Management** | إدارة قطع الغيار وربطها بالأصول والصيانة |
| **Vendor/Supplier Portal** | إدارة الموردين + سجل المشتريات |
| **Digital Custody Handover** | نموذج تسليم/تسليم عهدة بتوقيع إلكتروني |
| **Multi-Depreciation Methods** | طرق إهلاك متعددة (Straight-Line / Declining Balance / Units of Production) — القديم فيه طريقة واحدة |
| **Scheduled Depreciation Job** | إعادة حساب القيمة الدفترية يومياً تلقائياً (Cron Job) |
| **Asset Lifecycle Pipeline** | عرض بصري لمرحلة كل أصل (شراء←تشغيل←صيانة←إخراج) |

#### 🔹 هـ) ميزات التقارير والتحليلات (BI)

| الميزة | الوصف |
|---|---|
| **Live Interactive Dashboard** | لوحات مؤشرات تفاعلية لحظية (Charts حقيقية لا أرقام ثابتة) |
| **Power BI / BI Integration** | تصدير البيانات إلى أدوات BI متقدمة |
| **Scheduled Reports** | تقارير تُرسل تلقائياً (يومي/أسبوعي/شهري) بالبريد |
| **Custom Report Builder** | المستخدم يبني تقريره الخاص بالسحب والإفلات |
| **Trend Analysis** | تحليل اتجاهات (قيمة الأصول عبر الزمن / معدل الفقدان / تكلفة الصيانة السنوية) |
| **Export to Multiple Formats** | Excel / PDF / CSV / JSON / API |

#### 🔹 و) ميزات الأمان والحوكمة المتقدمة

| الميزة | الوصف |
|---|---|
| **MFA (Multi-Factor Auth)** | مصادقة ثنائية (OTP / App) |
| **SSO (Single Sign-On)** | تسجيل دخول موحد (Active Directory / Google / Microsoft) |
| **Session Management** | إدارة الجلسات + إلغاء الجلسات البعيدة |
| **Immutable Audit Log** | سجل تدقيق غير قابل للتعديل (Append-Only / Blockchain-like) |
| **Data Encryption at Rest** | تشفير قاعدة البيانات + الملفات المرفقة |
| **GDPR / Compliance Mode** | وضع امتثال للخصوصية + حق النسيان |
| **Role Templates** | قوالب أدوار جاهزة (Admin / Manager / Auditor / Field Agent) قابلة للتخصيص |

#### 🔹 ز) ميزات تجربة المستخدم (UX)

| الميزة | الوصف |
|---|---|
| **Dark Mode** | الوضع الداكن |
| **Multi-Language (i18n)** | دعم عربي/إنجليزي + لغات أخرى |
| **Responsive Design** | يعمل على جميع الأحجام (Mobile / Tablet / Desktop) |
| **Keyboard Shortcuts** | اختصارات لوحة المفاتيح لكل عملية |
| **PWA (Progressive Web App)** | يعمل كتطبيق على الهاتف بدون متجر |
| **Offline Asset Search** | البحث في الأصول المحفوظة محلياً على الهاتف |
| **Bulk Actions on Mobile** | إجراءات جماعية من الهاتف (مطابقة مجموعة باللمس) |
| **Voice Commands** | أوامر صوتية ("ابحث عن طابعة HP" / "اجرد هذه الغرفة") |

#### 🔹 ح) ميزات تشغيلية (Operations)

| الميزة | الوصف |
|---|---|
| **Real-time Monitoring** | مراقبة لحظية للنظام (أداء، أخطاء، مستخدمون نشطون) |
| **Automated Backups (Cloud)** | نسخ احتياطي سحابي تلقائي + Point-in-Time Recovery |
| **Health Checks** | فحص صحة النظام الدوري + تنبيهات |
| **Zero-Downtime Deployment** | نشر بدون توقف (Blue/Green / Canary) |
| **Feature Flags** | تفعيل/تعطيل الميزات لكل Tenant بدون نشر جديد |

---

### أولويات الإصدارات المقترحة (Roadmap Priority)

| الإصدار | الميزات المقترحة |
|---|---|
| **MVP (v1.0)** | إدارة الأصول + المواقع الهرمية + QR + الجرد الميداني Offline + Dashboard + التقارير + RBAC + Audit |
| **v2.0** | صيانة + نقل/إتلاف + مرفقات/صور + إشعارات + Multi-Depreciation + Scheduled Reports |
| **v3.0** | AI Layer (Anomaly + Image Comparison + Smart Alerts) + GPS + Heat Maps + Custody Handover |
| **v4.0** | Multi-Tenant + Subscription/Billing + API Gateway + Integration Hub + White-Label |
| **v5.0** | NFC + Beacon + Voice Commands + Predictive Maintenance + Power BI + PWA |

---

## 14. دورة حياة الأصل (Asset Lifecycle)

```
شراء الأصل → اعتماد الشراء → استلام الأصل → ترقيم الأصل →
طباعة QR → تسليم الأصل → نقل الأصل → الجرد →
الصيانة → الضمان → قطع الغيار → الإهلاك → الإخراج/الإتلاف
```

### سير عمل الجرد الميداني
```
إنشاء حملة جرد → تحديد المواقع → تحديد الفريق →
إرسال الإشعارات → فتح الجرد → الجرد الميداني (Offline) →
رفع الصور → اعتماد النتائج → إنشاء الفروقات →
المراجعة → إغلاق الحملة
```

---

## 15. الأدوار والمستخدمون (User Roles)

| الدور | الصلاحية |
|---|---|
| Administrator | إدارة كاملة (مستخدمون، صلاحيات، إعدادات) |
| Asset Manager | تسجيل/تعديل الأصول، متابعة الحركة |
| Auditor | مراجعة سجل الأصول، التقارير، الفروقات |
| Department Manager | أصول القسم، التقارير |
| Inventory Team | الجرد الميداني بالهاتف |
| Maintenance | أوامر الصيانة |
| Employee | عرض أصوله فقط |

---

## 16. معايير النجاح (KPIs)

- زمن تنفيذ حملة الجرد.
- نسبة الأصول المجردة.
- نسبة الفروقات المكتشفة.
- زمن مزامنة البيانات.
- زمن الاستجابة (Response Time).
- معدل الأعطال (Uptime).
- رضا المستخدمين.
- عدد الأخطاء الحرجة.

---

## 17. كيف تبدأ الدردشة الجديدة

عند بدء دردشة جديدة للبناء، الصق هذا الملف ثم أضف أحد الطلبات التالية حسب المرحلة:

### لبدء بناء Architecture Bible
```
بناءً على ملف README الخاص بمنصة AssetX، أريد منك البدء بكتابة
الوثيقة الأولى من Architecture Bible:
01-Executive/000_Project_Charter.md
بصيغة احترافية كاملة دون اختصار، ثم نكمل وثيقة بعد وثيقة.
```

### لتصميم قاعدة البيانات
```
بناءً على ملف README الخاص بمنصة AssetX، صمم قاعدة البيانات الكاملة:
ERD، هيكل الجداول مع أنواع البيانات، المفاتيح والفهارس،
سياسات RLS، Audit Tables، و3 استعلامات SQL شائعة.
```

### لتصميم المعمارية
```
بناءً على ملف README الخاص بمنصة AssetX، صمم هندسة النظام الكاملة:
المكونات ومسؤولية كل منها، بروتوكولات التواصل، استراتيجية قاعدة البيانات،
محرّك المزامنة (Offline First)، وخطة التوسع.
```

### لتصميم CI/CD
```
بناءً على ملف README الخاص بمنصة AssetX، صمم Pipeline CI/CD كاملاً:
البيئات (Dev/Staging/Prod)، مراحل الـ Pipeline، معايير الجودة،
وآلية Rollback عند الفشل.
```

---

## 18. ملاحظات مهمة

1. **اسم المشروع:** AssetX (اسم مؤقت، قد يُغيّر لاحقاً إلى AssetFlow أو AssetPulse).
2. **التقنيات النهائية** تُحدد في وثيقة Technology Decision Record منفصلة، ليبقى الميثاق مستقراً.
3. **النظام القديم** (WPF/C#) موثّق في الأقسام 13.x كمصدر معرفة فقط.
4. **منهجية البرومبتات:** ستُبنى مكتبة برومبتات قياسية لكل مرحلة.
5. **هيكل التوثيق المستقبلي:** هذا الملف = Master Context Document. عند بدء البناء يُقسّم إلى منظومة وثائق (Product/ Requirements/ Architecture/ Database/ Mobile/ Security/ Legacy/ Roadmap).

---

**AssetX Enterprise Platform** — *Enterprise Asset Lifecycle & Smart Field Inventory Platform*
**Version:** 5.0 — Enterprise Architecture Foundation | **Status:** Production-Ready | **Year:** 2026

---

## 📋 Change Log — Version 5.0 (Enterprise Architecture Foundation)

### Added Sections
| القسم | العنوان |
|---|---|
| 11J | SaaS Architecture Design — Multi-Tenant + UUID vs Business Code |
| 11K | Database Architecture Improvements — Audit Columns + Hierarchy Decision |
| 11L | Enterprise Governance Layer — Maker-Checker + Approval + SoD |
| 11M | Data Migration Framework — 7-Stage Pipeline + Cleansing Rules |
| 11N | Field Operations Management — Sync Monitoring + Conflict Dashboard |
| 11O | Audit Intelligence & Analytics — Root Cause Analysis + AI Tiering |
| 11P | Architecture Decision Records — ADR-001 to ADR-005 |

### Updated Sections
- **Roadmap (6):** MVP مُعاد توزيعه إلى 5 إصدارات (Core → Field Inventory → AI → SaaS → Advanced).
- **Architecture (11):** Modular Monolith + Materialized Path + Event-Driven.

### Architecture Vision (الرؤية المعمارية المحدّثة — v6.0)
```
AssetX Enterprise Platform
├── Product Layer          (الرؤية، MVP، Roadmap، Personas)
├── Business Layer         (Business Rules، Workflows، Use Cases)
├── Domain Layer           (Bounded Contexts، Entities، Aggregates)
├── Application Layer      (Services، API، Modules، Mobile)
├── Integration Layer      (ERP، HR، AD، Webhooks، Event Bus)
├── AI Layer              (L1 Search/NLP · L2 Vision · L3 Predictive)
├── Data Layer            (PostgreSQL، LTREE، RLS، Migrations)
├── Security Layer        (RBAC، MFA، JWT، Encryption، OWASP)
├── Governance Layer      (Maker-Checker، SoD، TRB، CAB، ADRs)
├── Operations Layer      (ITSM، Runbooks، Escalation، Incidents)
├── Monitoring Layer      (Metrics، Logs، Tracing، SLO/SLA، Alerts)
├── DevSecOps Layer       (CI/CD، Testing، Quality Gates، Feature Flags)
├── Business Continuity   (Backup، DR، RPO/RTO، Geo-Redundancy)
└── Enterprise Operating  (Cost، Performance، Data Governance، Analytics)
    Model
```

### Preserved (محفوظ)
✅ فلسفة AssetX · ✅ كل ميزات النظام القديم · ✅ كل الخوارزميات · ✅ المبادئ العشرة · ✅ Competitive Analysis.

### Constraints Honored
❌ لم تُحذف ميزة · ❌ لم تُغيّر الفلسفة · ❌ ليس ERP · ❌ المؤسسية خارج MVP · ❌ لم يُعد كتابة أي قسم.

---

## 📋 Change Log — Version 6.0 (Enterprise Operating Model)

### Added Sections (13 قسم جديد + ADRs موسّعة)
| القسم | العنوان |
|---|---|
| 11Q | Platform Operations — ITSM, Runbooks, Escalation Matrix |
| 11R | Observability & Monitoring — Metrics/Logs/Tracing, SLO/SLA, Error Budgets |
| 11S | Security Operations (SecOps) — Threat Detection, SIEM, Vuln Mgmt |
| 11T | Business Continuity & DR — Backup, RPO/RTO, DR Plan, Failover |
| 11U | Enterprise Integration — ERP/HR/AD, Webhooks, Retry Strategy |
| 11V | Platform Governance — TRB, CAB, Risk Register, Tech Debt Register |
| 11W | Data Governance — Ownership, Quality Rules, Retention, PII |
| 11X | Performance Engineering — Caching, Indexing, Queue, Load Testing |
| 11Y | Cost Optimization — Cloud Cost, Storage, AI Cost, Capacity |
| 11Z | Product Analytics — KPIs, Funnels, Cohorts, Dashboards |
| 11AA | Design Standards — Naming, Folders, Git Workflow, Commits |
| 11AB | Quality Framework — DoR, DoD, Quality Gates, Prod Readiness |
| 11AC | Future Architecture — Monolith → Distributed → Micro → Event → AI-Native |
| 11AD | ADR Extended — ADR-006 to ADR-015 |

### Updated Sections
- **Roadmap:** إضافة Version 6 + Version 7 (AI-Native).
- **Architecture Vision:** إعادة رسم كـ 14 طبقة مؤسسية متكاملة.

### التوصية النهائية
> بعد اكتمال v6.0، **لا تبدأ البرمجة**. اطلب إنشاء **Version 7.0 — Enterprise Delivery Framework** (Scrum، Git Workflow، CI/CD، DoD، Release Policies، Developer Onboarding). عندها ستكون الوثيقة مكافئة لما تستخدمه SAP/Oracle/Microsoft.

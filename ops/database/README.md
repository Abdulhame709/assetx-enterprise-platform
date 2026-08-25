# AssetX Database Operations

هذا الدليل هو نقطة التشغيل الموحّدة لقاعدة بيانات AssetX في المستودع المستقل `Abdulhame709/assetx-enterprise-platform`. يستخدم المساران المحلي والسحابي **نفس ملفات** `db/migrations/` و`db/seed/`، ولا ينشئ كل بيئة مخططاً مختلفاً.

## المبدأ التشغيلي

يستخدم Backend قاعدة PGlite تلقائياً عندما لا يكون `DATABASE_URL` مضبوطاً، ويستخدم `PostgresDatabase` عندما يكون `DATABASE_URL` موجوداً. المسار الموصى به للتحقق الحقيقي هو PostgreSQL المحلي، والمسار المستهدف للنشر هو PostgreSQL مُدار مثل Supabase أو أي PostgreSQL 13+ متوافق.

يجب فصل ثلاثة أدوار تشغيلية. ينشئ مسؤول قاعدة البيانات أدوار PostgreSQL مرة واحدة. يشغل `assetx_migrator` الترحيلات ويملك امتيازات DDL اللازمة في job محمي. يشغل `assetx_app` طلبات HTTP فقط ولا يملك الجداول ولا `CREATEROLE`. يظل دور `authenticated` دوراً غير مسجل للدخول تستخدمه سياسات RLS وامتيازات التطبيق.

| البيئة | قاعدة البيانات | تطبيق الترحيلات | seed | حالة هذه الجلسة |
|---|---|---|---|---|
| Local PostgreSQL | `127.0.0.1:5432/assetx` | `backend` migration CLI | `001_seed.sql` ثم `002_permissions.sql` | جاهزة ومتحقق منها |
| Local PGlite | مدمجة داخل Backend | bootstrap محلي | demo bootstrap عند التشغيل | مسار fallback والاختبارات |
| Staging Cloud | PostgreSQL مُدار | job مستقل قبل الخدمات | tenant محدد صراحةً | جاهز للتطبيق بعد توفير URL والأدوار |
| Production Cloud | PostgreSQL مُدار مع TLS | pipeline محمي قبل deploy | لا demo seed | غير منفذة حتى الآن |

## المسار المحلي

تأكد من توفر PostgreSQL ثم أنشئ قاعدة `assetx` وحسابات التشغيل عبر مسؤول PostgreSQL. لا تُحفظ كلمات المرور داخل المستودع. في هذه الجلسة تم حفظ متغيرات التشغيل خارج GitHub تحت `/home/ubuntu/assetx-runtime/`.

بعد تجهيز `DATABASE_URL`، شغّل الترحيلات الرسمية من جذر المستودع:

```bash
set -a
. /home/ubuntu/assetx-runtime/migrator.local.env
set +a
npm --prefix backend run build
DATABASE_URL="$DATABASE_URL" npm --prefix backend run db:migrate
```

أنشئ tenant للتحقق أو استخدم tenant موجوداً، ثم شغّل seed في سياق tenant. قيمة `app.tenant_id` مطلوبة قبل أي seed tenant-scoped، لأن RLS تمنع إدخال صفوف بلا سياق.

```bash
TENANT_CODE=local_assetx ./ops/database/seed-tenant.sh
```

يمكن تشغيل بيانات العرض الاختيارية عبر `ASSETX_SEED_DEMO=1` عند تشغيل Backend المحلي، لكن لا تُشغّلها على staging أو production إلا بقرار اختبار صريح.

## المسار السحابي

يحتاج المسار السحابي إلى مزود PostgreSQL فعلي، عنوان اتصال TLS، اسم قاعدة، حساب migrator، حساب runtime، وأسرار JWT. لا يمكن تنفيذ الاتصال السحابي من هذه الجلسة قبل توفير هذه القيم أو تمكينها في بيئة التشغيل. بمجرد توفيرها، يطبق المهندس التسلسل التالي:

```bash
export DATABASE_URL='postgresql://...'
export TENANT_CODE='staging'

npm --prefix backend run build
DATABASE_URL="$DATABASE_URL" npm --prefix backend run db:migrate
TENANT_CODE="$TENANT_CODE" DATABASE_URL="$DATABASE_URL" ./ops/database/seed-tenant.sh
```

يجب تشغيل `ops/staging/provision-runtime-role.sql` مرة واحدة بواسطة مسؤول PostgreSQL قبل الترحيلات أو وفق آلية الأدوار التي يوفرها المزود. لا يستخدم Backend مالك القاعدة أو service role في مسار HTTP العام. في الإنتاج يفضل تشغيل الترحيلات كـ pipeline job مستقل مع backup سابق وخطة rollback؛ لا تُربط الترحيلات بإعادة تشغيل كل instance.

بعد ذلك تُضبط بيئة Backend عبر `DATABASE_URL` و`JWT_ACCESS_SECRET` و`JWT_REFRESH_SECRET` و`CORS_ORIGIN` و`DB_POOL_MAX`. تُضبط الواجهة عبر `API_PROXY_TARGET` و`NEXT_PUBLIC_AUTH_MODE=real`، ولا يُوضع أي سر في متغير `NEXT_PUBLIC_*`.

## التحقق بعد الإعداد

نفّذ الاستعلامات التالية بحساب إداري للقراءة التشخيصية، ثم نفّذ smoke test بحساب `assetx_app`:

```sql
SELECT count(*) AS migration_count FROM schema_migrations;
SELECT count(*) AS public_tables FROM pg_tables WHERE schemaname = 'public';
SELECT count(*) AS rls_tables
FROM pg_class
WHERE relrowsecurity = true AND relkind = 'r';
SELECT tenant_code, name, status FROM tenants ORDER BY tenant_code;
```

يجب أن تكون الترحيلات الحالية اثني عشر ملفاً، من `001_init.sql` حتى `012_location_types_catalog.sql`، بما فيها إصلاحات hierarchy في `011_hierarchy_integrity.sql` وcatalog أنواع المواقع في `012_location_types_catalog.sql`. يجب أن يظهر سياق المستأجر عند تشغيل العملية، وأن تعيد RLS بيانات المستأجر المطلوب فقط. يجب أن يفشل الطلب المحمي بلا JWT، وأن ينجح مع صلاحية صحيحة، وأن يعيد `/health` حالة قاعدة البيانات `ok`. بعد ذلك يُختبر `pg_dump` و`pg_restore` إلى قاعدة منفصلة، ثم PITR وRPO/RTO على المزود السحابي قبل اعتماد production.

## الملفات المرجعية

| الملف | الوظيفة |
|---|---|
| `db/migrations/` | المصدر التنفيذي للمخطط والترحيلات الرقمية |
| `db/seed/001_seed.sql` | notification channels/templates، الأدوار، الحالات، الفئات، الموقع والإعدادات الأساسية |
| `db/seed/002_permissions.sql` | كتالوج الصلاحيات وربطها بالأدوار، idempotent |
| `backend/src/bootstrap/migrate.ts` | CLI الرسمي لتطبيق الترحيلات على PostgreSQL |
| `backend/src/infrastructure/database/postgres.database.ts` | pool وtransaction وrequest-scoped tenant context |
| `ops/staging/provision-runtime-role.sql` | إنشاء/منح دور التشغيل بواسطة مسؤول PostgreSQL |
| `ops/database/seed-tenant.sh` | تشغيل seed tenant-scoped بعد تحديد tenant صراحةً |
| `docs/Staging-Database-Architecture.md` | قرار الفصل بين Local وStaging وProduction |
| `docs/Staging-Rehearsal-Report.md` | نتيجة rehearsal المحلي للترحيلات والنسخ والاستعادة |

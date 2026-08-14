# AssetX — تصميم قاعدة بيانات Staging وProduction

## القرار

تستخدم النسخة المستقلة PGlite تلقائياً عندما لا يكون `DATABASE_URL` موجوداً، وتستخدم PostgreSQL/Supabase عندما يكون `DATABASE_URL` مضبوطاً. هذا يحافظ على سرعة التطوير والاختبارات، لكنه يمنع الخلط بين بيئة local وبيئة production.

| البيئة | قاعدة البيانات | تشغيل migrations | seed تجريبي |
|---|---|---|---|
| Local | PGlite | تلقائياً عبر `initLocalDatabase` | نعم، development فقط |
| Test | PGlite harness | تلقائياً داخل test harness | بيانات اختبار معزولة |
| Staging | PostgreSQL/Supabase | اختيارياً عبر `RUN_MIGRATIONS=true` في deploy مضبوط | لا seed تجريبي؛ provisioning صريح |
| Production | PostgreSQL/Supabase | يفضل job منفصل قبل deploy؛ startup migrations غير مفضلة | لا seed تجريبي |

## PostgreSQL adapter

يستخدم `PostgresDatabase` pool من مكتبة `pg`. كل استعلام أعمال ينفذ داخل transaction قصيرة، ويضبط `app.tenant_id` باستخدام `SET LOCAL`، بينما تُحفظ هوية tenant في `AsyncLocalStorage` بدلاً من متغير مشترك على مستوى pool. هذا التصميم يقلل خطر تسرب سياق tenant بين الطلبات المتزامنة.

يجب أن يتصل staging/production بدور قاعدة بيانات غير مالك للجداول، حتى تكون RLS فعالة. لا ينبغي استخدام `postgres` أو service role في مسار HTTP العام. أما migrations فتستخدم اتصالاً ذا صلاحيات DDL منفصلة في job أو pipeline محمي.

## نقطة يجب إغلاقها قبل production

مسار login يبدأ باسم المستخدم قبل وجود tenant context، بينما جدول `users` محمي بـ RLS. لذلك لا يكفي تشغيل PostgreSQL adapter وحده؛ يجب اعتماد أحد الخيارين قبل staging الحقيقي:

1. إضافة auth lookup function ذات `SECURITY DEFINER` تعيد أقل حقول ممكنة (`user_id`, `tenant_id`, `password_hash`, `is_active`) عبر username، مع صلاحيات تنفيذ محدودة وعدم إعادة صفوف عامة.
2. إلزام login بــ `tenant_code` أو tenant domain ثم ضبط tenant context قبل قراءة المستخدم.

لا يُسمح بإضافة policy عامة تكشف users عبر tenants، ولا باستخدام owner/service role داخل كل طلب كحل سريع.

## Migration policy

يسجل `migration runner` كل migration في جدول `schema_migrations`، ويطبق الملفات الرقمية بالترتيب مرة واحدة. في production يجب تشغيله كـ pipeline job مع backup/rollback plan، وليس تلقائياً عند كل إعادة تشغيل للتطبيق إلا في بيئة staging مضبوطة.

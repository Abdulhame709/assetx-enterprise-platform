# تحقق إعداد قاعدة بيانات AssetX محلياً وسحابياً

**التاريخ:** 16 أغسطس 2026  
**المستودع:** `Abdulhame709/assetx-enterprise-platform`  
**الغرض:** توثيق إنشاء المخطط داخل PostgreSQL المحلي ومشروع Supabase التجريبي الجديد دون حفظ أي اتصال أو كلمة مرور في GitHub.

## القرار التشغيلي

يبقى PostgreSQL المحلي هو المسار الأساسي للتطوير والاختبارات اليومية. يستخدم مشروع Supabase الجديد كنسخة سحابية تجريبية وstaging mirror للمخطط نفسه. لا يوجد reset أو `DROP`؛ طبقت الترحيلات تراكمياً على مشروع Supabase الذي كان فارغاً قبل التنفيذ.

## PostgreSQL المحلي

| الفحص | النتيجة |
|---|---:|
| المنفذ | `127.0.0.1:5432` |
| قاعدة البيانات | `assetx` |
| الترحيلات | 8 |
| جداول `public` | 28 |
| جداول `public` المحمية بـ RLS | 23 |
| tenant المستخدم للتحقق | `local_assetx` |
| أدوار tenant | 7 |
| كتالوج الصلاحيات | 51 |
| روابط الصلاحيات للأدوار | 147 |
| notification templates | 8 |

استخدم المسار المحلي `backend` migration CLI الرسمي، ثم `ops/database/seed-tenant.sh` لتطبيق `db/seed/001_seed.sql` و`db/seed/002_permissions.sql` في سياق tenant صريح. جميع الأسرار المحلية محفوظة خارج المستودع تحت `/home/ubuntu/assetx-runtime/`.

## Supabase التجريبي

تم اختبار الاتصال بمشروع Supabase ذي المرجع `yxttzzdojttfzdrxrciw`، وكان المخطط العام فارغاً قبل التنفيذ (`public tables = 0`). خادم PostgreSQL المعلن من Supabase هو الإصدار 17.6. أُنشئ دور `authenticated` غير قابل لتسجيل الدخول أولاً، ثم طبقت أداة الترحيل الرسمية الملفات الثمانية بنجاح.

| الفحص | النتيجة |
|---|---:|
| المشروع | `https://yxttzzdojttfzdrxrciw.supabase.co` |
| قبل الترحيل | 0 جدولاً في `public` |
| بعد الترحيل | 28 جدولاً في `public` |
| `schema_migrations` | 8 ترحيلات |
| جداول `public` المحمية بـ RLS | 23 |
| الجداول الحرجة | `assets`, `inventory_records`, `audit_events` موجودة |
| دور `authenticated` | موجود |
| tenant التجريبي | `trial` — `AssetX Trial Cloud` |
| أدوار tenant | 7 |
| كتالوج الصلاحيات | 51 |
| روابط الصلاحيات للأدوار | 147 |
| notification templates | 8 |

## تحقق RLS

أُنشئ tenant probe مؤقت داخل transaction، ثم شُغّل حساب `authenticated` مع سياق `app.tenant_id`. أعاد tenant `trial` سبعة أدوار، بينما أعاد tenant probe صفراً. أُجري `ROLLBACK` في نهاية الاختبار، ولذلك لم يبق tenant probe أو بياناته في القاعدة. النتيجة تثبت أن مسار RLS يمنع قراءة صفوف tenant آخر عند استخدام حساب التشغيل وسياق tenant الصحيح.

## ملاحظة SSL

نجح اتصال `psql` باستخدام رابط Supabase مع `sslmode=require`. أما Node `pg` في بيئة التحقق فرفض سلسلة الشهادة المحلية المعترضة عندما استخدم `sslmode=require` وحده. نجح migration runner عند إضافة `uselibpqcompat=true` إلى رابط Node، وهو إعداد توافق خاص ببيئة الاختبار الحالية. في الإنتاج لا ينبغي تعطيل التحقق عشوائياً؛ يجب استخدام شهادة CA موثوقة أو إعداد `sslmode=verify-full` وفق تعليمات مزود PostgreSQL.

## ما لم يُغلق بعد

لم يكتمل اختبار `pg_dump` من هذه البيئة لأن العميل المثبت هو PostgreSQL 16.14 بينما خادم Supabase هو PostgreSQL 17.6، ورفض `pg_dump` التشغيل بسبب اختلاف الإصدار. هذا ليس فشلاً في المخطط، لكنه يعني أن backup/restore السحابي لم يُعتمد بعد. يجب تشغيل `pg_dump/pg_restore` بعميل PostgreSQL 17 متوافق، أو استخدام خدمة النسخ الاحتياطي المُدارة من Supabase، ثم توثيق restore إلى قاعدة منفصلة وقياس RPO/RTO.

كما لم يُنشأ حساب Administrator داخل Supabase، لأن كلمة المرور يجب أن تُحدد خارج GitHub. عند الحاجة يُنشأ مستخدم تجريبي من مسار الإدارة المعتمد بعد اختيار البريد/اسم المستخدم وكلمة المرور، ولا تُحفظ بيانات الاعتماد في هذه الوثيقة.

## الملفات المضافة أو المستخدمة

| الملف | الوظيفة |
|---|---|
| `ops/database/README.md` | دليل المسارين المحلي والسحابي وتسلسل التشغيل |
| `ops/database/seed-tenant.sh` | إنشاء أو اكتشاف tenant وتشغيل seed الأساسي والصلاحيات |
| `ops/database/verify-rls.sql` | اختبار عزل tenantين داخل transaction قابلة للتراجع |
| `db/migrations/001_init.sql` إلى `008_maintenance_orders_workflow.sql` | المصدر التنفيذي للمخطط |
| `db/seed/001_seed.sql` و`db/seed/002_permissions.sql` | البيانات الأساسية وكتالوج الصلاحيات |
| `backend/src/bootstrap/migrate.ts` | migration CLI الرسمي لـ PostgreSQL |

> لا توجد أي قيمة `DATABASE_URL` أو كلمة مرور أو Publishable Key في ملفات المستودع. ملف اتصال Supabase محفوظ خارج المستودع فقط لأغراض التنفيذ المحلي الحالي.

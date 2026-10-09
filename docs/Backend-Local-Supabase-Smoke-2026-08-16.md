# تحقق تشغيل Backend محلياً وعلى Supabase staging

**التاريخ:** 16 أغسطس 2026  
**المستودع:** `Abdulhame709/assetx-enterprise-platform`  
**الفرع:** `chore/phase1-environment-postgres`  
**الهدف:** إثبات أن Backend يستطيع العمل على PostgreSQL المحلي وعلى Supabase staging مع فصل الأسرار والصلاحيات.

## النتيجة التنفيذية

تم تشغيل نسخة Backend محلية على المنفذ `3001` متصلة بقاعدة `assetx` المحلية، ونسخة staging على المنفذ `3002` متصلة بمشروع Supabase التجريبي. نجح `/health` في المسارين وأعاد `database: ok`. نجحت المصادقة، واكتشاف tenant، واختبار المسار المحمي بعد إسناد Administrator مؤقتاً لمستخدم smoke. أُزيلت صلاحيات وجلسات حسابات الاختبار، ثم عُطلت الحسابات وأُخفيت بياناتها بدلاً من حذفها حتى تبقى سجلات التدقيق المرتبطة سليمة.

| الفحص | PostgreSQL المحلي | Supabase staging |
|---|---:|---:|
| Backend | `127.0.0.1:3001` | `127.0.0.1:3002` |
| `/health` | 200، `database: ok` | 200، `database: ok` |
| قاعدة البيانات | `assetx` | `postgres` داخل مشروع Supabase التجريبي |
| migration ledger | 8 | 8 |
| جداول `public` | 28 | 28 |
| tenant المستخدم | `local_assetx` | `trial` |
| تسجيل المستخدم | 201 | 201 |
| تسجيل الدخول | 201 | 201 |
| `/tenant/current` | 200 | 200 |
| `/assets` دون توكن | 401 | 401 |
| `/assets` بصلاحية Administrator | 200، `items: []` | 200، `items: []` |

## مسار PostgreSQL المحلي

الخدمة الموجودة على المنفذ `3001` كانت تعمل مسبقاً من مجلد Backend. أعاد health:

```json
{"status":"ok","database":"ok"}
```

استخدم اختبار smoke tenant `local_assetx`، وسُجل مستخدم مؤقت ثم أُسند إليه دور Administrator من حساب الترحيلات. قبل إسناد الدور، كان الوصول إلى `/assets` مرفوضاً بـ `403`، وهو سلوك صحيح يثبت أن التسجيل وحده لا يمنح صلاحيات تشغيلية. بعد إسناد Administrator، أعاد تسجيل الدخول `201` وأعاد `/assets?limit=1` حالة `200` مع قائمة فارغة، لأن tenant لا يحتوي أصولاً بعد.

أعاد الطلب بدون Authorization حالة `401`. أعاد `/tenant/current` بيانات tenant المحلي الصحيحة. بعد انتهاء الاختبار أزيلت أدوار وجلسات المستخدم المؤقت، وعُطل الحساب وأُعيدت تسمية المستخدم إلى قيمة أرشيفية غير شخصية بسبب وجود سجلات تدقيق مرتبطة تمنع الحذف المرجعي.

## مسار Supabase staging

كان اتصال Node الأول عبر pooler يرفض الطلب بسبب عدم وجود معرف tenant في اسم المستخدم. تم تصحيح ذلك باستخدام اسم مستخدم pooler الكامل:

```text
assetx_app.yxttzzdojttfzdrxrciw
```

أُنشئ حساب `assetx_app` كحساب تشغيل منفصل، ومُنح فقط صلاحيات المخطط والجداول والدوال المطلوبة، مع عضوية `authenticated`. بقي اتصال الترحيلات منفصلاً عبر مالك/حساب الترحيل، ولم يُستخدم حساب مالك القاعدة في تشغيل Backend.

بعد التصحيح أعاد Backend staging health بحالة `200` و`database: ok`. نجح تسجيل المستخدم وتسجيل الدخول، ثم أُسند Administrator مؤقتاً عبر اتصال الإدارة. أعاد `/tenant/current` حالة `200`، ورفض `/assets` بدون Authorization بحالة `401`، ثم أعاده بحساب Administrator بحالة `200` وقائمة فارغة. نُظفت بيانات smoke بعد الاختبار بالطريقة نفسها المستخدمة محلياً.

## قرار التشغيل الحالي

يُستخدم PostgreSQL المحلي كمسار التطوير والاختبارات اليومية. يستخدم Supabase staging كمسار سحابي تجريبي. لا يتصل Web بقاعدة البيانات مباشرة؛ يتصل Web بـ Backend، وBackend يتصل بالمسار المحلي أو السحابي بحسب ملف البيئة.

| ملف البيئة | الاستخدام | مكانه |
|---|---|---|
| `migrator.local.env` | ترحيلات PostgreSQL المحلي | خارج Git تحت `/home/ubuntu/assetx-runtime/` |
| `backend.local.env` | Backend المحلي | خارج Git تحت `/home/ubuntu/assetx-runtime/` |
| `supabase.trial.env` | اتصال الإدارة والترحيلات السحابية | خارج Git تحت `/home/ubuntu/assetx-runtime/` |
| `backend.supabase.trial.env` | Backend staging بحساب `assetx_app` | خارج Git تحت `/home/ubuntu/assetx-runtime/` |

لم تُضاف أي قيمة `DATABASE_URL` أو كلمة مرور أو JWT secret إلى GitHub. يجب تدوير كلمة مرور Supabase التي ظهرت سابقاً في المحادثة بعد انتهاء الإعداد.

## الملاحظات المتبقية قبل تحسين الواجهة

التشغيل المحلي والسحابي أصبح قابلاً للتحقق، لكن لا تزال هناك بوابة تشغيلية منفصلة قبل الإنتاج: اختبار backup/restore بعميل PostgreSQL 17 متوافق، تفعيل PITR وقياس RPO/RTO، وربط Web staging برابط نشر فعلي إذا كان المطلوب مراجعته من الهاتف. بعد ذلك يبدأ تحسين Web من صفحة التقارير، وفق تقرير:

```text
docs/Legacy-UI-Comparison-and-Enhancement-Plan-2026-08-16.md
```

## ملفات التشغيل ذات الصلة

- `docs/Local-Database-Connection-Guide.md`
- `ops/database/README.md`
- `ops/database/seed-tenant.sh`
- `ops/database/verify-rls.sql`
- `backend/src/bootstrap/migrations.ts`
- `backend/.env.example`
- `web/DEVELOPER_SETUP.md`

# AssetX — Staging Rehearsal Report

**المستودع:** `Abdulhame709/assetx-enterprise-platform`  
**النطاق:** PostgreSQL محلي مؤقت يحاكي مسار staging، دون أسرار أو بيانات إنتاجية.

## النتيجة التنفيذية

نجح أول rehearsal فعلي لمسار PostgreSQL. تم تشغيل جميع migrations السبعة على قاعدة `assetx_rehearsal` باستخدام migration job مستقل، ثم أُعيد تشغيل job مرة ثانية دون تكرار في `schema_migrations`. كما نجح backup/restore smoke test عبر `pg_dump` و`pg_restore` إلى قاعدة منفصلة، واستُعيد المخطط ودالة `authenticate_user` وبيانات sentinel.

هذه النتيجة تثبت قابلية مسار migration والنسخ/الاستعادة في بيئة PostgreSQL محلية، لكنها لا تعادل اعتماد production؛ فما زال يلزم تنفيذ الاختبار على مزود PostgreSQL/Supabase الفعلي، مع TLS ونسخ احتياطية مُدارة وقياس RPO/RTO.

## مصفوفة النتائج

| الاختبار | النتيجة | الدليل |
|---|---:|---|
| PostgreSQL متاح محلياً | ناجح | `pg_isready` على `127.0.0.1:5432` |
| تطبيق migrations لأول مرة | ناجح | `schema_migrations` احتوى 7 إصدارات |
| إعادة تطبيق migrations | ناجح | بقي العدد 7، والتكرار 0 |
| الجداول الحرجة | ناجح | `auth_sessions` و`password_reset_tokens` و`schema_migrations` موجودة |
| auth lookup function | ناجح | `authenticate_user` موجودة في `pg_proc` |
| عزل users بين مستأجرين | ناجح | اختباران مخصصان في `tenant-isolation.integration.spec.ts` |
| refresh rotation/replay | ناجح | اختبار المصادقة يرفض التوكن القديم ويقبل البديل |
| backup/restore | ناجح | sentinel data والمخطط والدالة استُعيدت إلى قاعدة منفصلة |

## قرار الصلاحيات

أظهر rehearsal أن migration runner لا ينبغي أن ينشئ أدوار PostgreSQL؛ فقد فشل التشغيل الأول عندما حاول `assetx_migrator` إنشاء دور `authenticated` دون CREATEROLE. تم تصحيح الإجراء التشغيلي بتوفير `ops/staging/provision-runtime-role.sql` ليُشغّل مرة واحدة بواسطة مسؤول PostgreSQL، ثم يعمل migration runner بصلاحيات DDL على قاعدة يملكها migrator دون الحاجة إلى إنشاء أدوار.

هذا الفصل مقصود: مسؤول المنصة ينشئ الأدوار، وmigration job يطبق المخطط، وruntime role يخدم HTTP فقط. لا ينبغي منح backend صلاحية CREATEROLE أو استخدام مالك قاعدة البيانات في كل طلب.

## القيود المتبقية قبل production

لم يُنفذ rehearsal على Supabase أو PostgreSQL خارجي فعلي، ولم تُختبر استعادة نقطة زمنية PITR أو قياسات RPO/RTO. كذلك لم تُشغّل الجولة الكاملة لجميع suites على هذه البيئة بسبب ضغط الذاكرة في sandbox؛ نجحت الاختبارات المركزة الخاصة بالمصادقة والعزل، ويجب تشغيل المجموعة الكاملة على runner بذاكرة أعلى أو على دفعات.

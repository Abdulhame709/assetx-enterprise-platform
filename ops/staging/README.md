# AssetX Staging Runbook

## المتطلبات

تحتاج بيئة staging إلى Docker/Compose، وPostgreSQL أو Supabase مُدار، ودور قاعدة بيانات runtime غير مالك للجداول، ومخزن أسرار يحوي `DATABASE_URL` و`JWT_ACCESS_SECRET` و`JWT_REFRESH_SECRET` و`CORS_ORIGIN`. يجب أن يمر الاتصال عبر TLS وأن تكون قاعدة البيانات قابلة للوصول من شبكة backend فقط.

## ترتيب النشر

1. انسخ `ops/staging/.env.example` إلى ملف أسرار خارج GitHub، ثم املأ القيم الفعلية.
2. أنشئ دور `authenticated` مرة واحدة بواسطة مسؤول PostgreSQL عبر `ops/staging/provision-runtime-role.sql`، واربط حساب التشغيل به أو امنحه الامتيازات المكافئة، ولا تمنح backend صلاحية CREATEROLE.
3. ابنِ صورتي backend وweb عبر `docker compose -f docker-compose.staging.yml build`.
4. شغّل migration job منفصلاً قبل التطبيق: `docker compose -f docker-compose.staging.yml run --rm backend node backend/dist/bootstrap/migrate.js`. ثم أنشئ مستأجراً أولياً، واضبط `app.tenant_id` في جلسة seed، وشغّل `db/seed/001_seed.sql` ثم `db/seed/002_permissions.sql`.
5. شغّل الخدمات: `docker compose --env-file ops/staging/.env -f docker-compose.staging.yml up -d`.
6. تحقق من `GET /health` للخلفية وفتح `/login` للواجهة، ثم نفذ smoke tests وcross-tenant tests.
7. نفذ `ops/staging/backup-restore-smoke.sh` على قاعدة restore مؤقتة فقط، مع `ALLOW_DESTRUCTIVE_RESTORE=true`.

لا ينبغي تشغيل `RUN_MIGRATIONS=true` في service backend الإنتاجية. التطبيق المتكرر للـ migrations يجب أن يبقى jobاً محمياً ومراجَعاً، مع backup قبل migrations البنيوية.

## التراجع

إذا فشل health check أو smoke test، أوقف الترقية وأعد تشغيل image السابقة عبر tag أو commit معروف. لا تُعكس migrations تلقائياً إذا كانت قد غيّرت بيانات؛ يجب استخدام migration عكسية أو استعادة backup بعد قرار تشغيلي موثق.

## حدود الحالة الحالية

تم تنفيذ rehearsal فعلي على PostgreSQL محلي: migrations الثمانية نجحت، وإعادة التطبيق عبر منفذ الترحيلات كانت idempotent. هذه النتيجة لا تعني أن staging الحقيقي نُشر؛ لا توجد في هذا المستودع بيانات اتصال أو أسرار أو صلاحيات بنية تحتية. قبل الإنتاج يجب تكرار rehearsal على PostgreSQL/Supabase الفعلي، وفحص PITR وRPO/RTO، وإضافة reverse proxy/TLS ومراقبة مركزية، والتحقق من أن حساب التشغيل يرى صلاحيات tenant المستهدف فقط بعد تشغيل seed الصلاحيات.

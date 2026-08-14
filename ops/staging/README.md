# AssetX Staging Runbook

## المتطلبات

تحتاج بيئة staging إلى Docker/Compose، وPostgreSQL أو Supabase مُدار، ودور قاعدة بيانات runtime غير مالك للجداول، ومخزن أسرار يحوي `DATABASE_URL` و`JWT_ACCESS_SECRET` و`JWT_REFRESH_SECRET` و`CORS_ORIGIN`. يجب أن يمر الاتصال عبر TLS وأن تكون قاعدة البيانات قابلة للوصول من شبكة backend فقط.

## ترتيب النشر

1. انسخ `ops/staging/.env.example` إلى ملف أسرار خارج GitHub، ثم املأ القيم الفعلية.
2. ابنِ صورتي backend وweb عبر `docker compose -f docker-compose.staging.yml build`.
3. شغّل migration job منفصلاً قبل التطبيق: `docker compose -f docker-compose.staging.yml run --rm backend node backend/dist/bootstrap/migrate.js`.
4. شغّل الخدمات: `docker compose --env-file ops/staging/.env -f docker-compose.staging.yml up -d`.
5. تحقق من `GET /health` للخلفية وفتح `/login` للواجهة، ثم نفذ smoke tests وcross-tenant tests.

لا ينبغي تشغيل `RUN_MIGRATIONS=true` في service backend الإنتاجية. التطبيق المتكرر للـ migrations يجب أن يبقى jobاً محمياً ومراجَعاً، مع backup قبل migrations البنيوية.

## التراجع

إذا فشل health check أو smoke test، أوقف الترقية وأعد تشغيل image السابقة عبر tag أو commit معروف. لا تُعكس migrations تلقائياً إذا كانت قد غيّرت بيانات؛ يجب استخدام migration عكسية أو استعادة backup بعد قرار تشغيلي موثق.

## حدود الحالة الحالية

الملفات الموجودة هنا هي baseline قابل للتشغيل والتحقق، وليست دليلاً على أن staging الحقيقي تم نشره؛ لا توجد في هذا المستودع بيانات اتصال أو أسرار أو صلاحيات بنية تحتية. قبل الإنتاج يجب تنفيذ migration rehearsal على نسخة PostgreSQL حقيقية، وفحص backup/restore، وإضافة reverse proxy/TLS ومراقبة مركزية.

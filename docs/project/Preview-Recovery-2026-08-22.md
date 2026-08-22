# Preview Recovery — 2026-08-22

تم تشخيص رابط المعاينة وصفحة التقارير من خلال الخادم العام.

## Findings

1. خادم Next.js القديم كان يعمل من مجلد `.next/standalone` محذوف بعد إعادة البناء، لذلك كانت ملفات CSS وJavaScript الثابتة تعيد 404، وظهرت الواجهة دون تنسيق أو بدت متوقفة.
2. تمت إعادة تشغيل خادم Next.js من مجلد `.next/standalone` الحالي على `PORT=3010`، وأصبحت صفحة التقارير وملفات CSS وchunks تعيد HTTP 200.
3. كان backend على المنفذ 3001 مرتبطاً بقاعدة PostgreSQL/Supabase لا تحتوي حساب المعاينة `admin`، مما سبب `INVALID_CREDENTIALS`.
4. تمت إعادة تشغيل backend مؤقتاً بدون `DATABASE_URL` باستخدام PGlite المهيأ محلياً، مع حساب المعاينة `admin / AdminPass123`، دون تعديل قاعدة Supabase أو إضافة أسرار للمستودع.
5. تم التحقق من تسجيل الدخول بنجاح، وظهور لوحة التحكم، ثم فتح صفحة `/reports` بنجاح.
6. صفحة التقارير ظهرت باللغة العربية وتحتوي على اختيار المصدر والصيغة والحد، مصمم الأعمدة، الفرز، التجميع والحسابات، والقوالب المشتركة.

## Current preview

- Web: port 3010, started from `web/.next/standalone`, `PORT=3010 node server.js`.
- Backend: port 3001, temporary PGlite preview runtime, started without `DATABASE_URL`.
- Public URL: `https://3010-irpjgx3u4two5teoe4qns-0fac8488.us4.manus.computer`
- Reports URL: `/reports`
- Login: `admin / AdminPass123` (demo preview only).

## User-facing note

The preview database is temporary and in-memory. It is for viewing and testing the interface only; it is not the cloud database and its demo data may reset when the backend restarts.

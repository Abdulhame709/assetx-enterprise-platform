# Mobile preview diagnosis

بعد تسجيل الدخول وإعادة فتح `/dashboard` ظهرت صفحة بيضاء مع شكل دائري أسود ضخم. مصدر HTML يوضح أن AppShell عالق في حالة `SessionProvider` loading ويعرض SVG التحميل الصغير `animate-spin h-8 w-8 text-brand`.

الفحص المحسوب داخل المتصفح أظهر أن SVG نفسه أصبح بعرض وارتفاع يقارب 1134px، وأن `animation-name` يساوي `none` ولونه أسود. كما أن stylesheet production المحملة لا تحتوي على قواعد `.h-8` أو `.w-8` أو `.animate-spin`. هذا يعني أن المشكلة ليست من شعار AssetX ولا من بيانات الدخول؛ بل من فقدان utility classes الأساسية في CSS production، ما يجعل SVG inline يتمدد إلى حجم العنصر المتاح.

الإجراء التالي: تعديل CSS العام أو مكوّن Spinner ليملك أحجاماً inline/مضمّنة لا تعتمد على utilities وحدها، وإضافة قواعد ثابتة لـ animate-spin وspinner dimensions، ثم إعادة البناء والتحقق.


بعد إعادة تشغيل `node server.js` من مجلد `.next/standalone`، أصبح ملف CSS يجيب HTTP 200 بحجم 32,443 بايت، واختفى الشكل الدائري الأسود. ظهرت لوحة التحكم وصفحة الأصول بتنسيق RTL الصحيح، وظهرت أوامر الشريط كأيقونات فقط مع tooltips: البحث، CSV، PDF، الطباعة/الحفظ كـ PDF، الاستيراد، المعاينة، الإضافة، النسخ، التعديل، الحذف، والتراجع.

النتيجة: سبب الصورة كان تشغيل standalone من مجلد العمل الخطأ، ما جعل Next يعيد HTML لكن لا يقدم `/_next/static` فبقيت الواجهة بلا CSS. الإصلاح التشغيلي هو تشغيل الخادم من `/home/ubuntu/assetx-enterprise-platform/web/.next/standalone`.


تم تشغيل `npm run lint`: النتيجة 0 أخطاء و17 تحذيراً من قاعدة React hooks، وهي تحذيرات موجودة في مكوّنات متعددة وليست أخطاء تمنع البناء أو التشغيل. TypeScript والاختبارات وproduction build ما زالت ناجحة.

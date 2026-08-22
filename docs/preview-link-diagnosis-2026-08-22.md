# تشخيص رابط المعاينة — 2026-08-22

الخادم المحلي على المنفذ 3010 يستجيب لـ`/dashboard` و`/models` برمز HTTP 200، والعملية الحالية هي Next.js standalone من `web/.next/standalone`.

عند فتح الرابط العام في المتصفح، ظهر عنوان AssetX لكن الصفحة بقيت على spinner أسود كبير دون عناصر تفاعلية. هذا يعني أن طلب HTML يصل، لكن تطبيق React لا يكمل الإقلاع أو يبقى في حالة تحميل، ويرجح أن السبب اعتماد frontend على backend التجريبي غير المنشور أو خطأ runtime في JavaScript. يجب فحص إعدادات API وconsole قبل اعتبار الرابط صالحاً للمستخدم.

لا تُعتبر المعاينة مُسلّمة حتى يظهر login أو dashboard فعلياً، لا مجرد HTTP 200.

## نتيجة console والشبكة

في المتصفح كانت `document.readyState` = `complete` لكن `document.body.innerText` فارغاً، مع تحميل ملفات CSS وJavaScript من `/_next/static`. لم يظهر console output واضح. هذا يستبعد أن المشكلة مجرد انتظار تحميل HTML، ويشير إلى أن hydration/runtime لا يرسم التطبيق أو أن overlay/loader ثابت بسبب فشل سياق الجلسة أو API.

## إعادة التحميل

بعد تثبيت مستمعات `error` و`unhandledrejection` وإعادة تحميل الرابط، بقيت الصفحة على spinner ولم تُلتقط أخطاء runtime. هذا يرجّح أن التطبيق ينتظر حالة session/auth أو طلباً لا ينتهي، بدلاً من crash صريح. يلزم فحص `SessionProvider` وعميل API وعملياته في preview.

## سلوك المسارات

المسار `/login` يفتح نموذج تسجيل الدخول فعلياً، بينما الجذر `/` يعيد التوجيه إلى `/dashboard`؛ وبما أن Dashboard محمي ولا توجد session في المتصفح الجديد، بقيت شاشة AppShell على spinner. لذلك يجب تسليم رابط `/login` مباشرة للمستخدم، أو إصلاح AppShell لاحقاً ليعرض حالة إعادة التوجيه بشكل واضح بدلاً من spinner غير مفسر.

## بعد إصلاح AppShell

تم تعديل AppShell ليعرض رسالة دخول واضحة للحالة `unauthenticated`، ثم أُعيد بناء Next.js وإعادة تشغيل standalone. عند إعادة فتح `/dashboard` بقيت لقطة المتصفح على spinner نفسه. لذلك لا يكفي تعديل رسالة الحالة، ويجب التحقق من أن العملية الحالية تخدم build الجديد فعلاً، ومن أن `SessionProvider` لا يبقى في `loading` بسبب نسخة JavaScript قديمة أو طلب auth لا ينتهي.

## السبب المؤكد

فحص ملفات JavaScript من داخل المتصفح أعاد HTTP 404 لكل chunks المطلوبة تحت `/_next/static/chunks/`. لذلك كان HTML يصل، لكن hydration لا يعمل ويبقى spinner SSR ثابتاً. السبب التشغيلي أن build الأخير نُفّذ عبر `next build` مباشرة، بينما سكربت المشروع الكامل يشغّل بعدها `scripts/prepare-standalone.sh` لنسخ static assets إلى مجلد standalone. الحل هو تشغيل خطوة التحضير ثم إعادة تشغيل الخادم.

## الإصلاح الناجح

بعد تشغيل `prepare-standalone.sh` وإعادة تشغيل الخدمة، فتح `/dashboard` أعاد التوجيه فعلياً إلى `/login` وظهر نموذج الدخول التفاعلي. هذا يؤكد أن سبب العطل كان static chunks المفقودة، وليس backend أو session logic.

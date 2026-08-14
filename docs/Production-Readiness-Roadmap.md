# AssetX Enterprise Platform — خارطة طريق الجاهزية الإنتاجية

**المستودع المستقل:** `Abdulhame709/assetx-enterprise-platform`  
**المرجع:** `main` عند إنشاء النسخة المستقلة  
**الهدف:** نقل AssetX من baseline متقدم قبل الإنتاج إلى منصة مؤسسية قابلة للنشر، ثم إضافة تطبيق موبايل للجرد الميداني مع offline sync موثوق.

## مبدأ العمل

سيبقى المستودع الأصلي `Abdulhame709/ASSETS-X` مستقلاً وغير متأثر. كل التطوير والاختبارات وطلبات الدمج المستقبلية ستتم داخل هذا المستودع الجديد فقط. لا يُسمح بالدمج إلى أي مستودع خارجي إلا بتفويض صريح لاحقاً.

## مراحل التنفيذ

| المرحلة | الهدف | المخرجات الرئيسية | بوابة الخروج |
|---|---|---|---|
| **P0 — Security Baseline** | إغلاق الثغرات التي تمنع النشر | reset token آمن، أسرار إجبارية في production، تحديث الاعتماديات، تحقق مدخلات، rate limiting، security headers | اختبارات أمنية سلبية ناجحة وعدم وجود ثغرات حرجة معروفة |
| **P1 — Production Foundation** | جعل التشغيل قابلاً للنشر والتراجع والمراقبة | PostgreSQL/Supabase production، migrations آلية، Docker، CI/CD، secret management، health checks، logs، metrics، backups | نشر staging آلي مع rollback وقياس RPO/RTO |
| **P2 — Identity & Multi-Tenant Hardening** | تثبيت الهوية والعزل المؤسسي | Redis/DB sessions، refresh rotation، cookies آمنة، request-scoped tenant context، cross-tenant tests، MFA-ready | اختبار متزامن بلا تسرب بين مستأجرين عبر أكثر من instance |
| **P3 — Product Completion** | إغلاق فجوات تجربة الويب | employees، settings، notifications consumer، QR/barcode، search، reports، analytics، administration، maintenance، attachments | كل route ظاهر له implementation وpermission gate واختبار E2E |
| **P4 — Mobile Field App** | بناء تطبيق موبايل للجرد | Flutter أو React Native بقرار ADR، auth، campaigns، QR scan، photo/GPS، local store، outbox/inbox | تسجيل جرد كامل دون شبكة ثم مزامنة بلا فقد أو تكرار |
| **P5 — Sync & Resilience** | جعل offline-first قابلاً للاعتماد المؤسسي | device identity، idempotency keys، cursor sync، retries، conflict policy، encryption، observability | اختبارات قطع الشبكة والتعارض والاستئناف ناجحة |
| **P6 — Scale & Operations** | تجاوز حدود MVP | async exports، queue/workers، object storage، audit retention، partitioning، read models، performance tests، SBOM | اختبارات حمل وأداء ونسخ/استعادة موثقة |
| **P7 — Release & SaaS** | إطلاق تدريجي مضبوط | release trains، semantic versioning، tenant onboarding، billing/integrations عند اعتمادها، UAT، runbooks | قبول أصحاب المصلحة وإصدار production موثق |

## الأولويات الحالية

الأولوية الحالية هي **P0**، وليس إضافة خصائص جديدة. تم تنفيذ أول خطوة في هذه المرحلة داخل النسخة المستقلة: أصبح reset-password يعتمد على رمز عشوائي عالي entropy، ويُخزن hash فقط، وينتهي بعد 15 دقيقة، ويُستهلك مرة واحدة، ويُبطل جلسات المستخدم، مع migration واختبار تكامل جديد. كما أُضيفت إعدادات Jest المنفصلة للوحدة والتكامل لإصلاح أوامر الاختبار المعلنة.

تم تنفيذ `ValidationPipe` مع DTOs مصادقة قابلة للتحقق، وإجبار إعدادات الأسرار وCORS في production، وإضافة rate limiting وHelmet، وترقية Next.js إلى 14.2.35. نجحت اختبارات الوحدة 7/7، واختبارات المصادقة 9/9، وبناء الواجهة واختباراتها 51/51. ما زال فحص الاعتماديات يحتاج معالجة بقية التحذيرات العالية قبل إعلان P0 مغلقاً بالكامل.

الخطوة التالية هي استكمال فحص الاعتماديات، ثم الانتقال إلى CI/CD وDocker وبيئة staging قبل أي عمل كبير على الموبايل.

## قرار تطبيق الموبايل

لن يُبنى تطبيق الموبايل قبل تثبيت عقد API والمزامنة. يجب اعتماد قرار تقني منفصل يحدد Flutter أو React Native، ثم توثيق نموذج local database، وشكل outbox/inbox، وسياسة التعارض، والـ idempotency، وإصدار schema المحلي. الهدف ليس مجرد تحويل صفحات الويب إلى شاشات موبايل، بل دعم عملية الجرد في بيئة متقطعة الاتصال مع أثر تدقيقي قابل للمراجعة.

## معايير الجاهزية للإنتاج

لا يُعلن الإصدار إنتاجياً قبل نجاح البناء والاختبارات والفحص الأمني وفحص الاعتماديات وفحص الأسرار وcontract tests وcross-tenant isolation وmigration rehearsal وbackup restore وload smoke test. يجب أن يكون لكل release commit محدد، وملف تغييرات، وخطة rollback، وrunbook للتشغيل، ومؤشرات مراقبة، ومسؤول واضح عن القرار.

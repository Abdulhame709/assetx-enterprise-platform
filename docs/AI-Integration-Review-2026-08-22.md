# مراجعة دمج الذكاء الاصطناعي في AssetX

**التاريخ:** 2026-08-22  
**الحالة:** مراجعة معمارية قبل التنفيذ  
**النطاق:** backend NestJS، واجهة Next.js، الجرد غير المتصل، التقارير، الأمن متعدد المستأجرين

## الملخص التنفيذي

المشروع مصمم ليكون **AI Ready**، وتوجد مواصفة واضحة لطبقات الذكاء الاصطناعي: قدرات L1 للبحث الذكي وكشف التكرار والتقارير باللغة الطبيعية وكشف الشذوذ، ثم L2 لمقارنة الصور والتصنيف، وL3 للصيانة التنبؤية.[1] كما توجد مواصفة تنفيذية للجرد المدعوم بالذكاء الاصطناعي تؤكد أن الذكاء الاصطناعي مساعد اقتراح وتحذير، وليس جهة اعتماد أو تغيير تلقائي لبيانات الأصل.[2]

لكن لا يوجد حالياً تكامل LLM فعلي داخل كود AssetX. لا توجد طبقة provider أو إعدادات AI في `backend/.env.example`، كما أن `AppModule` لا يسجل خدمة LLM. الموجود فعلياً هو مساعد L1 حتمي وقابل للتفسير لكشف فروقات الموقع والكمية، مع route محمي وواجهة داخل صفحة دورة الجرد.[5][6][7][8] لذلك يجب عدم وصف النظام الحالي بأنه يحتوي chatbot أو LLM؛ الوصف الصحيح هو **مساعد تشغيلي حتمي جاهز للتوسعة**.

## ما هو منفذ فعلياً

| المجال | الملف/المسار | الحالة الحالية |
|---|---|---|
| كشف فروقات الموقع والكمية | `backend/src/application/asset-algorithms.ts` | خوارزمية حتمية تنتج `riskScore` و`riskLevel` و`reasonCodes` و`recommendedAction`. |
| API المساعد | `GET /inventory/cycles/:id/location-suggestions` | محمي بالمصادقة وtenant والصلاحية `inventory.view`، للقراءة فقط. |
| واجهة المساعد | `web/src/app/(dashboard)/inventory/[id]/page.tsx` | بطاقة مراجعة تعرض الفروقات وزر فتح مسار الجرد العادي؛ لا تنفذ نقلاً تلقائياً. |
| عقد الواجهة | `web/src/features/inventory/api.ts` | يقرأ الاقتراحات ويطبعها إلى أنواع آمنة. |
| قواعد الحوكمة | `docs/AI-Assisted-Location-Inventory-Implementation-Spec.md` | تمنع تعديل الأصل أو الكمية أو الحركة دون تأكيد بشري وتدقيق. |
| البحث عن التشابه | `asset-algorithms.ts` | تطبيع نصي وLevenshtein similarity؛ ليس نموذج ML ولا embedding. |
| التقارير | `ReportBuilderService` و`ExportPipelineService` | مصدر منظم ممتاز لميزة ملخص التقرير باللغة الطبيعية لاحقاً. |

## ما هو مخطط في الوثائق ولم يُنفذ بعد

| الطبقة | القدرات المخططة | وضعها الصحيح الآن |
|---|---|---|
| L1 | البحث الذكي، كشف التكرار، ملخصات التقارير، كشف الشذوذ | يبدأ بعد إنشاء طبقة مزود آمنة؛ كشف الشذوذ المكاني الحالي هو خطوة تمهيدية منفذة حتمياً.[3] |
| L2 | مقارنة الصور والتصنيف التلقائي وتحليل السبب الجذري | مؤجل حتى اعتماد التخزين والموافقة والاحتفاظ بالصور.[1][2] |
| L3 | الصيانة التنبؤية والصوت والمسارات الذكية | مؤجل حتى توفر تاريخ صيانة وتشغيل كافٍ وسياسة قياس دقيقة.[1][4] |

## قرار الدمج المقترح

يُدمج الذكاء الاصطناعي داخل طبقة backend فقط، وفق Clean Architecture، ولا تستدعي الواجهة مزود النموذج مباشرة. هذا متسق مع فصل الطبقات المعتمد في معمارية AssetX ومع متطلب عدم كشف الأسرار.[1][9] يكون التصميم على النحو الآتي:

```text
Web / Mobile
    │  REST محمي + بيانات نطاق محددة
    ▼
AI Controller
    │  Auth + Tenant + Permission + Rate Limit
    ▼
AI Application Services
    │  إعداد prompt، allowlist للحقول، JSON schema، fallback
    ▼
AI Provider Port
    │
    ├── Deterministic provider: يعمل دائماً للقواعد الحرجة
    └── LLM provider: اختياري ومغلق افتراضياً حتى تهيئة الأسرار
         │
         ▼
OpenAI-compatible model endpoint / platform model gateway
```

يُضاف منفذ مثل `AI_TEXT_PROVIDER` إلى `backend/src/core/ports/tokens.ts`، مع عقد typed يقبل رسائل أو payload منظم ويعيد نتيجة موثقة. يضاف adapter في `backend/src/infrastructure/ai/`، وتُبقي الخدمات التطبيقية قرار النطاق والسياسة والتحقق خارج adapter حتى لا يصبح المزود مالكاً لقواعد الأعمال.

## أول ميزة يجب تنفيذها

الأولوية الأولى هي **ملخص التقرير التشغيلي باللغة العربية**، لأن مصمم التقارير أصبح يملك تعريفاً منظماً للأعمدة والفرز والتجميع، ولأن الميزة قراءة فقط ولا تغيّر بيانات الأصول. يرسل backend إلى النموذج ملخصاً tenant-scoped ومحدود الحقول، مثل عدد الأصول، القيم المجمعة، فروقات الجرد، أعلى المواقع خطورة، والفترة الزمنية. يستقبل JSON منظماً يحتوي على `summary` و`key_findings` و`warnings` و`confidence` و`evidence`، ثم تعرضه صفحة التقارير في بطاقة منفصلة مع زر «إنشاء ملخص ذكي».

بعدها تُوسّع ميزة مساعد الجرد الحالية بطريقة آمنة: تبقى درجة الخطر وقرار اقتراح النقل من الخوارزمية الحتمية، ويمكن للـLLM أن يعيد صياغة السبب بالعربية أو يرتب الأولويات فقط. لا يُسمح له بتغيير `location_id` أو `quantity` أو `status_id` أو إنشاء حركة.

## واجهات API المقترحة

| المسار | الوظيفة | القاعدة |
|---|---|---|
| `POST /ai/reports/summary` | إنشاء ملخص عربي لتعريف تقرير ونتائجه | قراءة فقط، tenant-scoped، يحتاج `report.view` و`ai.use`. |
| `POST /inventory/cycles/:id/ai-explanation` | صياغة تفسير للفروقات بعد تشغيل القواعد الحتمية | لا يعيد إلا نصاً منظماً وأدلة، ولا ينشئ حركة. |
| `POST /ai/search/plan` | تحويل سؤال طبيعي إلى خطة بحث allowlisted | لا ينفذ SQL؛ يمرر الخطة إلى `SearchService` بعد validation. |

لا يبدأ التنفيذ بواجهة chat عامة؛ فهي أوسع من حاجة المنتج وتزيد مخاطر تسريب البيانات وصعوبة التدقيق. تُبنى الميزات حول مهام محددة ذات مدخلات ومخرجات معروفة.

## الحماية والعزل

يجب أن يحدد backend `tenant_id` من JWT ولا يقبله من body كمرجع موثوق. تُجمع البيانات بواسطة services الحالية بعد تطبيق tenant context، وتُرسل إلى النموذج بعد allowlist للحقول وإخفاء أي بيانات شخصية غير ضرورية. يجب ألا تُرسل كلمات المرور أو رموز JWT أو بيانات الاتصال أو تفاصيل الموظفين الحساسة أو صور/GPS دون صلاحية وموافقة.

كل طلب AI يحتاج صلاحية مستقلة `ai.use`، وتحديداً للحسابات التي يمكنها رؤية التقرير أو الجرد. تُطبق حدود حجم الإدخال والمهلة ومعدل الطلب، ويُعاد fallback حتمي عند عدم توفر المزود أو انتهاء المهلة. تسجل العملية في audit metadata: المستخدم، tenant، الميزة، model id، prompt version، زمن التنفيذ، النتيجة العامة، ولا يُسجل النص الحساس كاملاً.

يجب استخدام JSON Schema صارم للمخرجات، والتحقق من كل قيمة قبل عرضها، وعدم السماح للنموذج بإرجاع identifiers غير موجودة في payload. أي اقتراح حركة يحتاج المسار الحالي للتأكيد والاعتماد، ولا يُستدعى من tool calling مباشر.

## الإعدادات والأسرار

لا تُضاف مفاتيح إلى GitHub أو `NEXT_PUBLIC_*`. يضاف لاحقاً إلى إعداد backend في secret manager فقط ما يلزم، مثل `AI_ENABLED` و`AI_PROVIDER` و`AI_MODEL` و`AI_BASE_URL` و`AI_API_KEY` و`AI_TIMEOUT_MS` و`AI_MAX_OUTPUT_TOKENS`. في التطوير يمكن أن يكون `AI_ENABLED=false`، فتعمل الميزات الحتمية وتظهر حالة «المساعد الذكي غير مهيأ» بدلاً من زر وهمي.

في بيئة AssetX الحالية، backend هو NestJS مستقل وليس scaffold يحتوي `server/_core/llm`. لذلك لا ينبغي نسخ import خاص بقوالب WebDev مباشرة إلى هذا المشروع. إذا استُخدم gateway متوافق مع OpenAI، يكون الاتصال من adapter الخادمي فقط، مع provider abstraction يسمح بالتبديل بين gateway الداخلي ومزود مؤسسي آخر دون تعديل الخدمات أو الواجهة.

## الترتيب التنفيذي

1. إنشاء عقود AI والـprovider port وإعدادات feature flag مع provider حتمي تجريبي، وإضافة `ai.use` إلى permission catalog.
2. تنفيذ `ReportNarrativeService` على بيانات تقرير مجمعة ومحدودة، مع JSON Schema وfallback واختبارات tenant والصلاحيات والمهلة.
3. إضافة بطاقة ملخص ذكي إلى صفحة التقارير، مع حالات loading/error/disabled وبيان نطاق البيانات وزمن الإنشاء.
4. إضافة صياغة اختيارية لمساعد الجرد، مع إبقاء `assessLocationAnomaly` مصدر القرار الرقمي الوحيد.
5. تنفيذ خطة البحث باللغة الطبيعية بعد تثبيت allowlist وقياس الدقة، وليس قبل ذلك.
6. تأجيل الصور والصيانة التنبؤية والصوت حتى تكتمل سياسات الخصوصية والبيانات التاريخية والقياس.

## الخلاصة

الدمج الصحيح ليس إضافة chatbot عام إلى الواجهة، بل بناء **خدمات AI ضيقة ومقيدة ومفسرة** فوق الخدمات الحالية. نقطة البداية الأنسب هي ملخص التقارير العربية، ثم تفسير فروقات الجرد. هذا يحافظ على Arabic First وOffline First وtenant isolation وAudit by Design، ويضيف قيمة فعلية دون منح النموذج صلاحية تعديل سجل الأصول أو تنفيذ حركة تشغيلية.

## المراجع

[1] [Software Architecture Document — AI Architecture](../Architecture/Software_Architecture_Document.md)  
[2] [AI-Assisted Location Inventory Implementation Specification](AI-Assisted-Location-Inventory-Implementation-Spec.md)  
[3] [Functional Requirements Specification — FR-AI](../Requirements/Functional_Requirements_Specification.md)  
[4] [Product Requirements Document — AI roadmap](../Requirements/Product_Requirements_Document.md)  
[5] [Asset algorithms and deterministic location assessment](../backend/src/application/asset-algorithms.ts)  
[6] [Inventory result service](../backend/src/application/inventory-result.service.ts)  
[7] [Inventory controller](../backend/src/api/inventory/inventory.controller.ts)  
[8] [Inventory detail UI](../web/src/app/(dashboard)/inventory/[id]/page.tsx)  
[9] [Backend composition root and environment contract](../backend/src/app.module.ts)  

## الملفات التي تمت مراجعتها

- `Architecture/Software_Architecture_Document.md`
- `Requirements/Functional_Requirements_Specification.md`
- `Requirements/Product_Requirements_Document.md`
- `docs/AI-Assisted-Location-Inventory-Implementation-Spec.md`
- `backend/src/application/asset-algorithms.ts`
- `backend/src/application/inventory-result.service.ts`
- `backend/src/api/inventory/inventory.controller.ts`
- `web/src/app/(dashboard)/inventory/[id]/page.tsx`
- `web/src/features/inventory/api.ts`
- `backend/src/app.module.ts`
- `backend/.env.example`
- `docs/Next-Delivery-Decision.md`

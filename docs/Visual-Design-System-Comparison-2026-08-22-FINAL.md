# تقرير مقارنة مواصفة Visual Design System مع AssetX

**التاريخ:** 2026-08-22
**المستودع الذي تمت مراجعته:** `assetx-enterprise-platform` فقط
**الملف محل المقارنة:** `pasted_content_2.txt`
**حالة الجولة:** تحليل ومقارنة فقط؛ لم يتم تعديل الكود أو قاعدة البيانات أو إنشاء commit.

## الإجابة المباشرة: أين تُعد أنواع المواقع؟

يوجد في المشروع الحالي نوعان يجب عدم الخلط بينهما:

| المقصود | مكان الإدارة الحالي | الحالة |
|---|---|---|
| **أنواع الأصول** مثل أجهزة، مركبات، أثاث، أجهزة شبكات | صفحة `/asset-types` من قسم البيانات الرئيسية، وتدعم إنشاء نوع رئيسي وفرعي وتعديل الاسم ونقل النوع تحت أب آخر | قابلة للإدارة من النظام |
| **أنواع المواقع** مثل مبنى، غرفة، مستودع، ورشة، موقع خارجي | لا توجد لها شاشة إعداد مستقلة. تظهر داخل نافذة `/locations` كقائمة ثابتة | غير قابلة للإضافة من الواجهة حالياً |

أنواع المواقع الخمسة معرفة حالياً في PostgreSQL كـenum في `db/migrations/001_init.sql`، ثم مكررة في عقود TypeScript وعميل الويب و`LocationFormModal`. القيم الحالية هي: `building`, `room`, `warehouse`, `workshop`, و`outdoor`. لذلك إذا كانت لديك أنواع مواقع مختلفة، فلن تُضاف من صفحة الإعدادات الحالية؛ ستحتاج أولاً إلى قرار معماري بين توسيع enum الحالي أو تحويل أنواع المواقع إلى جدول master data قابل للإدارة لكل tenant. لم أنفذ أياً من الخيارين لأنك طلبت التقرير قبل التنفيذ.

> **الخلاصة العملية:** اذهب إلى `/asset-types` إذا كنت تقصد أنواع الأصول. أما إذا كنت تقصد أنواع المواقع التي تظهر في حقل «نوع الموقع»، فلا توجد شاشة إعداد لها في النسخة الحالية، وهي ثابتة في schema والعقود والواجهة.[1] [2] [3]

## الملخص التنفيذي

الملف المرفق ليس ملف بيانات لأنواع المواقع أو الأصول، بل هو مواصفة Visual Design System كاملة تهدف إلى نقل الواجهة من Functional Admin Dashboard إلى Modern Enterprise SaaS Asset Management Platform. وهو يغطي الألوان، الخطوط، المسافات، البطاقات، المؤشرات، الجداول، البحث، الأزرار، حالات التحميل والفراغ والخطأ، الحوارات، RTL، responsive، dark mode، الحركة، والتناسق العالمي.[4]

يتوافق جزء كبير من المواصفة مع أساس AssetX الموجود فعلياً. فالمشروع يملك tokens مركزية، `Button`, `Card`, `KpiCard`, `EnterpriseTable`, `CommandToolbar`, `Modal`, `ConfirmDialog`, `Badge`, `SearchableSelect`، وقواعد reduced-motion والطباعة، كما أن شريط الأوامر الموحد يملك ترتيباً دلالياً وفواصل وأفعالاً مرتبطة بصلاحيات وعمليات حقيقية.[5] [6] [7]

لكن المواصفة لا ينبغي تطبيقها كأوامر نسخ ولصق أو إعادة بناء شاملة. توجد فجوات حقيقية في إدارة التركيز داخل Modal، والتنقل بلوحة المفاتيح في SearchableSelect، وثراء skeleton loading، واختبار contrast في dark mode، واكتمال Arabic-first منذ أول لحظة تحميل، ووجود زر أعمدة زائد/غير موصول داخل EnterpriseTable. كما توجد مخاطر إذا عُدلت المكونات المشتركة دفعة واحدة، لأن أثرها يمتد إلى صفحات الأصول والجرد والنقل والتقارير والمواقع والأنواع وبقية المسارات.

## ما الذي يطلبه الملف المرفق؟

| محور المواصفة | المقصود في الملف |
|---|---|
| الهوية | Enterprise SaaS حديث، نظيف، كثيف عند الحاجة، عربي وRTL أولاً |
| الألوان | Brand أزرق عميق مع ألوان semantic للنجاح والتحذير والخطر والمعلومات والأسطح المتدرجة |
| الحالات | عدم الاعتماد على اللون وحده؛ استخدام Icon + Label + Color |
| الخطوط | سياسة Arabic-first مثل Cairo أو Tajawal مع Inter للإنجليزية |
| التباعد | rhythm موحد للمساحات والبطاقات والأدوات والصفوف والنوافذ |
| الأزرار | Primary/Secondary/Outline/Ghost/Danger وIcon Button مع حالات hover/focus/disabled/loading |
| البطاقات | Standard/KPI/Action/Status دون تحويل كل عنصر إلى Card |
| الجداول | EnterpriseTable بكثافة واضحة، وفرز، وتحديد، وأعمدة قابلة للإخفاء، وإجراءات سياقية |
| البحث والفلاتر | حقل بحث واضح، فلاتر صغيرة، وchips للفلاتر النشطة |
| شريط الأوامر | عنوان/سياق ثم Primary وSecondary وSearch وFilters وMore مع فواصل |
| الحالات | Empty/Error/Loading مفهومة، مع CTA حقيقي عند توفر العملية |
| RTL وResponsive | logical properties، sidebar إلى drawer، toolbar قابلة للتمرير/الالتفاف، جداول بأولوية أعمدة، ونماذج عمود واحد على الهاتف |
| الحماية من التوسع الخاطئ | عدم تغيير API أو Backend أو Database أو Auth أو Permissions أو RBAC أو Offline Sync أو Business Rules أو Routes، وعدم إنشاء Mock UI |

## مقارنة الوضع الحالي مع المواصفة

| المجال | الموجود في AssetX حالياً | الحكم |
|---|---|---|
| Tokens والألوان | توجد tokens مركزية في `globals.css` تشمل brand، surfaces، النصوص، الخطوط الدلالية، الحدود، radii، والظلال | **مغطى بدرجة جيدة**؛ المطلوب QA للـcontrast وليس إعادة اختراع النظام |
| الألوان الدلالية | توجد success/warning/danger/info وBadge tones وKPI tones | **مغطى جزئياً**؛ بعض الصفحات تحتاج مراجعة لتوحيد معنى الحالات وعدم الاعتماد على اللون وحده |
| الخطوط | يوجد fallback stack يجمع Inter وSegoe UI وTajawal وCairo | **جزئي**؛ لا توجد سياسة تحميل واختيار خط عربي أساسي موحد، وHTML يبدأ أولياً بـ`lang=en` و`dir=ltr` قبل client i18n |
| المسافات | تستخدم الصفحات ومكونات UI قيماً متكررة مثل `p-3/p-4`, `gap-2/gap-3/gap-4`, و`rounded-lg/xl` | **جيد لكن غير مكتمل**؛ لا توجد طبقة كثافة مركزية معلنة لـComfortable/Standard/Dense |
| Page Header | `PageHeader` نفسه surface بحدود وظل وradius | **فجوة تصميمية**؛ المواصفة تحذر من جعل كل عنصر Card، وقد يلزم variant غير بطاقي لاحقاً |
| Button | خمسة variants وثلاثة أحجام وfocus وloading وactive scale وحالة disabled | **مغطى بدرجة جيدة**؛ لا ينبغي استبداله بلا سبب، بل منع page-local variants |
| CommandToolbar | ترتيب RTL دلالي، icon-only مع `title` و`aria-label`، فواصل، permission filtering، ونافذة All Modules حقيقية | **مغطى بدرجة قوية**؛ أي redesign يجب أن يحافظ على contract والأفعال الحقيقية |
| Card/KPI | `Card` و`KpiCard` موجودان، وKPI فيها قيمة واتجاه وأيقونة بلون خفيف | **مغطى جزئياً**؛ يمكن توحيد typography وtabular numbers، مع تجنب إضافة بطاقات جديدة بلا معنى |
| EnterpriseTable | فرز، pagination، selection، column visibility، search/export hooks، hover/selected rows، loading/error/empty | **مغطى وظيفياً**؛ يحتاج إصلاحاً عرضياً قبل أي redesign: يوجد زر Columns ظاهر داخل toolbar بلا handler، بجانب `ColumnMenu` الذي يحتوي الزر الفعلي، ما يخلق control زائداً/غير موصول |
| Badge | tones semantic و`StatusIndicator` و`LifecycleStateBadge` موجودة | **جزئي**؛ Badge الأساسي لا يفرض Icon + Label، ويجب مراجعة الصفحات التي تعرض اللون وحده |
| Inputs | `ax-input` موحد مع border/focus/placeholder وField/Input/Select | **مغطى جزئياً**؛ ربط `label/id` وحالات success/error يحتاج مراجعة page-by-page |
| SearchableSelect | بحث داخل dropdown، clear، listbox role، click outside، وخيار clear | **فجوة مؤكدة في الوصول**؛ التعليق يصفه بأنه keyboard navigable، لكن لا يوجد تعامل صريح كافٍ مع ArrowUp/ArrowDown/Enter/Escape |
| Empty states | Icon + title + description + CTA حقيقي في `EmptyState` | **مغطى**؛ يجب فقط إزالة النصوص الثابتة المتبقية في الصفحات الفردية |
| Loading states | `LoadingState` و`TableSkeleton` موجودان، لكنهما pulse rows بسيطة | **جزئي**؛ المواصفة تقترح skeleton حسب السياق: صفحة، بطاقة، جدول، ومحتوى متوقع |
| Error states | Icon + message + Retry في `ErrorState` | **مغطى أساسياً**؛ يمكن تحسين title/description المنظمين دون عرض stack trace |
| Dialogs | `Modal` مع ESC، overlay، max-height، scroll body، header/footer، و`ConfirmDialog` destructive | **جزئي**؛ focus trap وfocus restore غير مكتملين، وبعض العناوين لا تملك وصفاً إضافياً |
| RTL | `I18nProvider`, logical `start/end`, RTL toolbar، breadcrumbs، وdrawer | **جيد لكنه ليس كاملاً**؛ توجد بداية HTML غير RTL، وبعض strings أو محاذاة page-local تحتاج مراجعة |
| Responsive | AppShell يحول Sidebar إلى drawer، وtoolbar/جداول لديها overflow، والنماذج تستخدم responsive classes | **مغطى جزئياً**؛ لا توجد قاعدة موحدة لأولوية أعمدة الهاتف والأفعال الثانوية |
| Dark mode | `.dark` يبدل surfaces والنصوص والحدود والـbrand | **جزئي**؛ semantic status colors لا تملك overrides خاصة، ويجب اختبار contrast وعدم تحولها إلى neon أو منخفضة التباين |
| Motion | active scale وtransitions قصيرة و`prefers-reduced-motion` | **مغطى أساسياً**؛ لا حاجة لإضافة animation واسعة |
| Print | قواعد A4 و`print-hide` وخصوصية للتقارير | **مغطى في التقارير**؛ لا ينبغي تعميم print layout على كل الصفحات دون هدف |
| No Mock UI | معظم الأفعال مرتبطة بـAPI وصلاحيات حقيقية | **مبدأ صحيح**؛ الزر الزائد في EnterpriseTable استثناء يجب ألا يبقى أثناء أي جولة تنفيذ |

## أخطاء أو مخاطر إذا طُبقت أوامر الملف حرفياً

### تعارض أولوية التنفيذ

الملف يقول «ابدأ بالتنفيذ مباشرة» ويطلب في نهايته تنفيذ التغييرات فعلياً، بينما طلبك الحالي يقول بوضوح عدم التنفيذ قبل الاطلاع على تقرير الفروقات. القرار الصحيح لهذه الجولة هو الالتزام بطلبك الأحدث، وعدم تعديل أي ملف أو تشغيل migration أو إنشاء commit.

### إعادة بناء شيء موجود أصلاً

إذا عوملت المواصفة كأن المشروع يبدأ من الصفر، فقد يتم إنشاء tokens أو Button أو Card أو Toolbar ثانية، ما ينتج نظامي تصميم متوازيين وتعارضاً بين الصفحات. AssetX يملك هذه الطبقة بالفعل؛ القيمة الحقيقية ستكون في consolidation وQA والإصلاحات المؤكدة، لا في تكرار المكونات.[5]

### إصابة RBAC وdiscoverability

تغيير شريط الأوامر أو تحويل كل الأفعال إلى contextual menu قد يخفي أفعالاً يحتاجها المستخدم أو يخرق permission filtering. كما أن إعادة ترتيب الأيقونات يجب ألا يضيف فعلاً غير موجود في backend أو يعرض فعلاً بلا `href` أو `onClick` حقيقي. `CommandToolbar` الحالي يعالج هذه المخاطر، لذلك يجب اعتباره أساساً لا استبداله عشوائياً.[6]

### كسر العقود الوظيفية عبر تغييرات بصرية

تعديل `EnterpriseTable`, `Modal`, `SearchableSelect`, `Badge`, أو `Input` يؤثر على عدد كبير من الصفحات. مثال واضح هو إضافة قائمة أعمدة جديدة دون إزالة الزر الزائد الحالي؛ هذا لا يحسن التجربة بل يزيد الالتباس. ومثال آخر هو تغيير بنية Modal دون الحفاظ على ESC وoverlay وscroll وfooter.

### التباين واللغة والـPWA

اختيار خط من Google Fonts أو مصدر خارجي قد يضيف latency ويضعف العمل في بيئة ميدانية أو PWA إذا لم يتوفر الخط offline. كما أن تغيير الألوان العالمية دون قياس light/dark/hover/focus/disabled قد يجعل النص أو الأيقونات منخفضة التباين. يوصي الملف نفسه بعدم الاعتماد على اللون وحده، ولذلك لا يصح تحويل الحالات إلى ألوان فقط.

### كثافة غير مناسبة لكل سياق

تطبيق كثافة واحدة على Dashboard وCRUD والجرد والتدقيق والتقارير يخالف جوهر المواصفة نفسها. صفحات الجرد والتدقيق تحتاج كثافة بيانات، بينما الإدخال الميداني يحتاج touch targets أكبر، وDashboard يحتاج مساحة تنفس. يجب تعريف density variants قبل تعديل الصفحات الفردية.

### التوسع غير المطلوب في أنواع المواقع

الملف المرفق لا يقدم قائمة أنواع مواقع أو schema لها. استخدامه كسبب لإضافة أنواع المواقع مباشرة سيكون قراراً غير مؤسس. إضافة نوع جديد حالياً تتطلب تغيير enum والعقود والـfrontend labels/icons وربما بيانات seed والاختبارات. أما تحويلها إلى table configurable فهو ميزة أكبر تؤثر في RLS وtenant isolation وواجهات الأصول والاستيراد والتقارير، ولا ينبغي تنفيذها دون تحديد product intent.

## الميزات التي ستضيف قيمة فعلية إذا نُفذت لاحقاً

| الأولوية | الميزة | القيمة | نوع التغيير |
|---:|---|---|---|
| P1 | إصلاح زر Columns الزائد/غير الموصول في `EnterpriseTable` | يزيل control مضللاً ويحقق مبدأ «لا Mock UI» | إصلاح UI صغير ومؤكد |
| P1 | إضافة focus trap وfocus restore إلى `Modal` | يحسن keyboard accessibility دون تغيير API | تعديل shared UI مع tests |
| P1 | إكمال keyboard behavior في `SearchableSelect` | يجعل البحث والفلاتر قابلة للاستخدام بالكيبورد فعلياً | تعديل interaction في shared UI |
| P1 | اعتماد سياسة Arabic-first واضحة للـHTML والـfont fallback | يقلل flash إنجليزي/اتجاه خاطئ ويحسن الاتساق | presentation/runtime محدود |
| P2 | إنشاء density tokens أو variants | يميز Dashboard عن CRUD وعن Inventory/Reports | CSS/shared UI فقط |
| P2 | تحسين skeletons حسب السياق | يقلل الإحساس بالتوقف ويحسن perceived performance | presentation فقط |
| P2 | توحيد Badge إلى label + semantic tone مع icon عند الحاجة | يحقق عدم الاعتماد على اللون وحده | UI فقط |
| P2 | اختبار contrast light/dark/disabled/focus | يمنع regressions البصرية والوصولية | QA ثم تعديلات محددة |
| P2 | variant غير بطاقي لـ`PageHeader` | يمنع card overload ويعطي hierarchy أنظف | UI فقط بعد screenshot review |
| P3 | تحسين mobile priority columns/actions | يجعل الجداول الميدانية أكثر فاعلية | UI/interaction، دون API |
| P3 | إنشاء إدارة مستقلة لـLocation Types | يسمح بأنواع مواقع مخصصة لكل tenant | feature/schema/API، ليس جزءاً من تطبيق Visual DS مباشرة |

## قرار أنواع المواقع المقترح قبل أي تنفيذ

إذا كانت الأنواع التي لديك تخص **تصنيف الأصول**، فالمكان الحالي هو `/asset-types`، ويمكن إنشاء الجذور والفروع من هناك. أما إذا كانت تخص **نوع الموقع**، فهناك خياران معماريان:

| الخيار | الوصف | المزايا | المخاطر/الكلفة |
|---|---|---|---|
| توسيع enum | إضافة القيم المطلوبة إلى `location_type` وتحديث DTO وTypeScript والواجهة والأيقونات والترجمة والاختبارات | أقل تغيير سريعاً | يظل النظام غير قابل لإدارة الأنواع من المستخدم، وكل إضافة مستقبلية تحتاج migration |
| جدول `location_types` | جعل نوع الموقع master data مرتبطاً بـtenant مع `is_active`, label/code, icon key وربما ترتيب | قابل للتخصيص، مناسب للمؤسسة، ويسمح بإخفاء النوع مستقبلاً بأمان | يحتاج schema/API/RLS/permissions/import/report mappings وتوافقاً مع البيانات الحالية |

لا أوصي بتنفيذ الخيار الأول لمجرد أن القائمة الحالية قصيرة إذا كان لديك احتمال مستمر لتغير أنواع المواقع بين المؤسسات. ولا أوصي بالخيار الثاني قبل اعتماد أسماء وحقول وصلاحيات وسلوك التعطيل وإعادة الاستخدام في الأصول والتقارير. هذه نقطة قرار منتج وليست مجرد تحسين CSS.

## ما لن يتم تنفيذه من الملف دون موافقة لاحقة

لن يتم تغيير API أو Backend أو Database أو Authentication أو Permissions أو RBAC أو RLS أو Data Models أو Offline Sync أو Business Rules أو Routes استناداً إلى مواصفة التصميم وحدها. لن تتم إضافة إحصاءات أو مخططات أو أزرار وهمية، ولن يتم حذف أي Component أو Route لمجرد أنه يبدو قديماً. كما لن يتم نسخ شكل ERP القديم حرفياً أو إدخال emojis بدل Lucide icons.

## الملفات التي تمت مراجعتها

| الطبقة | الملفات/المكونات |
|---|---|
| المواصفة | `/home/ubuntu/upload/pasted_content_2.txt` |
| tokens | `web/src/app/globals.css` |
| shell | `web/src/components/shell/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx` |
| commands | `web/src/components/ui/CommandToolbar.tsx` |
| tables | `web/src/components/ui/EnterpriseTable.tsx` |
| primitives | `Button.tsx`, `Card.tsx`, `KpiCard.tsx`, `Badge.tsx`, `form.tsx` |
| states | `states.tsx`, `Skeleton.tsx` |
| interactions | `Modal.tsx`, `ConfirmDialog.tsx`, `SearchableSelect.tsx` |
| locations | `web/src/features/locations/api.ts`, `LocationFormModal.tsx` |
| schema | `db/migrations/001_init.sql` |
| تحليل سابق | `docs/04_DESIGN_SYSTEM_RECOMMENDATION.md` |

## النتيجة والمرحلة التالية المقترحة

المواصفة مفيدة كمرجع صقل بصري، وليست أساساً لإعادة بناء النظام من الصفر. الأساس الحالي جيد وموجود، وأفضل مسار هو تنفيذ جولة Shared UI صغيرة ومقاسة بعد الموافقة، تبدأ بإصلاح control غير الموصول، وإكمال accessibility للمودال والقائمة القابلة للبحث، ثم اختبار contrast والـRTL والـmobile على الصفحات الحساسة. بعد ذلك فقط تُطبق التحسينات العرضية تدريجياً، مع إبقاء موضوع **إدارة أنواع المواقع** قراراً مستقلاً عن Visual Design System.

## المراجع

[1]: ../db/migrations/001_init.sql "تعريف PostgreSQL enum وlocations"
[2]: ../web/src/features/locations/api.ts "عقد LocationType وواجهة المواقع"
[3]: ../web/src/features/locations/components/LocationFormModal.tsx "القائمة الثابتة لأنواع المواقع"
[4]: file:///home/ubuntu/upload/pasted_content_2.txt "Visual Design System المرفق"
[5]: ../web/src/app/globals.css "AssetX Design System Tokens"
[6]: ../web/src/components/ui/CommandToolbar.tsx "شريط الأوامر الموحد"
[7]: ../web/src/components/ui/EnterpriseTable.tsx "جدول البيانات المؤسسي"

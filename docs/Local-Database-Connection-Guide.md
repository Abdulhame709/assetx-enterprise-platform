# دليل ربط AssetX بقاعدة PostgreSQL المحلية على الكمبيوتر

**المستودع:** `Abdulhame709/assetx-enterprise-platform`  
**المبدأ التشغيلي:** PostgreSQL المحلي هو قاعدة التطوير والاختبار الأساسية، وSupabase هو المسار السحابي التجريبي/staging. لا يتم وضع كلمات المرور أو روابط الاتصال داخل GitHub.

## أولاً: ما يمكن عمله من الهاتف وما يحتاج كمبيوتر

الهاتف مناسب لمراجعة GitHub، إرسال الملفات والأفكار، مراجعة واجهة الويب المنشورة أو رابط المعاينة، إدارة مشروع Supabase من لوحة الويب، ومراجعة نتائج الاختبارات والتقارير. يمكن أيضاً متابعة العمل على الوثائق، تصميم تدفقات الاستخدام، وترتيب أولويات الواجهة من الهاتف.

الهاتف لا يشغّل قاعدة PostgreSQL المحلية الموجودة على الكمبيوتر، ولا يستطيع الوصول إلى `localhost` الخاص بالكمبيوتر. كما أن تشغيل Backend وNext.js والاختبارات والترحيلات على جهاز شخصي يحتاج بيئة Node وPostgreSQL وملفات المشروع. لذلك لا يلزم أن يكون الكمبيوتر أمام المستخدم أثناء كل المحادثات، لكن يلزم وجود كمبيوتر أو بيئة تطوير بعيدة عند تنفيذ الخطوات المحلية الفعلية.

| المهمة | الهاتف | الكمبيوتر أو بيئة تطوير بعيدة |
|---|---:|---:|
| مراجعة الكود والوثائق وإرسال التحسينات | نعم | اختياري |
| إدارة مشروع Supabase ولوحة القاعدة السحابية | نعم | اختياري |
| الوصول إلى PostgreSQL المحلي على `127.0.0.1` | لا | نعم |
| تشغيل `npm install` و`npm run build` والاختبارات | غير عملي | نعم |
| تشغيل Backend وWeb محلياً | غير عملي | نعم |
| تطبيق migrations على PostgreSQL المحلي | لا | نعم |
| مراجعة رابط Web منشور أو staging | نعم | اختياري |

حالياً، إذا لم يتوفر الكمبيوتر، يمكن مواصلة تحليل وتحسينات الواجهة وتوثيق المتطلبات والعمل على Supabase كبيئة سحابية. لكن لا ينبغي اعتبار PostgreSQL المحلي متحققاً على كمبيوتر المستخدم قبل تنفيذ اختبار الاتصال من ذلك الكمبيوتر.

## ثانياً: ما الذي يجب تثبيته على الكمبيوتر

يجب تثبيت Git، وNode.js إصداراً متوافقاً مع المشروع، وnpm أو pnpm، وPostgreSQL، وعميل `psql`. يفضل أن يكون إصدار PostgreSQL المحلي قريباً من إصدار خادم staging، وأن يكون `pg_dump` متوافقاً مع الإصدار الرئيسي للخادم عند اختبار النسخ الاحتياطي.

يحتاج الكمبيوتر إلى اتصال بالإنترنت عند استنساخ المستودع وتثبيت الحزم. بعد ذلك يمكن تشغيل PostgreSQL محلياً دون اتصال خارجي، بينما يحتاج Backend إلى اتصال Supabase فقط عندما نريد استخدام المسار السحابي.

## ثالثاً: استنساخ المستودع المستقل

لا تستخدم مستودع `ASSETS-X`. يجب استنساخ المستودع المستقل:

```bash
git clone https://github.com/Abdulhame709/assetx-enterprise-platform.git
cd assetx-enterprise-platform
git checkout chore/phase1-environment-postgres
```

إذا كان المستودع مستنسخاً من قبل، حدّثه دون تغيير فرع العمل:

```bash
git fetch origin
git checkout chore/phase1-environment-postgres
git pull --ff-only origin chore/phase1-environment-postgres
```

## رابعاً: تشغيل PostgreSQL المحلي

شغّل خدمة PostgreSQL بالطريقة المناسبة لنظام التشغيل، ثم تحقق من توفرها:

```bash
pg_isready -h 127.0.0.1 -p 5432
psql --version
```

في Linux تكون الخدمة غالباً:

```bash
sudo systemctl enable --now postgresql
```

في macOS مع Homebrew:

```bash
brew services start postgresql
```

في Windows استخدم خدمة PostgreSQL المثبتة أو أداة pgAdmin، ثم شغّل `psql` من PowerShell أو SQL Shell. لا يهم نظام التشغيل؛ المهم أن يقبل الخادم اتصالاً على `127.0.0.1:5432`.

## خامساً: إنشاء قاعدة AssetX والأدوار

يجب الفصل بين حساب الترحيلات وحساب تشغيل التطبيق. استخدم مسؤول PostgreSQL مرة واحدة لإنشاء قاعدة فارغة وأدوار منفصلة. لا تستخدم كلمة المرور التالية أو تضعها في Git؛ استبدل العناصر التجريبية بقيم محلية حقيقية.

```sql
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE assetx_migrator LOGIN PASSWORD 'CHANGE_ME_MIGRATOR_PASSWORD';
CREATE ROLE assetx_app LOGIN PASSWORD 'CHANGE_ME_RUNTIME_PASSWORD';
CREATE DATABASE assetx OWNER assetx_migrator;
```

إذا كان أحد الأدوار موجوداً، لا تعيد إنشاءه؛ استخدم إعداد PostgreSQL الحالي أو افحصه أولاً. بعد الاتصال بقاعدة `assetx`، طبق سكربت الدور الموجود في:

```text
ops/staging/provision-runtime-role.sql
```

لا تمنح حساب التطبيق صلاحية إنشاء أدوار أو تنفيذ DDL. حساب `assetx_migrator` يستخدم للترحيلات والتهيئة، بينما `assetx_app` يستخدم لتشغيل HTTP Backend بصلاحيات محدودة. في بعض إعدادات RLS يحتاج حساب التشغيل إلى عضوية أو mapping مع دور `authenticated`؛ طبق ذلك عبر مسؤول القاعدة وفق دليل staging، ولا تمنح صلاحية ADMIN عشوائياً.

## سادساً: إنشاء ملف الأسرار المحلي

أنشئ مجلد أسرار خارج المستودع. في Linux/macOS:

```bash
mkdir -p "$HOME/.assetx-runtime"
umask 077
cat > "$HOME/.assetx-runtime/local.env" <<'EOF'
DATABASE_URL='postgresql://assetx_migrator:CHANGE_ME@127.0.0.1:5432/assetx?sslmode=require'
JWT_ACCESS_SECRET='CHANGE_ME_LONG_RANDOM_ACCESS_SECRET'
JWT_REFRESH_SECRET='CHANGE_ME_LONG_RANDOM_REFRESH_SECRET'
CORS_ORIGIN='http://localhost:3000'
NODE_ENV='development'
EOF
```

في Windows احفظ القيم في متغيرات بيئة مستخدم أو ملف محلي غير متعقب، ولا تضعه داخل commit. لا ترسل الملف إلى GitHub ولا ترفقه في المحادثة. يمكن استخدام `backend/.env.example` كقائمة أسماء فقط، وليس كملف أسرار.

إذا كان تشغيل المشروع يتطلب متغيرات إضافية، اقرأ `backend/.env.example` و`web/.env.example` في النسخة الحالية وأضف القيم المطلوبة إلى بيئة التشغيل المحلية فقط. لا تخمّن متغيراً غير موجود في القالب أو الكود.

## سابعاً: تثبيت اعتماديات المشروع

ثبّت الاعتماديات في كل حزمة من داخل مجلد المشروع:

```bash
npm --prefix backend install
npm --prefix web install
```

إذا كان المشروع يفرض pnpm أو ملف lock مختلفاً، استخدم مدير الحزم المحدد في `package.json` بدلاً من خلط npm وpnpm. بعد التثبيت شغّل بناء Backend قبل الترحيلات:

```bash
npm --prefix backend run build
```

## ثامناً: تطبيق الترحيلات الرسمية

حمّل ملف الأسرار إلى جلسة الكمبيوتر دون طباعته:

```bash
set -a
. "$HOME/.assetx-runtime/local.env"
set +a
```

ثم شغّل migration runner الرسمي الموجود في Backend:

```bash
DATABASE_URL="$DATABASE_URL" npm --prefix backend run db:migrate
```

إذا لم يكن اسم الأمر موجوداً، اقرأ `backend/package.json` و`backend/src/bootstrap/migrations.ts` لتحديد الأمر الصحيح. لا تطبق ملفات SQL يدوياً على قاعدة تشغيل إذا كان migration runner الرسمي متاحاً.

تحقق من سجل الترحيلات والجداول:

```bash
psql "$DATABASE_URL" -Atc "SELECT count(*) FROM schema_migrations;"
psql "$DATABASE_URL" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
```

## تاسعاً: إنشاء tenant وبيانات البداية

بعد نجاح الترحيلات، شغّل أداة seed الموجودة في المشروع:

```bash
cd assetx-enterprise-platform
DATABASE_URL="$DATABASE_URL" \
TENANT_CODE=local_assetx \
TENANT_NAME='AssetX Local' \
./ops/database/seed-tenant.sh
```

الأداة idempotent: تنشئ tenant إذا لم يكن موجوداً أو تعثر عليه إذا كان موجوداً، ثم تشغّل `db/seed/001_seed.sql` و`db/seed/002_permissions.sql` داخل سياق `app.tenant_id`. لا تشغّل seed demo على قاعدة إنتاج.

## عاشراً: تشغيل Backend وWeb محلياً

شغّل Backend في نافذة طرفية:

```bash
set -a; . "$HOME/.assetx-runtime/local.env"; set +a
npm --prefix backend run start:dev
```

شغّل Web في نافذة ثانية، مع إبقاء بروكسي `/api` موجهاً إلى Backend المحلي وفق `web/.env.example` و`web/.env.local`:

```bash
npm --prefix web run dev
```

بعد التشغيل اختبر:

```bash
curl -i http://127.0.0.1:3001/health
curl -i http://127.0.0.1:3000/login
curl -i http://127.0.0.1:3000/api/health
```

قد تختلف المنافذ إذا كانت القوالب الحالية تحدد قيماً أخرى؛ استخدم `backend/.env.example` و`web/DEVELOPER_SETUP.md` كمصدر الحقيقة. يجب ألا يستخدم Web رابط Supabase عندما يكون الهدف اختبار PostgreSQL المحلي.

## الحادي عشر: التحقق من RLS والاختبارات

شغّل اختبار RLS القابل للتراجع:

```bash
psql "$DATABASE_URL" -f ops/database/verify-rls.sql
```

يجب أن يثبت الاختبار أن tenant يرى صفوفه فقط، وأن probe المؤقت يتم التراجع عنه بـ `ROLLBACK`. بعد ذلك شغّل اختبارات Backend وWeb والبناء:

```bash
npm --prefix backend test -- --runInBand
npm --prefix web test -- --runInBand
npm --prefix web run build
```

إذا لم يكن أمر الاختبار مطابقاً، استخدم scripts الموجودة في ملفات `package.json`. لا تعتبر تشغيل الصفحة في المتصفح دليلاً كافياً على نجاح RLS أو المصادقة.

## الثاني عشر: الفرق بين المحلي وSupabase

| العنصر | محلي | Supabase staging |
|---|---|---|
| الهدف | التطوير والاختبارات اليومية | حفظ سحابي وتجربة staging |
| الاتصال | `127.0.0.1:5432/assetx` | رابط PostgreSQL من زر Connect |
| الأسرار | ملف runtime على الكمبيوتر | Secret manager أو ملف runtime خارج Git |
| الترحيلات | migration runner الرسمي | migration runner نفسه، دون reset |
| tenant | `local_assetx` | `trial` أو رمز معتمد |
| التشغيل | Backend محلي | Backend محلي متصل بالسحابة أو خدمة staging |
| النسخ الاحتياطي | اختبار محلي بعميل متوافق | PITR/backup provider مع اختبار restore |

لا تُستخدم Publishable/Anon Key لتطبيق migrations. هذه المفاتيح تخص استخدامات الواجهة العامة، بينما Backend يحتاج `DATABASE_URL` أو بيانات PostgreSQL المكافئة.

## ما يمكن تنفيذه حالياً من الهاتف

يمكن حالياً مراجعة هذا الدليل، ترتيب تحسينات الواجهة، مراجعة Supabase السحابي، إعداد tenant وأسماء الأدوار، ومراجعة Pull Request. يمكن أيضاً تجهيز ملفات الكود والتوثيق داخل المستودع. ما لا يمكن إثباته من الهاتف وحده هو أن PostgreSQL يعمل على كمبيوتر المستخدم، وأن Backend وWeb يستخدمان القاعدة المحلية فعلياً، وأن اختبار health/auth/RLS نجح من بيئته.

عند توفر الكمبيوتر، يكفي تنفيذ الأقسام من الثالث إلى الحادي عشر. لا حاجة لإعادة تصميم قاعدة البيانات من الصفر؛ الترحيلات الموجودة هي المصدر التنفيذي، والهدف هو تشغيلها محلياً والتحقق من أن التطبيق يتصل بها.

> الترتيب الآمن هو: قاعدة محلية فارغة، ترحيلات، seed tenant، اختبار RLS، تشغيل Backend، تشغيل Web، ثم اختبار المسارات. لا تربط Web بقاعدة Supabase أو المحلية مباشرة؛ Web يتصل بـ Backend، وBackend هو الذي يتصل بقاعدة البيانات.

## مراجع المشروع

- `backend/.env.example`
- `web/.env.example`
- `web/DEVELOPER_SETUP.md`
- `ops/database/README.md`
- `ops/database/seed-tenant.sh`
- `ops/database/verify-rls.sql`
- `ops/staging/provision-runtime-role.sql`
- `backend/src/bootstrap/migrations.ts`

import { Field, FormButton, PageTitle, TextInput, dateLabel } from "@/components/EnergyUi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Settings2, ShieldCheck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const tariffBrackets = [
  { from: "1", to: "2,999", price: "230" }, { from: "3,000", to: "9,999", price: "220" },
  { from: "10,000", to: "19,999", price: "200" }, { from: "20,000", to: "29,999", price: "190" },
  { from: "30,000", to: "99,999", price: "185" }, { from: "100,000", to: "199,999", price: "180" },
  { from: "200,000", to: "299,999", price: "175" }, { from: "300,000", price: "170" },
];

type SettingOption = {
  label: string;
  help: string;
  group: string;
  key: string;
  mode: "number" | "select";
  defaultValue: string;
  min?: string;
  max?: string;
  step?: string;
  unit?: string;
  values?: Array<[string, string]>;
};

const settingOptions: Record<string, SettingOption> = {
  powerFactor: {
    label: "عامل القدرة الافتراضي للمولد",
    help: "يستخدم فقط عندما تدخل قراءة بوحدة kVA ولا يتوفر عامل قدرة مقاس.",
    group: "generator",
    key: "default_power_factor",
    mode: "number",
    defaultValue: "0.80",
    min: "0.10",
    max: "1.00",
    step: "0.01",
    unit: "قيمة بين 0.10 و1.00",
  },
  depreciation: {
    label: "نموذج الإهلاك في التحليل",
    help: "اختر النتيجة التي يظهرها التقرير عند المقارنة.",
    group: "analysis",
    key: "depreciation_mode",
    mode: "select",
    defaultValue: "accounting",
    values: [["accounting", "إهلاك محاسبي — قسط ثابت"], ["operational", "إهلاك تحليلي — حسب ساعات التشغيل"]],
  },
  maintenance: {
    label: "طريقة عرض تكلفة الصيانة",
    help: "لا يغير هذا قيمة الصيانة الفعلية المسجلة، بل يحدد طريقة عرضها في التحليل.",
    group: "analysis",
    key: "maintenance_mode",
    mode: "select",
    defaultValue: "actual",
    values: [["actual", "التكلفة الفعلية للدورة"], ["allocated", "تكلفة موزعة حسب ساعات التشغيل"]],
  },
  attachmentLimit: {
    label: "الحد الأقصى لحجم المرفق",
    help: "يدعم النظام PDF وExcel وWord وTXT. الحد المعتمد حاليًا 5 MB.",
    group: "attachments",
    key: "max_upload_mb",
    mode: "select",
    defaultValue: "5",
    values: [["5", "5 MB — الحد المعتمد"]],
  },
};

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const tariffs = trpc.settings.tariffs.list.useQuery();
  const [tariffChoice, setTariffChoice] = useState("yemen-eight-slabs");
  const [tariffNote, setTariffNote] = useState("اعتماد التعرفة اليمنية ذات الثماني شرائح");
  const [choice, setChoice] = useState("powerFactor");
  const active = settingOptions[choice] ?? settingOptions.powerFactor;
  const [settingValue, setSettingValue] = useState(settingOptions.powerFactor.defaultValue);
  const [effective, setEffective] = useState(() => new Date().toISOString().slice(0, 16));
  const [reason, setReason] = useState("اعتماد إعداد تشغيلي");

  const createTariff = trpc.settings.tariffs.createYemenDefault.useMutation({
    onSuccess: () => {
      toast.success("تم اعتماد نسخة التعرفة اليمنية.");
      utils.settings.tariffs.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const saveSetting = trpc.settings.versions.save.useMutation({
    onSuccess: () => toast.success("تم حفظ الإعداد وإصدار تاريخه."),
    onError: error => toast.error(error.message),
  });

  const savedTariffText = useMemo(
    () => tariffs.data?.length ? `${tariffs.data.length} نسخة محفوظة` : "لا توجد نسخة محفوظة",
    [tariffs.data]
  );

  const changeChoice = (value: string) => {
    const option = settingOptions[value] ?? settingOptions.powerFactor;
    setChoice(value);
    setSettingValue(option.defaultValue);
  };

  const submitSetting = (event: FormEvent) => {
    event.preventDefault();
    const numericValue = Number(settingValue);
    if (active.mode === "number" && (!Number.isFinite(numericValue) || numericValue < 0.1 || numericValue > 1)) {
      toast.error("أدخل عامل قدرة صحيحًا بين 0.10 و1.00.");
      return;
    }
    saveSetting.mutate({
      settingGroup: active.group,
      settingKey: active.key,
      value: { value: active.mode === "number" ? numericValue : settingValue },
      effectiveFrom: new Date(effective).getTime(),
      reason,
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        eyebrow="إعدادات سهلة ومؤرخة"
        title="مركز الإعدادات"
        description="اختر الإعداد من قائمة واضحة ثم احفظه. تحفظ النسخ القديمة تلقائيًا لحماية تقارير الدورات المعتمدة."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>تعرفة المؤسسة</CardTitle>
              <p className="mt-1 text-sm text-slate-500">تعرفة ثابتة حسب إجمالي استهلاك الدورة، دون إدخال الشرائح يدويًا.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-teal-700" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 rounded-2xl bg-teal-50 p-4 md:grid-cols-[1fr_auto]">
              <Field label="اختر نموذج التعرفة">
                <Select value={tariffChoice} onValueChange={setTariffChoice}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yemen-eight-slabs">التعرفة اليمنية — 8 شرائح معتمدة</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="self-end">
                <Button className="w-full bg-teal-700 hover:bg-teal-800 md:w-auto" disabled={createTariff.isPending} onClick={() => createTariff.mutate({ reason: tariffNote, effectiveFrom: new Date(effective).getTime() })}>
                  <CheckCircle2 className="ml-2 h-4 w-4" />اعتماد التعرفة المختارة
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <Field label="ملاحظة الاعتماد (اختياري)">
                <TextInput value={tariffNote} onChange={event => setTariffNote(event.target.value)} placeholder="مثال: اعتماد تعرفة المؤسسة لشهر يناير" />
              </Field>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {tariffBrackets.map(bracket => (
                <div key={bracket.from} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <span className="font-bold text-slate-700">من <b dir="ltr">{bracket.from}</b>{bracket.to ? <> إلى <b dir="ltr">{bracket.to}</b></> : " فأعلى"} <span dir="ltr">kWh</span></span>
                  <span className="metric-value whitespace-nowrap text-teal-800"><b dir="ltr">{bracket.price}</b> ر.ي لكل <span dir="ltr">kWh</span></span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <span className="font-bold text-slate-800">الحالة:</span> {savedTariffText}. عند اعتماد نسخة جديدة، لا تتغير حسابات الدورات المعتمدة أو المقفلة سابقًا.
            </div>

            {tariffs.data?.length ? (
              <div className="mt-4 space-y-2">
                {tariffs.data.map(tariff => (
                  <div key={tariff.id} className="rounded-xl border border-slate-100 px-4 py-3 text-sm">
                    <span className="font-bold">{tariff.name}</span>
                    <span className="mx-2 text-slate-400">•</span>
                    <span className="text-slate-500">سارية من {dateLabel(tariff.effectiveFrom)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>إعداد تشغيلي</CardTitle>
            <p className="mt-1 text-sm text-slate-500">اختر ما تريد تغييره؛ لن تحتاج إلى كتابة مفاتيح أو JSON.</p>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submitSetting}>
              <Field label="ما الذي تريد ضبطه؟">
                <Select value={choice} onValueChange={changeChoice}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(settingOptions).map(([id, option]) => <SelectItem key={id} value={id}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <div className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{active.help}</div>

              <Field label={active.mode === "number" ? "القيمة" : "اختر القيمة"}>
                {active.mode === "number" ? (
                  <TextInput required type="number" min={active.min} max={active.max} step={active.step} value={settingValue} onChange={event => setSettingValue(event.target.value)} />
                ) : (
                  <Select value={settingValue} onValueChange={setSettingValue}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(active.values ?? []).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              {active.mode === "number" ? <p className="-mt-2 text-xs text-slate-500">{active.unit}</p> : null}

              <Field label="يبدأ العمل به من"><TextInput required type="datetime-local" dir="ltr" value={effective} onChange={event => setEffective(event.target.value)} /></Field>
              <p className="-mt-2 text-xs text-slate-500">العرض المحلي: {dateLabel(new Date(effective))}</p>
              <Field label="سبب التغيير"><TextInput required value={reason} onChange={event => setReason(event.target.value)} placeholder="مثال: تحديث بعد فحص المولد" /></Field>
              <FormButton busy={saveSetting.isPending}>حفظ الإعداد</FormButton>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="flex gap-4 p-5">
          <Settings2 className="mt-1 h-5 w-5 text-teal-700" />
          <div>
            <p className="font-bold text-slate-800">كيف تستخدم الإعدادات؟</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">أولًا: اعتمد التعرفة اليمنية من الزر أعلاه. ثانيًا: استخدم القائمة لاختيار عامل القدرة أو نموذج الإهلاك أو طريقة الصيانة. ثالثًا: أضف سبب التعديل ثم اضغط حفظ. سيحتفظ النظام بنسخة مؤرخة من كل تغيير دون العبث بالتقارير السابقة.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

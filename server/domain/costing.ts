export type TariffBracket = {
  minKwh: number;
  maxKwh: number | null;
  unitRate: number;
};

export const YEMEN_UTILITY_BRACKETS: TariffBracket[] = [
  { minKwh: 1, maxKwh: 2999, unitRate: 230 },
  { minKwh: 3000, maxKwh: 9999, unitRate: 220 },
  { minKwh: 10000, maxKwh: 19999, unitRate: 200 },
  { minKwh: 20000, maxKwh: 29999, unitRate: 190 },
  { minKwh: 30000, maxKwh: 99999, unitRate: 185 },
  { minKwh: 100000, maxKwh: 199999, unitRate: 180 },
  { minKwh: 200000, maxKwh: 299999, unitRate: 175 },
  { minKwh: 300000, maxKwh: null, unitRate: 170 },
];

export type UtilityCostResult = {
  consumptionKwh: number;
  unitRate: number;
  analyticalAmount: number;
  bracket: TariffBracket | null;
};

export function calculateMeterConsumption(previousReading: number, currentReading: number, multiplier: number) {
  if (previousReading < 0 || currentReading < 0 || multiplier <= 0) {
    throw new Error("قراءات العداد والمعامل يجب أن تكون قيماً موجبة.");
  }
  if (currentReading < previousReading) {
    throw new Error("القراءة الحالية لا يمكن أن تكون أقل من القراءة السابقة.");
  }
  return (currentReading - previousReading) * multiplier;
}

export function findWholeCycleBracket(consumptionKwh: number, brackets: TariffBracket[]) {
  if (consumptionKwh <= 0) return null;
  const sorted = [...brackets].sort((a, b) => a.minKwh - b.minKwh);
  return sorted.find(bracket => consumptionKwh >= bracket.minKwh && (bracket.maxKwh === null || consumptionKwh <= bracket.maxKwh)) ?? null;
}

export function calculateWholeCycleUtilityCost(consumptionKwh: number, brackets: TariffBracket[]): UtilityCostResult {
  const bracket = findWholeCycleBracket(consumptionKwh, brackets);
  if (!bracket && consumptionKwh > 0) {
    throw new Error("لا توجد شريحة تعرفة تغطي استهلاك هذه الدورة.");
  }
  return {
    consumptionKwh,
    unitRate: bracket?.unitRate ?? 0,
    analyticalAmount: consumptionKwh * (bracket?.unitRate ?? 0),
    bracket,
  };
}

export function deriveGeneratorKwh(input: {
  measurementMode: "kwh" | "kw" | "kva";
  directKwh?: number | null;
  averageKw?: number | null;
  averageKva?: number | null;
  runtimeHours: number;
  powerFactor?: number | null;
}) {
  if (input.runtimeHours < 0) throw new Error("ساعات التشغيل لا يمكن أن تكون سالبة.");
  if (input.measurementMode === "kwh") {
    if (input.directKwh === null || input.directKwh === undefined || input.directKwh < 0) throw new Error("يلزم إدخال قيمة kWh مباشرة.");
    return input.directKwh;
  }
  if (input.measurementMode === "kw") {
    if (input.averageKw === null || input.averageKw === undefined || input.averageKw < 0) throw new Error("يلزم إدخال متوسط kW.");
    return input.averageKw * input.runtimeHours;
  }
  if (input.averageKva === null || input.averageKva === undefined || input.averageKva < 0) throw new Error("يلزم إدخال متوسط kVA.");
  if (input.powerFactor === null || input.powerFactor === undefined || input.powerFactor <= 0 || input.powerFactor > 1) {
    throw new Error("يلزم إدخال عامل قدرة بين 0 و1 لتحويل kVA إلى kWh.");
  }
  return input.averageKva * input.powerFactor * input.runtimeHours;
}

export function calculateAccountingDepreciation(input: {
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  monthsInCycle: number;
}) {
  const depreciableBase = Math.max(0, input.acquisitionCost - input.residualValue);
  if (input.usefulLifeMonths <= 0) throw new Error("العمر الإنتاجي المحاسبي يجب أن يكون أكبر من صفر.");
  return (depreciableBase / input.usefulLifeMonths) * input.monthsInCycle;
}

export function calculateOperationalDepreciation(input: {
  acquisitionCost: number;
  residualValue: number;
  usefulLifeHours: number;
  runtimeHours: number;
}) {
  const depreciableBase = Math.max(0, input.acquisitionCost - input.residualValue);
  if (input.usefulLifeHours <= 0) throw new Error("ساعات العمر المتوقعة يجب أن تكون أكبر من صفر.");
  return (depreciableBase / input.usefulLifeHours) * input.runtimeHours;
}

export function calculateAllocatedMaintenance(actualCost: number, expectedServiceHours: number, runtimeHours: number) {
  if (actualCost < 0 || runtimeHours < 0 || expectedServiceHours <= 0) throw new Error("قيم الصيانة غير صالحة.");
  return (actualCost / expectedServiceHours) * runtimeHours;
}

export type EnergySourceRecommendation = {
  status: "recommended" | "equal_cost" | "insufficient_data";
  recommendedSource: "المؤسسة" | "المولدات" | null;
  utilityCostPerKwh: number | null;
  generatorCostPerKwh: number | null;
  savingPerKwh: number | null;
  savingPercentage: number | null;
  comparableKwh: number | null;
  potentialSavings: number | null;
  explanation: string;
};

/**
 * تقارن هذه الدالة تكلفة وحدة الطاقة فقط، كي تبقى المقارنة عادلة رغم اختلاف
 * كميات الطاقة المسجلة للمؤسسة والمولدات داخل الدورة نفسها.
 */
export function recommendEnergySource(input: {
  utilityKwh: number;
  utilityAmount: number;
  generatorKwh: number;
  generatorAmount: number;
}): EnergySourceRecommendation {
  const { utilityKwh, utilityAmount, generatorKwh, generatorAmount } = input;
  if (utilityKwh <= 0 || generatorKwh <= 0 || utilityAmount < 0 || generatorAmount < 0) {
    return {
      status: "insufficient_data",
      recommendedSource: null,
      utilityCostPerKwh: utilityKwh > 0 ? utilityAmount / utilityKwh : null,
      generatorCostPerKwh: generatorKwh > 0 ? generatorAmount / generatorKwh : null,
      savingPerKwh: null,
      savingPercentage: null,
      comparableKwh: null,
      potentialSavings: null,
      explanation: "لا تصدر توصية لأن المقارنة تتطلب طاقة وتكلفة مسجلتين لكل من المؤسسة والمولدات.",
    };
  }

  const utilityCostPerKwh = utilityAmount / utilityKwh;
  const generatorCostPerKwh = generatorAmount / generatorKwh;
  const savingPerKwh = Math.abs(utilityCostPerKwh - generatorCostPerKwh);
  const comparableKwh = Math.min(utilityKwh, generatorKwh);
  const maximumRate = Math.max(utilityCostPerKwh, generatorCostPerKwh);
  const savingPercentage = maximumRate === 0 ? 0 : Math.round(((savingPerKwh / maximumRate) * 100) * 10_000) / 10_000;
  const potentialSavings = savingPerKwh * comparableKwh;

  if (savingPerKwh < 0.005) {
    return {
      status: "equal_cost",
      recommendedSource: null,
      utilityCostPerKwh,
      generatorCostPerKwh,
      savingPerKwh: 0,
      savingPercentage: 0,
      comparableKwh,
      potentialSavings: 0,
      explanation: "تكلفة الكيلوواط متعادلة تقريبًا بين المصدرين؛ يحدد قرار التشغيل وفق الاعتمادية وتوافر الطاقة.",
    };
  }

  const recommendedSource = utilityCostPerKwh < generatorCostPerKwh ? "المؤسسة" : "المولدات";
  return {
    status: "recommended",
    recommendedSource,
    utilityCostPerKwh,
    generatorCostPerKwh,
    savingPerKwh,
    savingPercentage,
    comparableKwh,
    potentialSavings,
    explanation: `يوصى باستخدام ${recommendedSource} لأن تكلفة الكيلوواط أقل بمقدار ${savingPerKwh.toFixed(2)} ر.ي، أي وفر نسبي ${savingPercentage.toFixed(1)}٪ مقارنة بالمصدر الأعلى تكلفة.`,
  };
}

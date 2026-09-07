export function roundFuel(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateCorrectedFuelQuantity(input: {
  quantity: number;
  temperature: number;
  expansionCoefficient: number;
  referenceTemp: number;
}) {
  const { quantity, temperature, expansionCoefficient, referenceTemp } = input;
  if (quantity <= 0) throw new Error("كمية الوقود يجب أن تكون أكبر من صفر.");
  if (expansionCoefficient < 0) throw new Error("معامل التمدد الحراري غير صالح.");
  return roundFuel(quantity * (1 - expansionCoefficient * (temperature - referenceTemp)));
}

export function calculateFuelIssueQuantity(input: {
  previousReading: number;
  currentReading: number;
}) {
  if (input.previousReading < 0 || input.currentReading < 0) throw new Error("قراءات العداد لا يمكن أن تكون سالبة.");
  if (input.currentReading <= input.previousReading) throw new Error("القراءة الحالية يجب أن تكون أكبر من القراءة السابقة.");
  return roundFuel(input.currentReading - input.previousReading);
}

export function calculateFuelBalance(input: {
  openingBalance: number;
  receipts: number;
  issues: number;
  waste: number;
}) {
  const values = Object.values(input);
  if (values.some(value => value < 0)) throw new Error("قيم رصيد الوقود لا يمكن أن تكون سالبة.");
  return roundFuel(input.openingBalance + input.receipts - input.issues - input.waste);
}

export function classifyFuelVariance(difference: number) {
  if (Math.abs(difference) < 0.001) return "balanced" as const;
  return difference > 0 ? "surplus" as const : "shortage" as const;
}

export function assertFuelAvailable(quantity: number, availableBalance: number, actionLabel: string) {
  if (quantity > availableBalance) throw new Error(`كمية ${actionLabel} تتجاوز الرصيد المتاح في الخزان.`);
}

export function assertFuelCapacity(availableBalance: number, incomingQuantity: number, tankCapacity: number) {
  if (availableBalance + incomingQuantity > tankCapacity) throw new Error("كمية التوريد تتجاوز سعة الخزان المتاحة.");
}

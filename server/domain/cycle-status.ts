export type BillingCycleStatus = "draft" | "data_entry" | "validation" | "reviewed" | "approved" | "closed";

const transitions: Record<BillingCycleStatus, BillingCycleStatus[]> = {
  draft: ["data_entry"],
  data_entry: ["draft", "validation"],
  validation: ["data_entry", "reviewed"],
  reviewed: ["data_entry", "approved"],
  approved: ["closed"],
  closed: [],
};

export function assertCycleTransition(from: BillingCycleStatus, to: BillingCycleStatus) {
  if (!transitions[from].includes(to)) {
    throw new Error(`لا يمكن نقل الدورة من حالة ${from} إلى ${to}.`);
  }
}

export function canEditCycle(status: BillingCycleStatus) {
  return status !== "closed";
}

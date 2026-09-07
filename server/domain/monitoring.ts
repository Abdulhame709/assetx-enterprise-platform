export type MonitoringSeverity = "critical" | "warning";

export function assessFuelLevel(availableLiters: number, capacityLiters: number): { ratio: number; severity: MonitoringSeverity } | null {
  if (capacityLiters <= 0) return null;
  const ratio = availableLiters / capacityLiters;
  if (ratio > 0.15) return null;
  return { ratio, severity: ratio <= 0.07 ? "critical" : "warning" };
}

export function assessInventoryVariance(differenceLiters: number): MonitoringSeverity | null {
  if (Math.abs(differenceLiters) < 0.001) return null;
  return Math.abs(differenceLiters) >= 50 ? "critical" : "warning";
}

export function assessMaintenanceRuntime(runtimeHours: number, targetHours: number): MonitoringSeverity | null {
  if (targetHours <= 0 || runtimeHours < targetHours * 0.9) return null;
  return runtimeHours >= targetHours ? "critical" : "warning";
}

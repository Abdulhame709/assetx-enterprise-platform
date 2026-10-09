import { describe, expect, it } from "vitest";

import { toInventorySyncRequest } from "../features/assetx/contracts";
import { displayCycleStatus, displayResult, friendlyError, isCounted, type PendingInventoryMutation } from "../features/assetx/domain";

describe("AssetX Mobile inventory contract", () => {
  it("preserves the original row version and payload when preparing sync", () => {
    const mutation: PendingInventoryMutation = {
      id: "mutation-1", cycle_id: "cycle-1", record_id: "record-1", asset_id: "asset-1", mode: "record",
      base_updated_at: "2026-08-26T12:00:00.000Z", queued_at: "2026-08-26T12:01:00.000Z", attempts: 0,
      payload: { actual_quantity: 1, notes: "تم العثور عليه" },
    };
    expect(toInventorySyncRequest([mutation])).toEqual({
      mutations: [{
        mutation_id: "mutation-1", record_id: "record-1", asset_id: "asset-1", mode: "record",
        base_updated_at: "2026-08-26T12:00:00.000Z", payload: { actual_quantity: 1, notes: "تم العثور عليه" },
      }],
    });
  });

  it("distinguishes an uncounted asset from a saved field result", () => {
    const base = {
      record_id: "record-1", asset_id: "asset-1", asset_code: "A-001", asset_name: "طابعة", expected_location_id: null,
      expected_location: null, expected_location_path: null, actual_location_id: null, actual_location: null, expected_quantity: 1,
      actual_quantity: null, expected_status_id: null, actual_status_id: null, expected_employee_id: null, actual_employee_id: null,
      result: "not_inventoried" as const, inventory_date: null, notes: null, is_verified: false, updated_at: "2026-08-26T12:00:00.000Z",
    };
    expect(isCounted(base)).toBe(false);
    expect(isCounted({ ...base, actual_quantity: 1, inventory_date: "2026-08-26T12:03:00.000Z" })).toBe(true);
  });

  it("keeps Arabic labels clear for the field user", () => {
    expect(displayCycleStatus("in_progress")).toBe("قيد التنفيذ");
    expect(displayResult("not_inventoried")).toBe("بانتظار الجرد");
    expect(friendlyError(new Error("SYNC_CONFLICT"))).toContain("تعارض");
  });
});

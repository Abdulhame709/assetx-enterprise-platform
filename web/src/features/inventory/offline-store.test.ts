import { describe, expect, it } from 'vitest';
import {
  applyLocalInventoryMutation,
  createPendingMutationFromRecord,
  enqueueInventoryMutation,
  getStoredSnapshot,
  listPendingInventoryMutations,
  loadInventoryOfflineState,
  saveStoredSnapshot,
  type CachedInventoryRecord,
  type StorageLike,
} from './offline-store';
import type { InventoryCycle, MobileInventorySnapshotRecord } from './api';

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const cycle: InventoryCycle = {
  id: 'cycle-1', year: 2026, status: 'in_progress', start_date: null, end_date: null, created_at: '2026-08-21T00:00:00.000Z',
};

const record: MobileInventorySnapshotRecord = {
  record_id: 'record-1', asset_id: 'asset-1', asset_code: 'A-001', asset_name: 'Laptop',
  expected_location_id: 'location-1', expected_location: 'المقر', expected_location_path: 'المقر',
  actual_location_id: null, actual_location: null, expected_quantity: 1, actual_quantity: null,
  expected_status_id: 'status-1', actual_status_id: null,
  expected_employee_id: 'employee-1', actual_employee_id: null,
  result: 'not_inventoried', inventory_date: null, notes: null, is_verified: false,
  updated_at: '2026-08-21T10:00:00.000Z',
};

function cached(storage: MemoryStorage): CachedInventoryRecord {
  return getStoredSnapshot('cycle-1', storage)!.records[0];
}

describe('inventory offline store', () => {
  it('stores a snapshot without using browser globals', () => {
    const storage = new MemoryStorage();
    saveStoredSnapshot({ cycle, records: [record] }, storage, '2026-08-21T11:00:00.000Z');
    const stored = getStoredSnapshot('cycle-1', storage);

    expect(stored?.downloaded_at).toBe('2026-08-21T11:00:00.000Z');
    expect(stored?.records[0].sync_state).toBe('synced');
    expect(loadInventoryOfflineState(storage).pending).toHaveLength(0);
  });

  it('applies a local count and queues a first record operation', () => {
    const storage = new MemoryStorage();
    saveStoredSnapshot({ cycle, records: [record] }, storage);
    const mutation = createPendingMutationFromRecord('cycle-1', cached(storage), {
      actual_quantity: 1,
      actual_location_id: 'location-1',
      notes: 'تم التحقق ميدانياً',
    }, storage);

    expect(mutation.mode).toBe('record');
    expect(mutation.base_updated_at).toBe(record.updated_at);
    expect(cached(storage).actual_quantity).toBe(1);
    expect(cached(storage).sync_state).toBe('pending');
    expect(listPendingInventoryMutations('cycle-1', storage)).toHaveLength(1);
  });

  it('coalesces a recount for the same record while preserving first-count mode', () => {
    const storage = new MemoryStorage();
    saveStoredSnapshot({ cycle, records: [record] }, storage);
    const first = createPendingMutationFromRecord('cycle-1', cached(storage), { actual_quantity: 1 }, storage);
    const second = enqueueInventoryMutation({
      cycle_id: 'cycle-1', record_id: 'record-1', asset_id: 'asset-1', mode: 'update',
      payload: { actual_quantity: 2 }, base_updated_at: record.updated_at,
    }, storage);

    expect(second.id).toBe(first.id);
    expect(second.mode).toBe('record');
    expect(listPendingInventoryMutations('cycle-1', storage)[0].payload.actual_quantity).toBe(2);
  });

  it('honors explicit null values when applying local changes', () => {
    const storage = new MemoryStorage();
    saveStoredSnapshot({ cycle, records: [{ ...record, actual_quantity: 3, actual_location_id: 'location-2' }] }, storage);
    const changed = applyLocalInventoryMutation('cycle-1', 'record-1', {
      actual_quantity: null,
      actual_location_id: null,
      notes: null,
    }, storage, '2026-08-21T12:00:00.000Z');

    expect(changed?.actual_quantity).toBeNull();
    expect(changed?.actual_location_id).toBeNull();
    expect(changed?.notes).toBeNull();
    expect(changed?.is_verified).toBe(false);
  });
});

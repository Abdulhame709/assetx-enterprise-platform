import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InventoryCycle, MobileInventorySnapshotRecord } from './api';
import {
  createPendingMutationFromRecord,
  getStoredSnapshot,
  listPendingInventoryMutations,
  saveStoredSnapshot,
  type CachedInventoryRecord,
  type StorageLike,
} from './offline-store';
import { syncInventoryMutations } from './api';
import { syncPendingInventoryMutations } from './sync-inventory';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, syncInventoryMutations: vi.fn() };
});

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

function pendingRecord(storage: MemoryStorage): CachedInventoryRecord {
  return getStoredSnapshot('cycle-1', storage)!.records[0];
}

function seed(storage: MemoryStorage): string {
  saveStoredSnapshot({ cycle, records: [record] }, storage);
  return createPendingMutationFromRecord('cycle-1', pendingRecord(storage), { actual_quantity: 1 }, storage).id;
}

describe('sync pending inventory mutations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('removes a mutation and marks the cached record synced', async () => {
    const storage = new MemoryStorage();
    const mutationId = seed(storage);
    vi.mocked(syncInventoryMutations).mockResolvedValueOnce([{
      mutation_id: mutationId, record_id: 'record-1', status: 'synced', updated_at: '2026-08-21T12:00:00.000Z',
    }]);

    await expect(syncPendingInventoryMutations('cycle-1', storage)).resolves.toEqual({ synced: 1, conflicts: 0, failed: 0 });
    expect(listPendingInventoryMutations('cycle-1', storage)).toHaveLength(0);
    expect(pendingRecord(storage).sync_state).toBe('synced');
    expect(pendingRecord(storage).updated_at).toBe('2026-08-21T12:00:00.000Z');
  });

  it('does not overwrite a newer server record when the backend reports a conflict', async () => {
    const storage = new MemoryStorage();
    const mutationId = seed(storage);
    vi.mocked(syncInventoryMutations).mockResolvedValueOnce([{
      mutation_id: mutationId, record_id: 'record-1', status: 'conflict', code: 'SYNC_CONFLICT',
    }]);

    await expect(syncPendingInventoryMutations('cycle-1', storage)).resolves.toEqual({ synced: 0, conflicts: 1, failed: 0 });
    expect(listPendingInventoryMutations('cycle-1', storage)).toHaveLength(0);
    expect(pendingRecord(storage).sync_state).toBe('conflict');
  });

  it('keeps transient failures queued and marks them conflict after three attempts', async () => {
    const storage = new MemoryStorage();
    seed(storage);
    vi.mocked(syncInventoryMutations).mockRejectedValue(new Error('network unavailable'));

    await expect(syncPendingInventoryMutations('cycle-1', storage)).resolves.toEqual({ synced: 0, conflicts: 0, failed: 1 });
    expect(listPendingInventoryMutations('cycle-1', storage)[0].attempts).toBe(1);
    await expect(syncPendingInventoryMutations('cycle-1', storage)).resolves.toEqual({ synced: 0, conflicts: 0, failed: 1 });
    expect(listPendingInventoryMutations('cycle-1', storage)[0].attempts).toBe(2);
    await expect(syncPendingInventoryMutations('cycle-1', storage)).resolves.toEqual({ synced: 0, conflicts: 1, failed: 0 });
    expect(listPendingInventoryMutations('cycle-1', storage)).toHaveLength(0);
    expect(pendingRecord(storage).sync_state).toBe('conflict');
  });
});

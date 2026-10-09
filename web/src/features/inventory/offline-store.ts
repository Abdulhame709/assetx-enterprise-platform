import {
  InventoryCycle,
  MobileInventorySnapshotRecord,
  RecordCountInput,
} from './api';

export const INVENTORY_OFFLINE_STORAGE_KEY = 'assetx.inventory.field.v1';
export const INVENTORY_OFFLINE_STATE_VERSION = 1 as const;

export type OfflineSyncState = 'synced' | 'pending' | 'conflict';
export type OfflineMutationMode = 'record' | 'update';

export type CachedInventoryRecord = MobileInventorySnapshotRecord & {
  sync_state: OfflineSyncState;
  local_updated_at: string | null;
};

export interface StoredInventorySnapshot {
  cycle: InventoryCycle;
  cycle_id: string;
  downloaded_at: string;
  records: CachedInventoryRecord[];
}

export interface PendingInventoryMutation {
  id: string;
  cycle_id: string;
  record_id: string;
  asset_id: string;
  mode: OfflineMutationMode;
  payload: RecordCountInput;
  base_updated_at: string | null;
  queued_at: string;
  attempts: number;
}

export interface InventoryOfflineState {
  version: typeof INVENTORY_OFFLINE_STATE_VERSION;
  snapshots: Record<string, StoredInventorySnapshot>;
  pending: PendingInventoryMutation[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function emptyState(): InventoryOfflineState {
  return { version: INVENTORY_OFFLINE_STATE_VERSION, snapshots: {}, pending: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeState(value: unknown): InventoryOfflineState {
  if (!isRecord(value) || value.version !== INVENTORY_OFFLINE_STATE_VERSION) return emptyState();
  const snapshots = isRecord(value.snapshots) ? value.snapshots : {};
  const pending = Array.isArray(value.pending) ? value.pending : [];
  return {
    version: INVENTORY_OFFLINE_STATE_VERSION,
    snapshots: snapshots as Record<string, StoredInventorySnapshot>,
    pending: pending.filter(isRecord) as unknown as PendingInventoryMutation[],
  };
}

export function loadInventoryOfflineState(storage: StorageLike | null = browserStorage()): InventoryOfflineState {
  if (!storage) return emptyState();
  try {
    const raw = storage.getItem(INVENTORY_OFFLINE_STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveInventoryOfflineState(
  state: InventoryOfflineState,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(INVENTORY_OFFLINE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearInventoryOfflineState(storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(INVENTORY_OFFLINE_STORAGE_KEY);
  } catch {
    // Storage may be unavailable or quota-limited; callers keep the server copy.
  }
}

export function getStoredSnapshot(
  cycleId: string,
  storage: StorageLike | null = browserStorage(),
): StoredInventorySnapshot | null {
  return loadInventoryOfflineState(storage).snapshots[cycleId] ?? null;
}

export function saveStoredSnapshot(
  snapshot: { cycle: InventoryCycle; records: MobileInventorySnapshotRecord[] },
  storage: StorageLike | null = browserStorage(),
  downloadedAt = new Date().toISOString(),
): StoredInventorySnapshot {
  const state = loadInventoryOfflineState(storage);
  const pendingByRecord = new Map(
    state.pending
      .filter((item) => item.cycle_id === snapshot.cycle.id)
      .map((item) => [item.record_id, item]),
  );
  const previousRecords = new Map(
    state.snapshots[snapshot.cycle.id]?.records.map((record) => [record.record_id, record]) ?? [],
  );
  const stored: StoredInventorySnapshot = {
    cycle: snapshot.cycle,
    cycle_id: snapshot.cycle.id,
    downloaded_at: downloadedAt,
    records: snapshot.records.map((record) => {
      const pending = pendingByRecord.get(record.record_id);
      const previous = previousRecords.get(record.record_id);
      if (!pending || !previous) {
        return { ...record, sync_state: 'synced', local_updated_at: null };
      }
      return {
        ...record,
        actual_location_id: previous.actual_location_id,
        actual_location: previous.actual_location,
        actual_quantity: previous.actual_quantity,
        actual_status_id: previous.actual_status_id,
        actual_employee_id: previous.actual_employee_id,
        inventory_date: previous.inventory_date,
        notes: previous.notes,
        is_verified: false,
        sync_state: 'pending',
        local_updated_at: previous.local_updated_at,
      };
    }),
  };
  state.snapshots[snapshot.cycle.id] = stored;
  saveInventoryOfflineState(state, storage);
  return stored;
}

function createMutationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `inventory-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function enqueueInventoryMutation(
  mutation: Omit<PendingInventoryMutation, 'id' | 'queued_at' | 'attempts'>,
  storage: StorageLike | null = browserStorage(),
  queuedAt = new Date().toISOString(),
): PendingInventoryMutation {
  const state = loadInventoryOfflineState(storage);
  const existingIndex = state.pending.findIndex(
    (item) => item.cycle_id === mutation.cycle_id && item.record_id === mutation.record_id,
  );
  const existing = existingIndex >= 0 ? state.pending[existingIndex] : null;
  const next: PendingInventoryMutation = {
    ...mutation,
    id: existing?.id ?? createMutationId(),
    queued_at: existing?.queued_at ?? queuedAt,
    attempts: 0,
    mode: existing?.mode === 'record' ? 'record' : mutation.mode,
    base_updated_at: existing?.base_updated_at ?? mutation.base_updated_at,
  };
  if (existingIndex >= 0) state.pending.splice(existingIndex, 1, next);
  else state.pending.push(next);
  saveInventoryOfflineState(state, storage);
  return next;
}

export function removePendingInventoryMutation(
  mutationId: string,
  storage: StorageLike | null = browserStorage(),
): void {
  const state = loadInventoryOfflineState(storage);
  state.pending = state.pending.filter((item) => item.id !== mutationId);
  saveInventoryOfflineState(state, storage);
}

export function incrementPendingInventoryMutationAttempts(
  mutationId: string,
  storage: StorageLike | null = browserStorage(),
): PendingInventoryMutation | null {
  const state = loadInventoryOfflineState(storage);
  const mutation = state.pending.find((item) => item.id === mutationId);
  if (!mutation) return null;
  mutation.attempts += 1;
  saveInventoryOfflineState(state, storage);
  return mutation;
}

export function listPendingInventoryMutations(
  cycleId?: string,
  storage: StorageLike | null = browserStorage(),
): PendingInventoryMutation[] {
  const pending = loadInventoryOfflineState(storage).pending;
  return cycleId ? pending.filter((item) => item.cycle_id === cycleId) : pending;
}

export function markStoredRecordSyncState(
  cycleId: string,
  recordId: string,
  syncState: OfflineSyncState,
  storage: StorageLike | null = browserStorage(),
  localUpdatedAt: string | null = syncState === 'synced' ? null : new Date().toISOString(),
  serverUpdatedAt?: string | null,
): StoredInventorySnapshot | null {
  const state = loadInventoryOfflineState(storage);
  const snapshot = state.snapshots[cycleId];
  if (!snapshot) return null;
  const record = snapshot.records.find((item) => item.record_id === recordId);
  if (!record) return snapshot;
  record.sync_state = syncState;
  record.local_updated_at = localUpdatedAt;
  if (serverUpdatedAt) record.updated_at = serverUpdatedAt;
  saveInventoryOfflineState(state, storage);
  return snapshot;
}

export function applyLocalInventoryMutation(
  cycleId: string,
  recordId: string,
  payload: RecordCountInput,
  storage: StorageLike | null = browserStorage(),
  localUpdatedAt = new Date().toISOString(),
): CachedInventoryRecord | null {
  const state = loadInventoryOfflineState(storage);
  const snapshot = state.snapshots[cycleId];
  const record = snapshot?.records.find((item) => item.record_id === recordId);
  if (!record) return null;
  if (Object.prototype.hasOwnProperty.call(payload, 'actual_quantity')) {
    record.actual_quantity = payload.actual_quantity ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'actual_location_id')) {
    record.actual_location_id = payload.actual_location_id ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'actual_status_id')) {
    record.actual_status_id = payload.actual_status_id ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'actual_employee_id')) {
    record.actual_employee_id = payload.actual_employee_id ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
    record.notes = payload.notes ?? null;
  }
  record.inventory_date = localUpdatedAt;
  record.is_verified = false;
  record.sync_state = 'pending';
  record.local_updated_at = localUpdatedAt;
  saveInventoryOfflineState(state, storage);
  return record;
}

export function createPendingMutationFromRecord(
  cycleId: string,
  record: CachedInventoryRecord,
  payload: RecordCountInput,
  storage: StorageLike | null = browserStorage(),
): PendingInventoryMutation {
  const mode: OfflineMutationMode = record.actual_quantity == null ? 'record' : 'update';
  const mutation = enqueueInventoryMutation({
    cycle_id: cycleId,
    record_id: record.record_id,
    asset_id: record.asset_id,
    mode,
    payload,
    base_updated_at: record.updated_at,
  }, storage);
  applyLocalInventoryMutation(cycleId, record.record_id, payload, storage);
  return mutation;
}

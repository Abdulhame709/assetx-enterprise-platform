export type CycleStatus = "new" | "in_progress" | "closed";
export type InventoryResult = "matched" | "deficit" | "surplus" | "transferred" | "missing" | "not_inventoried";
export type OfflineSyncState = "synced" | "pending" | "conflict";
export type OfflineMutationMode = "record" | "update";

export interface AssetXUser { id: string; username: string; tenant_id: string; }
export interface AuthTokens { accessToken: string; refreshToken: string; }
export interface InventoryCycle { id: string; year: number; status: CycleStatus; start_date: string | null; end_date: string | null; created_at: string; }
export interface LocationOption { id: string; name: string; full_path: string; parent_id: string | null; level_number: number; is_active: boolean; }
export interface MobileInventorySnapshotRecord {
  record_id: string; asset_id: string; asset_code: string; asset_name: string;
  expected_location_id: string | null; expected_location: string | null; expected_location_path: string | null;
  actual_location_id: string | null; actual_location: string | null; expected_quantity: number | null; actual_quantity: number | null;
  expected_status_id: string | null; actual_status_id: string | null; expected_employee_id: string | null; actual_employee_id: string | null;
  result: InventoryResult; inventory_date: string | null; notes: string | null; is_verified: boolean; updated_at: string | null;
}
export interface MobileInventorySnapshot { cycle: InventoryCycle; records: MobileInventorySnapshotRecord[]; }
export interface RecordCountInput { actual_quantity: number | null; actual_location_id?: string | null; actual_status_id?: string | null; actual_employee_id?: string | null; notes?: string | null; }
export interface CachedInventoryRecord extends MobileInventorySnapshotRecord { sync_state: OfflineSyncState; local_updated_at: string | null; }
export interface StoredInventorySnapshot { cycle: InventoryCycle; cycle_id: string; downloaded_at: string; records: CachedInventoryRecord[]; }
export interface PendingInventoryMutation { id: string; cycle_id: string; record_id: string; asset_id: string; mode: OfflineMutationMode; payload: RecordCountInput; base_updated_at: string | null; queued_at: string; attempts: number; last_error?: string | null; }
export interface InventorySyncResult { mutation_id: string; record_id: string; status: "synced" | "conflict" | "error"; updated_at?: string; code?: string; }

export class AssetXApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = "AssetXApiError"; }
}

export function isCounted(record: MobileInventorySnapshotRecord): boolean { return record.inventory_date !== null || record.actual_quantity !== null; }
export function displayCycleStatus(status: CycleStatus): string { return status === "new" ? "جديدة" : status === "in_progress" ? "قيد التنفيذ" : "مغلقة"; }
export function displayResult(result: InventoryResult): string {
  return { matched: "متطابق", deficit: "عجز", surplus: "زيادة", transferred: "موقع مختلف", missing: "مفقود", not_inventoried: "بانتظار الجرد" }[result];
}
export function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "REQUEST_FAILED";
  return ({
    BACKEND_URL_REQUIRED: "أدخل رابط Backend أولاً.", INVALID_BACKEND_URL: "رابط Backend غير صحيح. ابدأه بـ http:// أو https://.",
    INVALID_CREDENTIALS: "اسم المستخدم أو كلمة المرور غير صحيحين.", SESSION_REVOKED: "انتهت الجلسة. سجل الدخول مرة أخرى.",
    SYNC_CONFLICT: "حدث تعارض لأن هذا السجل عُدّل من جهاز آخر.", CYCLE_CLOSED: "هذه الدورة مغلقة ولا يمكن تعديلها.",
    NETWORK_REQUEST_FAILED: "تعذر الاتصال بالخادم. احفظ العمل ثم حاول المزامنة لاحقاً.",
    SAME_LOCATION: "الموقع الفعلي يطابق الموقع المسجل للأصل، لذلك لا يلزم اقتراح نقل.",
    DUPLICATE_PENDING: "يوجد اقتراح نقل معلق لهذا الأصل بالفعل.",
    FORBIDDEN: "ليس لدى هذا الحساب صلاحية إنشاء اقتراح نقل.",
  } as Record<string, string>)[raw] ?? "تعذر إكمال العملية. تحقق من الاتصال ثم أعد المحاولة.";
}

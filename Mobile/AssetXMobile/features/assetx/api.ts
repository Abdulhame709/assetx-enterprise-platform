import { AssetXApiError, type AssetXUser, type AuthTokens, type InventoryCycle, type InventorySyncResult, type MobileInventorySnapshot, type PendingInventoryMutation } from "./domain";
import { clearAuth, getBackendUrl, getStoredUser, getTokens, saveAuth } from "./secure-storage";
import { toInventorySyncRequest } from "./contracts";

type JsonRecord = Record<string, unknown>;
const asRecord = (value: unknown): JsonRecord => typeof value === "object" && value !== null ? value as JsonRecord : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : (Array.isArray(asRecord(value).items) ? asRecord(value).items as unknown[] : Array.isArray(asRecord(value).data) ? asRecord(value).data as unknown[] : []);
const stringOrNull = (value: unknown): string | null => value === null || value === undefined ? null : String(value);
const numberOrNull = (value: unknown): number | null => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
function mapCycle(value: unknown): InventoryCycle | null { const row = asRecord(value); if (!row.id) return null; return { id: String(row.id), year: Number(row.year ?? 0), status: row.status === "in_progress" || row.status === "closed" ? row.status : "new", start_date: stringOrNull(row.start_date), end_date: stringOrNull(row.end_date), created_at: String(row.created_at ?? "") }; }
function mapSnapshot(value: unknown): MobileInventorySnapshot {
  const payload = asRecord(value); const cycle = mapCycle(payload.cycle); if (!cycle) throw new AssetXApiError("UNEXPECTED_RESPONSE");
  const records = asArray(payload.records).map((value) => { const row = asRecord(value); if (!row.record_id) return null; return {
    record_id: String(row.record_id), asset_id: String(row.asset_id ?? ""), asset_code: String(row.asset_code ?? ""), asset_name: String(row.asset_name ?? ""),
    expected_location_id: stringOrNull(row.expected_location_id), expected_location: stringOrNull(row.expected_location), expected_location_path: stringOrNull(row.expected_location_path),
    actual_location_id: stringOrNull(row.actual_location_id), actual_location: stringOrNull(row.actual_location), expected_quantity: numberOrNull(row.expected_quantity), actual_quantity: numberOrNull(row.actual_quantity),
    expected_status_id: stringOrNull(row.expected_status_id), actual_status_id: stringOrNull(row.actual_status_id), expected_employee_id: stringOrNull(row.expected_employee_id), actual_employee_id: stringOrNull(row.actual_employee_id),
    result: String(row.result ?? "not_inventoried") as MobileInventorySnapshot["records"][number]["result"], inventory_date: stringOrNull(row.inventory_date), notes: stringOrNull(row.notes), is_verified: row.is_verified === true, updated_at: stringOrNull(row.updated_at),
  }; }).filter((record): record is MobileInventorySnapshot["records"][number] => record !== null);
  return { cycle, records };
}
async function readResponse(response: Response): Promise<unknown> { const text = await response.text(); try { return text ? JSON.parse(text) : null; } catch { return { message: text }; } }
async function request(baseUrl: string, path: string, init: RequestInit): Promise<Response> { try { return await fetch(`${baseUrl}${path}`, { ...init, headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers } }); } catch { throw new AssetXApiError("NETWORK_REQUEST_FAILED"); } }
function errorFrom(status: number, payload: unknown) { const row = asRecord(payload); return new AssetXApiError(typeof row.message === "string" ? row.message : typeof row.error === "string" ? row.error : "REQUEST_FAILED", status); }
async function refreshAccessToken(baseUrl: string): Promise<AuthTokens | null> {
  const tokens = await getTokens(); if (!tokens) return null; const response = await request(baseUrl, "/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: tokens.refreshToken }) }); const payload = await readResponse(response);
  if (!response.ok) { await clearAuth(); return null; } const row = asRecord(payload); const accessToken = typeof row.accessToken === "string" ? row.accessToken : null; const refreshToken = typeof row.refreshToken === "string" ? row.refreshToken : null; const user = await getStoredUser();
  if (!accessToken || !refreshToken || !user) { await clearAuth(); return null; } await saveAuth({ accessToken, refreshToken }, user); return { accessToken, refreshToken };
}
async function authenticatedJson<T>(path: string, method: "GET" | "POST" | "PATCH", body?: unknown): Promise<T> {
  const baseUrl = await getBackendUrl(); if (!baseUrl) throw new AssetXApiError("BACKEND_URL_REQUIRED"); let tokens = await getTokens(); if (!tokens) throw new AssetXApiError("SESSION_REVOKED");
  const invoke = (accessToken: string) => request(baseUrl, path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { Authorization: `Bearer ${accessToken}` } });
  let response = await invoke(tokens.accessToken); if (response.status === 401) { tokens = await refreshAccessToken(baseUrl); if (!tokens) throw new AssetXApiError("SESSION_REVOKED", 401); response = await invoke(tokens.accessToken); }
  const payload = await readResponse(response); if (!response.ok) throw errorFrom(response.status, payload); return payload as T;
}
export async function login(username: string, password: string): Promise<AssetXUser> {
  const baseUrl = await getBackendUrl(); if (!baseUrl) throw new AssetXApiError("BACKEND_URL_REQUIRED"); const response = await request(baseUrl, "/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }); const payload = await readResponse(response); if (!response.ok) throw errorFrom(response.status, payload);
  const row = asRecord(payload); const user = asRecord(row.user); const accessToken = typeof row.accessToken === "string" ? row.accessToken : null; const refreshToken = typeof row.refreshToken === "string" ? row.refreshToken : null; if (!accessToken || !refreshToken || !user.id || !user.username || !user.tenant_id) throw new AssetXApiError("UNEXPECTED_RESPONSE");
  const account = { id: String(user.id), username: String(user.username), tenant_id: String(user.tenant_id) }; await saveAuth({ accessToken, refreshToken }, account); return account;
}
export async function logout(): Promise<void> { try { await authenticatedJson("/auth/logout", "POST"); } finally { await clearAuth(); } }
export async function getCycles(): Promise<InventoryCycle[]> { const payload = await authenticatedJson<unknown>("/inventory/cycles", "GET"); return asArray(payload).map(mapCycle).filter((cycle): cycle is InventoryCycle => cycle !== null).sort((a, b) => b.year - a.year); }
export async function downloadMobileSnapshot(cycleId: string) { return mapSnapshot(await authenticatedJson<unknown>(`/inventory/cycles/${cycleId}/mobile-snapshot`, "GET")); }
export async function syncCycle(cycleId: string, mutations: PendingInventoryMutation[]): Promise<InventorySyncResult[]> {
  const payload = await authenticatedJson<unknown>(`/inventory/cycles/${cycleId}/sync`, "POST", toInventorySyncRequest(mutations));
  return asArray(asRecord(payload).results).map((value) => { const row = asRecord(value); return { mutation_id: String(row.mutation_id ?? ""), record_id: String(row.record_id ?? ""), status: row.status === "synced" || row.status === "conflict" ? row.status : "error", updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined, code: typeof row.code === "string" ? row.code : undefined }; }).filter((result) => result.mutation_id !== "") as InventorySyncResult[];
}

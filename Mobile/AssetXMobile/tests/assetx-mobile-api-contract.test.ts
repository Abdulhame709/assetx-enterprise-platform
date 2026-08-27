import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  clearAuth: vi.fn(), getBackendUrl: vi.fn(), getStoredUser: vi.fn(), getTokens: vi.fn(), saveAuth: vi.fn(),
}));
vi.mock("../features/assetx/secure-storage", () => storage);

import { createPendingTransferRequest, downloadMobileSnapshot, login } from "../features/assetx/api";

describe("AssetX Mobile live API contracts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    storage.getBackendUrl.mockResolvedValue("http://127.0.0.1:3001");
    storage.getTokens.mockResolvedValue({ accessToken: "access-test", refreshToken: "refresh-test" });
  });

  it("sends login only to the direct backend auth endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ accessToken: "access", refreshToken: "refresh", user: { id: "user-1", username: "field", tenant_id: "tenant-1" } }), { status: 200 }));
    await expect(login("field", "password-123")).resolves.toMatchObject({ username: "field", tenant_id: "tenant-1" });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3001/auth/login", expect.objectContaining({ method: "POST", body: JSON.stringify({ username: "field", password: "password-123" }) }));
    expect(storage.saveAuth).toHaveBeenCalled();
  });

  it("preserves the backend invalid-credentials code for the Arabic login message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: null, error: { code: "INVALID_CREDENTIALS", message: "INVALID_CREDENTIALS", details: {} } }), { status: 401 }));
    await expect(login("field", "wrong-password")).rejects.toMatchObject({ message: "INVALID_CREDENTIALS", status: 401 });
  });

  it("downloads the correct cycle snapshot with the saved token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ cycle: { id: "cycle-1", year: 2026, status: "in_progress", created_at: "2026-01-01" }, records: [] }), { status: 200 }));
    await expect(downloadMobileSnapshot("cycle-1")).resolves.toMatchObject({ cycle: { id: "cycle-1" }, records: [] });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3001/inventory/cycles/cycle-1/mobile-snapshot", expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: "Bearer access-test" }) }));
  });

  it("creates a pending transfer request instead of calling direct asset transfer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "move-1", status: "pending" }), { status: 201 }));
    await expect(createPendingTransferRequest({ asset_id: "asset-1", from_location_id: "from-1", to_location_id: "to-1", quantity: 1, reason: "field discrepancy" })).resolves.toEqual({ id: "move-1", status: "pending" });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3001/assets/asset-1/movements", expect.objectContaining({ method: "POST" }));
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('"movement_type":"transfer"');
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain('"status":"approved"');
  });
});

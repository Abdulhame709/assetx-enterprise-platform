import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ clearAuth: vi.fn(), getBackendUrl: vi.fn(), getStoredUser: vi.fn(), getTokens: vi.fn(), saveAuth: vi.fn() }));
vi.mock("../features/assetx/secure-storage", () => storage);

import { getCycles, getLocations } from "../features/assetx/api";

describe("AssetX Mobile refresh rotation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    storage.getBackendUrl.mockResolvedValue("http://127.0.0.1:3001");
    storage.getStoredUser.mockResolvedValue({ id: "user-1", username: "field", tenant_id: "tenant-1" });
    storage.getTokens.mockResolvedValue({ accessToken: "expired-access", refreshToken: "one-time-refresh" });
  });

  it("shares one refresh request when two protected screens load together", async () => {
    let protectedCallCount = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return new Response(JSON.stringify({ accessToken: "new-access", refreshToken: "new-refresh" }), { status: 200 });
      protectedCallCount += 1;
      if (protectedCallCount <= 2) return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "expired" } }), { status: 401 });
      return new Response(JSON.stringify(url.endsWith("/inventory/cycles") ? [] : []), { status: 200 });
    });

    await expect(Promise.all([getCycles(), getLocations()])).resolves.toEqual([[], []]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"))).toHaveLength(1);
    expect(storage.clearAuth).not.toHaveBeenCalled();
    expect(storage.saveAuth).toHaveBeenCalledWith({ accessToken: "new-access", refreshToken: "new-refresh" }, expect.objectContaining({ username: "field" }));
  });
});

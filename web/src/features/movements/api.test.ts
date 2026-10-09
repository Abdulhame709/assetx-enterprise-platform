import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '@/lib/api/client';
import { createMovement } from './api';

vi.mock('@/lib/api/client', () => ({
  API_BASE_URL: '/api',
  http: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

describe('movement API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a pending missing movement request through the asset route', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({
      id: 'movement-1',
      asset_id: 'asset-1',
      movement_type: 'missing',
      status: 'pending',
      from_location_id: 'location-1',
      to_location_id: null,
      from_employee_id: null,
      to_employee_id: null,
      from_status_id: 'status-1',
      to_status_id: null,
      reason: 'Inventory count marked the asset missing',
      reference_number: 'INV-cycle-1',
      quantity: 0,
      notes: null,
      performed_by: 'user-1',
      approved_by: null,
      approved_at: null,
      created_at: '2026-08-21T12:00:00.000Z',
    });

    const movement = await createMovement('asset-1', {
      movement_type: 'missing',
      reason: 'Inventory count marked the asset missing',
      quantity: 0,
      reference_number: 'INV-cycle-1',
    });

    expect(http.post).toHaveBeenCalledWith('/assets/asset-1/movements', {
      asset_id: 'asset-1',
      movement_type: 'missing',
      reason: 'Inventory count marked the asset missing',
      quantity: 0,
      reference_number: 'INV-cycle-1',
    });
    expect(movement).toMatchObject({ id: 'movement-1', movement_type: 'missing', status: 'pending' });
  });
});

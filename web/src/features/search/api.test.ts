import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '@/lib/api/client';
import { EMPTY_NAMES } from '@/features/assets/mappers';
import { getSavedSearches, searchResource } from './api';

vi.mock('@/lib/api/client', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

describe('advanced search API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sends asset filters, sorting, and pagination to the advanced endpoint', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({
      items: [{ id: 'asset-1', name: 'Printer', full_asset_code: 'A-1', base_asset_code: 'A-1', quantity: 1, is_active: true }],
      total: 1,
      page: 2,
      limit: 20,
      hasMore: false,
    });

    const result = await searchResource('assets', {
      q: 'printer',
      filters: { status_id: 'status-1', price_from: '100' },
      sort: 'purchase_price',
      dir: 'desc',
      page: 2,
      limit: 20,
    }, EMPTY_NAMES);

    expect(http.get).toHaveBeenCalledWith('/search/assets?q=printer&status_id=status-1&price_from=100&sort=purchase_price&dir=desc&page=2&limit=20');
    expect(result).toMatchObject({ total: 1, page: 2, limit: 20, hasMore: false });
    expect(result.items[0]).toMatchObject({ id: 'asset-1', name: 'Printer' });
  });

  it('maps movement search rows and saved-search list responses', async () => {
    vi.mocked(http.get)
      .mockResolvedValueOnce({ items: [{ id: 'movement-1', movement_type: 'transfer', status: 'pending', quantity: '2' }], total: 1, page: 1, limit: 20, hasMore: false })
      .mockResolvedValueOnce([{ id: 'saved-1', name: 'Pending transfers', resource: 'movements', filters: { status: 'pending' }, is_default: false, version: 1 }]);

    const movement = await searchResource('movements', {
      q: '', filters: { status: 'pending' }, sort: 'created_at', dir: 'desc', page: 1, limit: 20,
    }, EMPTY_NAMES);
    const saved = await getSavedSearches();

    expect(movement.items[0]).toMatchObject({ id: 'movement-1', movement_type: 'transfer', quantity: 2 });
    expect(saved[0]).toMatchObject({ id: 'saved-1', resource: 'movements', name: 'Pending transfers' });
  });
});

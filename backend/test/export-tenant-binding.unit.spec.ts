/**
 * The on-screen report preview runs no audit write first, so each report provider
 * must bind the tenant itself; otherwise Row-Level Security hides every row and
 * the preview reads "no rows" for any filter.
 */
import { AssetsExportProvider } from '../src/application/export/providers/assets-export.provider';
import { DuplicatesExportProvider } from '../src/application/export/providers/duplicates-export.provider';

const TENANT = '8797c8d8-8c19-4593-8157-421e322e5012';

function fakeDb(order: string[]) {
  return {
    setTenant: jest.fn(async () => { order.push('setTenant'); }),
    query: jest.fn(async () => { order.push('query'); return { rows: [], rowCount: 0 }; }),
  };
}

describe('report providers bind the tenant before reading', () => {
  it('assets', async () => {
    const order: string[] = [];
    const db = fakeDb(order);
    const assets = { search: jest.fn(async () => { order.push('search'); return { items: [], total: 0 }; }) };
    await new AssetsExportProvider(assets as never, db as never).getData(TENANT, {});
    expect(order[0]).toBe('setTenant');
    expect(order.indexOf('setTenant')).toBeLessThan(order.indexOf('search'));
  });

  it('duplicates', async () => {
    const order: string[] = [];
    const db = fakeDb(order);
    await new DuplicatesExportProvider(db as never).getData(TENANT, {});
    expect(order[0]).toBe('setTenant');
    expect(order.indexOf('setTenant')).toBeLessThan(order.indexOf('query'));
  });
});

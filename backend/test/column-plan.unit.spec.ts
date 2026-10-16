import { resolveColumnPlan } from '../src/infrastructure/export/column-plan';

describe('resolveColumnPlan — base code only', () => {
  it('maps a saved layout that names the full code onto the base code', () => {
    const plan = resolveColumnPlan([], {
      columns: [
        { key: 'name', label: 'Asset', order: 2 },
        { key: 'full_asset_code', label: 'Asset Code', order: 1 },
      ],
    } as never);
    expect(plan.keys).toEqual(['base_asset_code', 'name']);
  });

  it('prints the base code under the plain "asset code" label', () => {
    const plan = resolveColumnPlan([{ base_asset_code: '2025-0038' }], { meta: { lang: 'ar' } } as never);
    expect(plan.labels).toEqual(['رمز الأصل']);
  });
});

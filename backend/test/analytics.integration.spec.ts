/**
 * Integration tests — Analytics Layer (Task T7).
 * KPI/aggregation/grouping/time series/trend/percentage/growth/chart dataset.
 * Real PostgreSQL (PGlite). Reference: Task T7 approved scope
 */
import { createHarness, Harness } from './support/db.harness';
import { AnalyticsQuery } from '../src/core/entities/analytics.entity';

describe('Analytics Layer — integration (Task T7)', () => {
  let h: Harness;

  beforeAll(async () => { h = await createHarness(); });

  const rows = [
    { status: 'Good', purchase_price: 1000, period: '2026-01' },
    { status: 'Good', purchase_price: 2000, period: '2026-01' },
    { status: 'Damaged', purchase_price: 3000, period: '2026-02' },
    { status: 'Damaged', purchase_price: 4000, period: '2026-02' },
  ];

  it('validates query (invalid resource throws)', () => {
    expect(() => h.analytics.validate({ resource: 'nope' as never })).toThrow('INVALID_ANALYTICS_RESOURCE');
  });

  it('SUM aggregation over all rows', () => {
    const q: AnalyticsQuery = { resource: 'assets', measures: [{ name: 'total', field: 'purchase_price', aggregation: 'SUM' }] };
    const out = h.analytics.aggregate(rows, q);
    expect(out[0].total).toBe(10000);
  });

  it('COUNT grouping by status', () => {
    const q: AnalyticsQuery = { resource: 'assets', dimensions: [{ name: 'status' }], measures: [{ name: 'count', aggregation: 'COUNT' }] };
    const out = h.analytics.aggregate(rows, q);
    const good = out.find((r) => r.status === 'Good');
    const damaged = out.find((r) => r.status === 'Damaged');
    expect(good!.count).toBe(2);
    expect(damaged!.count).toBe(2);
  });

  it('AVG and MIN/MAX', () => {
    const q: AnalyticsQuery = { resource: 'assets', measures: [
      { name: 'avg', field: 'purchase_price', aggregation: 'AVG' },
      { name: 'min', field: 'purchase_price', aggregation: 'MIN' },
      { name: 'max', field: 'purchase_price', aggregation: 'MAX' },
    ] };
    const out = h.analytics.aggregate(rows, q);
    expect(out[0].avg).toBe(2500);
    expect(out[0].min).toBe(1000);
    expect(out[0].max).toBe(4000);
  });

  it('time series grouped by period', () => {
    const ts = h.analytics.timeSeries(rows, 'period', { name: 'count', aggregation: 'COUNT' });
    expect(ts.points.length).toBe(2);
    expect(ts.points.find((p) => p.label === '2026-01')!.value).toBe(2);
  });

  it('trend analysis computes current/previous/growth', () => {
    const t = h.analytics.trendAnalysis(rows, { name: 'count', aggregation: 'COUNT' }, 'period');
    expect(t.previous).toBe(2);   // 2026-01
    expect(t.current).toBe(2);    // 2026-02
    expect(t.growthPct).toBe(0);
    expect(t.direction).toBe('flat');
  });

  it('growth between two values', () => {
    expect(h.analytics.growth(120, 100)).toBe(20);
    expect(h.analytics.growth(100, 120)).toBeCloseTo(-16.67, 0);
  });

  it('percentage', () => {
    expect(h.analytics.percentage([50, 50])).toBe(50);
  });

  it('chart dataset (pie) grouped by status', () => {
    const ds = h.analytics.chartDataset(rows, 'status', { name: 'count', aggregation: 'COUNT' }, 'pie');
    expect(ds.type).toBe('pie');
    expect(ds.labels).toEqual(expect.arrayContaining(['Good', 'Damaged']));
    expect(ds.values).toEqual(expect.arrayContaining([2, 2]));
  });

  it('dashboard widget (topN summary-card)', () => {
    const q: AnalyticsQuery = { resource: 'assets', dimensions: [{ name: 'status' }], measures: [{ name: 'total', field: 'purchase_price', aggregation: 'SUM' }], limit: 2 };
    const widget = h.analytics.widget('w1', 'Top Status', 'topN', rows, q);
    expect(widget.id).toBe('w1');
    expect(Array.isArray(widget.dataset.data)).toBe(true);
  });

  it('execute returns grouped rows + chart dataset + metadata', () => {
    const q: AnalyticsQuery = { resource: 'assets', dimensions: [{ name: 'status' }], measures: [{ name: 'total', field: 'purchase_price', aggregation: 'SUM' }] };
    const res = h.analytics.execute(rows, q);
    expect(res.rows.length).toBe(2);
    expect(res.datasets![0].labels).toContain('Good');
    expect(res.metadata.rowCount).toBe(4);
    expect(res.metadata.resource).toBe('assets');
  });
});

/**
 * AnalyticsService — reusable Enterprise Analytics layer.
 * Computes KPIs, aggregations, percentages, trends, comparisons, and chart-ready
 * datasets from raw rows. Prepares data only (no rendering/UI/chart library).
 * Not coupled to Report Templates; does not duplicate Report Builder logic.
 * Reference: Task T7
 */
import { Injectable } from '@nestjs/common';
import {
  AggregationStrategy,
  AnalyticsQuery,
  AnalyticsResult,
  ChartDataset,
  DashboardWidget,
  Dimension,
  Measure,
  TimeSeries,
  TrendAnalysis,
  WidgetDataset,
} from '../core/entities/analytics.entity';

const VALID_RESOURCES = ['assets', 'movements', 'inventory', 'audit', 'dashboard'];
const VALID_AGGREGATIONS: AggregationStrategy[] = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'PERCENTAGE', 'GROWTH', 'TREND'];

@Injectable()
export class AnalyticsService {
  /** Validate an analytics query. Throws on invalid input. */
  validate(query: AnalyticsQuery): void {
    if (!query || !VALID_RESOURCES.includes(query.resource)) throw new Error('INVALID_ANALYTICS_RESOURCE');
    for (const d of query.dimensions ?? []) {
      if (!d || !d.name) throw new Error('INVALID_ANALYTICS_DIMENSION');
    }
    for (const m of query.measures ?? []) {
      if (!m || !m.name || !VALID_AGGREGATIONS.includes(m.aggregation)) throw new Error('INVALID_ANALYTICS_MEASURE');
    }
  }

  /** Aggregate raw rows into grouped measures. Returns a summary per group. */
  aggregate(rows: Array<Record<string, unknown>>, query: AnalyticsQuery): Array<Record<string, unknown>> {
    const dims = query.dimensions ?? [];
    const measures = query.measures ?? [];
    if (dims.length === 0) {
      // single aggregate over all rows
      const out: Record<string, unknown> = {};
      for (const m of measures) out[m.name] = this.compute(rows, m);
      return [out];
    }
    const groups = new Map<string, Array<Record<string, unknown>>>();
    for (const r of rows) {
      const key = dims.map((d) => String(r[d.name] ?? '')).join('|');
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }
    const result: Array<Record<string, unknown>> = [];
    for (const [key, list] of groups) {
      const rec: Record<string, unknown> = {};
      const parts = key.split('|');
      dims.forEach((d, i) => { rec[d.name] = parts[i]; });
      for (const m of measures) rec[m.name] = this.compute(list, m);
      result.push(rec);
    }
    return result;
  }

  /** Compute a single measure over a set of rows. */
  compute(rows: Array<Record<string, unknown>>, measure: Measure): number {
    const key = measure.field ?? measure.name;
    const vals = rows.map((r) => Number(r[key] ?? 0)).filter((n) => Number.isFinite(n));
    const agg = measure.aggregation;
    switch (agg) {
      case 'COUNT': return rows.length;
      case 'SUM': return vals.reduce((a, b) => a + b, 0);
      case 'AVG': return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      case 'MIN': return vals.length ? Math.min(...vals) : 0;
      case 'MAX': return vals.length ? Math.max(...vals) : 0;
      case 'PERCENTAGE': return vals.length ? this.percentage(vals) : 0;
      case 'GROWTH': return vals.length >= 2 ? this.growth(vals[vals.length - 1], vals[0]) : 0;
      case 'TREND': return vals.length ? this.trend(vals) : 0;
      default: return 0;
    }
  }

  percentage(vals: number[]): number {
    const total = vals.reduce((a, b) => a + b, 0);
    return total === 0 ? 0 : Math.round((vals[0] / total) * 10000) / 100;
  }

  growth(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100;
  }

  trend(vals: number[]): number {
    // simple slope over indices
    if (vals.length < 2) return 0;
    const n = vals.length;
    const xs = vals.map((_, i) => i);
    const xMean = (n - 1) / 2;
    const yMean = vals.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (vals[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    return den === 0 ? 0 : Math.round((num / den) * 100) / 100;
  }

  /** Build a time series from rows grouped by a time dimension. */
  timeSeries(rows: Array<Record<string, unknown>>, dimension: string, measure: Measure): TimeSeries {
    const grouped = this.aggregate(rows, { resource: 'dashboard', dimensions: [{ name: dimension }], measures: [measure] });
    const points = grouped.map((g) => ({ label: String(g[dimension] ?? ''), value: Number(g[measure.name] ?? 0) }));
    return { dimension, points };
  }

  /** Build a trend analysis (current vs previous period). */
  trendAnalysis(rows: Array<Record<string, unknown>>, measure: Measure, splitField = 'period'): TrendAnalysis {
    const grouped = this.aggregate(rows, { resource: 'dashboard', dimensions: [{ name: splitField }], measures: [measure] });
    const sorted = grouped.sort((a, b) => String(a[splitField]).localeCompare(String(b[splitField])));
    const current = sorted.length ? Number(sorted[sorted.length - 1][measure.name] ?? 0) : 0;
    const previous = sorted.length > 1 ? Number(sorted[sorted.length - 2][measure.name] ?? 0) : 0;
    const change = current - previous;
    const growthPct = this.growth(current, previous);
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    return { dimension: splitField, current, previous, change, growthPct, direction };
  }

  /** Build a chart-ready dataset from rows grouped by a dimension. */
  chartDataset(rows: Array<Record<string, unknown>>, dimension: string, measure: Measure, type: ChartDataset['type'] = 'bar'): ChartDataset {
    const grouped = this.aggregate(rows, { resource: 'dashboard', dimensions: [{ name: dimension }], measures: [measure] });
    return {
      type,
      labels: grouped.map((g) => String(g[dimension] ?? '')),
      values: grouped.map((g) => Number(g[measure.name] ?? 0)),
    };
  }

  /** Prepare a dashboard widget from rows. */
  widget(id: string, title: string, kind: WidgetDataset['kind'], rows: Array<Record<string, unknown>>, query: AnalyticsQuery): DashboardWidget {
    const dataset: WidgetDataset = { kind, title, data: null };
    const dimension = query.dimensions?.[0]?.name;
    const measure = query.measures?.[0] ?? { name: 'value', aggregation: 'COUNT' };
    switch (kind) {
      case 'summary-card':
        dataset.data = this.aggregate(rows, { resource: query.resource, measures: query.measures })[0] ?? {};
        break;
      case 'topN':
      case 'bottomN': {
        const grouped = this.aggregate(rows, { resource: query.resource, dimensions: query.dimensions, measures: query.measures });
        const sorted = grouped.sort((a, b) => Number(b[measure.name] ?? 0) - Number(a[measure.name] ?? 0));
        const slice = kind === 'topN' ? sorted.slice(0, query.limit ?? 10) : sorted.slice(-(query.limit ?? 10));
        dataset.data = slice;
        break;
      }
      case 'trend':
        dataset.data = dimension ? this.timeSeries(rows, dimension, measure) : [];
        break;
      case 'pie':
      case 'bar':
      case 'line':
      case 'stacked':
      case 'table':
        dataset.data = dimension ? this.chartDataset(rows, dimension, measure, kind as ChartDataset['type']) : { type: kind, labels: [], values: [] };
        break;
    }
    return { id, title, dataset };
  }

  /** Execute an analytics query over raw rows. */
  execute(rows: Array<Record<string, unknown>>, query: AnalyticsQuery): AnalyticsResult {
    this.validate(query);
    const grouped = this.aggregate(rows, query);
    const datasets: ChartDataset[] = [];
    const dim = query.dimensions?.[0]?.name;
    const measure = query.measures?.[0];
    if (dim && measure) datasets.push(this.chartDataset(rows, dim, measure, 'bar'));
    return {
      query,
      rows: grouped,
      datasets: datasets.length ? datasets : undefined,
      metadata: {
        generatedAt: new Date().toISOString(),
        resource: query.resource,
        rowCount: rows.length,
      },
    };
  }
}

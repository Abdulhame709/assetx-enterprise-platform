/**
 * Analytics entities — reusable Enterprise Analytics layer.
 * Prepares analytical data only (no rendering, no UI, no chart library).
 * Not coupled to frontend or Report Templates. Reference: Task T7
 */

export type AggregationStrategy =
  | 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'
  | 'PERCENTAGE' | 'GROWTH' | 'TREND';

export type AnalyticsDimension =
  | 'time' | 'category' | 'status' | 'location' | 'department'
  | 'employee' | 'asset_type' | 'organization';

export interface Dimension {
  name: string;               // dimension key (e.g. status)
  label?: string;
}

export interface Measure {
  name: string;               // measure key / output name
  label?: string;
  field?: string;             // source column (defaults to name)
  aggregation: AggregationStrategy;
}

export interface AnalyticsQuery {
  resource: string;           // assets | movements | inventory | audit | dashboard
  dimensions?: Dimension[];
  measures?: Measure[];
  /** filter criteria (field -> value/range), passed to data source */
  filters?: Record<string, unknown>;
  /** e.g. topN/bottomN */
  limit?: number;
  sort?: { field: string; dir: 'asc' | 'desc' };
}

export interface TimeSeriesPoint {
  label: string;              // time bucket label (e.g. 2026-01)
  value: number;
}

export interface TimeSeries {
  dimension: string;
  points: TimeSeriesPoint[];
}

export interface TrendAnalysis {
  dimension: string;
  current: number;
  previous: number;
  change: number;             // absolute change
  growthPct: number;          // percentage growth
  direction: 'up' | 'down' | 'flat';
}

export interface ComparisonAnalysis {
  label: string;
  value: number;
  /** previous period value for comparison */
  previous?: number;
  changePct?: number;
}

export interface ChartDataset {
  type: 'bar' | 'line' | 'pie' | 'stacked' | 'table';
  labels: string[];
  values: number[];
  /** series for stacked/multi-series */
  series?: Record<string, number[]>;
}

export interface WidgetDataset {
  kind: 'summary-card' | 'topN' | 'bottomN' | 'trend' | 'pie' | 'bar' | 'line' | 'stacked' | 'table';
  title: string;
  data: unknown;              // summary value, array of rows, or ChartDataset
  metadata?: AnalyticsMetadata;
}

export interface KPIDefinition {
  name: string;
  label?: string;
  measure: Measure;
  /** optional comparison with previous period */
  comparePrevious?: boolean;
}

export interface MetricDefinition {
  name: string;
  label?: string;
  aggregation: AggregationStrategy;
  field?: string;
}

export interface AnalyticsMetadata {
  generatedAt: string;
  resource: string;
  rowCount: number;
  /** extension points (not implemented): forecasting, predictive, aiInsights, ... */
  future?: Record<string, unknown>;
}

export interface AnalyticsResult {
  query: AnalyticsQuery;
  rows: Array<Record<string, unknown>>;
  kpis?: Array<Record<string, unknown>>;
  datasets?: ChartDataset[];
  metadata: AnalyticsMetadata;
}

export interface DashboardWidget {
  id: string;
  title: string;
  dataset: WidgetDataset;
}

// Future extension-point keys (NOT implemented)
export const ANALYTICS_FUTURE = [
  'forecasting', 'predictive', 'aiInsights', 'heatmaps', 'geo',
  'drillDown', 'drillThrough', 'benchmarking',
] as const;

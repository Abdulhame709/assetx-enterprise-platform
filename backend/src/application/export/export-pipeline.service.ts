/**
 * ExportPipelineService — unified export pipeline (Task T8).
 * Drives every export through the same stages:
 *   Prepare → Transform → Format → Write → Stream.
 * It is format-agnostic: the format-specific work is delegated to an
 * ExportStrategy (Strategy Pattern). It also:
 *   - streams the output through a byte-counting PassThrough (no full buffering
 *     at this layer; CSV streams natively, buffered formats stream out),
 *   - publishes lifecycle events (EXPORT_PROGRESS / EXPORT_COMPLETED / EXPORT_FAILED),
 *   - finalizes export metrics (duration, rows, output size, success/failure).
 * Extension points prepared (NOT implemented): cancellation (options.signal),
 * retry policies, paged fetching — see Technical Debt / Decision Log.
 * Reference: Task T8 — Enterprise Export Framework.
 */
import { Inject, Injectable } from '@nestjs/common';
import { PassThrough, Transform } from 'stream';
import { EventBus } from '../../core/events/event-bus';
import { DOMAIN_EVENTS } from '../../core/events/event-types';
import { EVENT_BUS } from '../../core/ports/tokens';
import { ExportProvider } from '../../core/ports/export-provider.port';
import { ExportStrategy, ExportStrategyState } from '../../core/ports/export-strategy.port';
import { ExportMetadata, ExportOptions } from '../../core/entities/export.entity';
import { ExportProfile } from '../../core/entities/export-profile.entity';
import { ExportDataAdapter, ExportRow } from './adapters/export-data.adapter';
import { ExportMetricsService } from './export-metrics.service';
import { ReportBuilderService } from '../report-builder.service';
import { ReportDefinition } from '../../core/entities/report.entity';
import { insertLocationBands, isGroupRow, sortByLocation } from '../../core/constants/report-groups';

/** Row key holding the location's full path ("Main / Sub"). */
const LOCATION_KEY = 'location_name';

/** Byte threshold between incremental EXPORT_PROGRESS emissions. */
const PROGRESS_INTERVAL_BYTES = 64 * 1024; // 64 KB

export interface ExportPipelineContext {
  tenant: string;
  user: string;
  resource: string;
  provider: ExportProvider;
  strategy: ExportStrategy;
  profile?: ExportProfile;
  options: ExportOptions;
  /** metric correlation id returned by ExportMetricsService.start() */
  metricId: string;
  mode: 'SYNC' | 'ASYNC';
}

export interface ExportPipelineResult {
  /** byte-counting pass-through stream the caller can consume/pipe */
  stream: PassThrough;
  rows: number;
  /** live output size in bytes (updates as the stream is consumed) */
  bytes: () => number;
  strategy: ExportStrategy;
  metadata: ExportMetadata;
}

@Injectable()
export class ExportPipelineService {
  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    private readonly metrics: ExportMetricsService,
    private readonly adapter: ExportDataAdapter,
    private readonly reportBuilder: ReportBuilderService,
  ) {}

  /** Run the full pipeline for a resolved provider + strategy. */
  async run(ctx: ExportPipelineContext): Promise<ExportPipelineResult> {
    const started = Date.now();

    // 1 · PREPARE — strategy allocates per-run resources.
    const state: ExportStrategyState = await ctx.strategy.prepare(ctx.options);

    // 2 · TRANSFORM — fetch raw data and normalize into uniform rows.
    const { rows: reportRows } = await this.buildRows({
      tenant: ctx.tenant,
      resource: ctx.resource,
      format: ctx.strategy.format,
      provider: ctx.provider,
      options: ctx.options,
    });
    const transformed: ExportRow[] = ctx.strategy.transform(reportRows, ctx.options);
    const outputRows = transformed.length;
    this.publishProgress(ctx, { phase: 'transform', rows: outputRows, bytes: 0, percent: 0 });

    // 3 · FORMAT — strategy builds the format-specific structure.
    await ctx.strategy.formatOutput(state, transformed, ctx.options);

    // 4+5 · WRITE → STREAM — produce the output stream and measure it.
    const raw = ctx.strategy.write(state);
    let lastEmitted = 0;
    const { pass, bytes } = this.measured(raw, (total) => {
      if (total - lastEmitted >= PROGRESS_INTERVAL_BYTES) {
        lastEmitted = total;
        this.publishProgress(ctx, { phase: 'stream', rows: outputRows, bytes: total, percent: null });
      }
    });

    pass.on('end', () => {
      const metric = this.metrics.complete(ctx.metricId, outputRows, bytes());
      this.publishProgress(ctx, { phase: 'complete', rows: outputRows, bytes: bytes(), percent: 100 });
      this.bus.publish({
        event: DOMAIN_EVENTS.EXPORT_COMPLETED,
        tenant_id: ctx.tenant,
        userId: ctx.user,
        entityId: ctx.resource,
        payload: { resource: ctx.resource, format: ctx.strategy.format, rows: outputRows, bytes: bytes(), duration: Date.now() - started, metric },
      });
    });

    pass.on('error', (err) => {
      const metric = this.metrics.fail(ctx.metricId, (err as Error).message);
      this.bus.publish({
        event: DOMAIN_EVENTS.EXPORT_FAILED,
        tenant_id: ctx.tenant,
        userId: ctx.user,
        entityId: ctx.resource,
        payload: { resource: ctx.resource, format: ctx.strategy.format, reason: (err as Error).message, metric },
      });
    });

    const metadata: ExportMetadata = {
      resource: ctx.resource as ExportMetadata['resource'],
      format: ctx.strategy.format,
      rows: outputRows,
      size: bytes(),
      duration: Date.now() - started,
      user: ctx.user,
      tenant: ctx.tenant,
      mode: ctx.mode,
      generated_at: new Date().toISOString(),
    };

    return { stream: pass, rows: outputRows, bytes, strategy: ctx.strategy, metadata };
  }

  /**
   * The rows a report prints: provider data → report definition (columns, sorting,
   * aggregates) → location order → row numbers → location bands. The on-screen
   * preview calls this too, so it always shows what the file will contain.
   * `options.columns` is adjusted in place to match the rows.
   */
  async buildRows(args: {
    tenant: string;
    resource: string;
    format: ExportPipelineContext['strategy']['format'];
    provider: ExportProvider;
    options: ExportOptions;
  }): Promise<{ rows: ExportRow[]; total: number }> {
    const { options } = args;
    const { rows, total } = await args.provider.getData(args.tenant, options);
    const adapted: ExportRow[] = this.adapter.toRows(rows);
    let reportRows = this.applyReportDefinition(adapted, args.resource, args.format, options);
    const byLocation = this.wantsLocationGroups(reportRows, options);
    if (byLocation) reportRows = sortByLocation(reportRows);
    reportRows = this.addRowNumbers(reportRows, options);
    this.dropColumnsMissingFromRows(reportRows, options);
    if (byLocation) reportRows = this.groupByLocation(reportRows, options);
    return { rows: reportRows, total: Math.max(total, reportRows.filter((row) => !isGroupRow(row)).length) };
  }

  /** `group_by=location` only applies to detail rows that carry their location. */
  private wantsLocationGrouping(options: ExportOptions): boolean {
    return options.filters?.group_by === 'location';
  }

  private wantsLocationGroups(rows: ExportRow[], options: ExportOptions): boolean {
    const report = options.filters?.__report as { grouping?: unknown[] } | undefined;
    if (Array.isArray(report?.grouping) && report.grouping.length > 0) return false;
    return this.wantsLocationGrouping(options) && rows.length > 0 && LOCATION_KEY in rows[0];
  }

  /**
   * Adds the location bands and takes the location column out of the table (the
   * band says it). Without an explicit column list the rows' own columns are used,
   * so the band rows never decide the columns.
   */
  private groupByLocation(rows: ExportRow[], options: ExportOptions): ExportRow[] {
    const grouped = insertLocationBands(rows, LOCATION_KEY) as ExportRow[];
    const columns = options.columns && options.columns.length > 0
      ? options.columns
      : Object.keys(rows[0] ?? {}).map((key, order) => ({ key, order }));
    options.columns = columns.filter((column) => column.key !== LOCATION_KEY);
    return grouped;
  }

  /**
   * A profile is shared across resources (e.g. the finance profile lists asset
   * columns), so keep only the columns the rows actually carry. If none match,
   * fall back to the rows' natural columns instead of exporting empty ones.
   */
  private dropColumnsMissingFromRows(rows: ExportRow[], options: ExportOptions): void {
    if (!options.columns || options.columns.length === 0 || rows.length === 0) return;
    const present = new Set(Object.keys(rows[0]));
    const kept = options.columns.filter((c) => present.has(c.key));
    if (kept.length === options.columns.length) return;
    if (kept.length === 0) delete options.columns;
    else options.columns = kept;
  }

  /**
   * Report designer "row numbers": prepend a running # column. Skipped for grouped
   * output (rows are aggregates) and when the rows already carry their own row_no.
   */
  private addRowNumbers(rows: ExportRow[], options: ExportOptions): ExportRow[] {
    if (!options.meta?.rowNumbers || rows.length === 0 || 'row_no' in rows[0]) return rows;
    const report = options.filters?.__report as { grouping?: unknown[] } | undefined;
    if (Array.isArray(report?.grouping) && report.grouping.length > 0) return rows;
    if (options.columns && options.columns.length > 0 && !options.columns.some((c) => c.key === 'row_no')) {
      options.columns = [{ key: 'row_no', order: -1 }, ...options.columns];
    }
    return rows.map((row, index) => ({ row_no: index + 1, ...row }));
  }

  private applyReportDefinition(
    rows: ExportRow[],
    resource: string,
    format: ExportPipelineContext['strategy']['format'],
    options: ExportOptions,
  ): ExportRow[] {
    const metadata = options.filters?.__report;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return rows;
    const raw = metadata as Record<string, unknown>;
    const columns = Array.isArray(raw.columns)
      ? raw.columns
        .map((column) => {
          if (typeof column === 'string') return { field: column };
          if (column && typeof column === 'object' && !Array.isArray(column)) {
            const source = column as Record<string, unknown>;
            return { field: String(source.field ?? ''), ...(source.label ? { label: String(source.label) } : {}) };
          }
          return { field: '' };
        })
        .filter((column) => column.field.length > 0)
      : Object.keys(rows[0] ?? {}).map((field) => ({ field }));
    const report: ReportDefinition = {
      id: `export-${resource}`,
      name: `Export ${resource}`,
      resource: resource as ReportDefinition['resource'],
      format,
      columns,
      sorting: Array.isArray(raw.sorting) ? raw.sorting as ReportDefinition['sorting'] : [],
      grouping: Array.isArray(raw.grouping) ? raw.grouping as ReportDefinition['grouping'] : [],
    };
    this.reportBuilder.validate(report);
    const transformed = this.reportBuilder.transformRows(rows, report) as ExportRow[];
    if (report.grouping && report.grouping.length > 0 && transformed.length > 0) {
      const requested = report.columns.map((column) => column.field);
      const aliasesToSkip = new Set<string>(
        report.grouping.filter((group) => group.valueField).map((group) => group.aggregate ?? 'count'),
      );
      const present = Object.keys(transformed[0]);
      const outputKeys = [...requested.filter((key) => present.includes(key))];
      for (const key of present) {
        if (!outputKeys.includes(key) && !aliasesToSkip.has(key)) outputKeys.push(key);
      }
      options.columns = outputKeys.map((key, order) => {
        const source = report.columns.find((column) => column.field === key);
        return { key, order, ...(source?.label ? { label: source.label } : {}) };
      });
    }
    return transformed;
  }

  /**
   * Wrap a readable in a counting Transform that passes bytes through.
   * Counting happens on the WRITABLE side (transform callback) so nothing is
   * consumed from the readable side before the response consumer attaches.
   * The old PassThrough + 'data' listener approach silently ate the stream.
   */
  private measured(raw: NodeJS.ReadableStream, onProgress?: (total: number) => void): { pass: PassThrough; bytes: () => number } {
    let count = 0;
    const pass = new Transform({
      transform(chunk: Buffer, _enc: BufferEncoding, callback: (err?: Error | null, data?: Buffer) => void) {
        count += chunk.length;
        if (onProgress) onProgress(count);
        callback(null, chunk);
      },
    });
    raw.on('error', (e) => pass.destroy(e));
    raw.pipe(pass);
    return { pass: pass as unknown as PassThrough, bytes: () => count };
  }

  private publishProgress(ctx: ExportPipelineContext, p: { phase: string; rows: number; bytes: number; percent: number | null }): void {
    this.bus.publish({
      event: DOMAIN_EVENTS.EXPORT_PROGRESS,
      tenant_id: ctx.tenant,
      userId: ctx.user,
      entityId: ctx.resource,
      payload: {
        resource: ctx.resource,
        format: ctx.strategy.format,
        phase: p.phase,
        rows: p.rows,
        bytes: p.bytes,
        percent: p.percent,
      },
    });
  }
}

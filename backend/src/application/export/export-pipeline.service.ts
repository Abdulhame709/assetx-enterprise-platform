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
import { PassThrough } from 'stream';
import { EventBus } from '../../core/events/event-bus';
import { DOMAIN_EVENTS } from '../../core/events/event-types';
import { EVENT_BUS } from '../../core/ports/tokens';
import { ExportProvider } from '../../core/ports/export-provider.port';
import { ExportStrategy, ExportStrategyState } from '../../core/ports/export-strategy.port';
import { ExportMetadata, ExportOptions } from '../../core/entities/export.entity';
import { ExportProfile } from '../../core/entities/export-profile.entity';
import { ExportDataAdapter, ExportRow } from './adapters/export-data.adapter';
import { ExportMetricsService } from './export-metrics.service';

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
  ) {}

  /** Run the full pipeline for a resolved provider + strategy. */
  async run(ctx: ExportPipelineContext): Promise<ExportPipelineResult> {
    const started = Date.now();

    // 1 · PREPARE — strategy allocates per-run resources.
    const state: ExportStrategyState = await ctx.strategy.prepare(ctx.options);

    // 2 · TRANSFORM — fetch raw data and normalize into uniform rows.
    const { rows, total } = await ctx.provider.getData(ctx.tenant, ctx.options);
    const adapted: ExportRow[] = this.adapter.toRows(rows);
    const transformed: ExportRow[] = ctx.strategy.transform(adapted, ctx.options);
    this.publishProgress(ctx, { phase: 'transform', rows: total, bytes: 0, percent: 0 });

    // 3 · FORMAT — strategy builds the format-specific structure.
    await ctx.strategy.formatOutput(state, transformed, ctx.options);

    // 4+5 · WRITE → STREAM — produce the output stream and measure it.
    const raw = ctx.strategy.write(state);
    const { pass, bytes } = this.measured(raw);
    let lastEmitted = 0;

    pass.on('data', (chunk: Buffer) => {
      if (bytes() - lastEmitted >= PROGRESS_INTERVAL_BYTES) {
        lastEmitted = bytes();
        this.publishProgress(ctx, { phase: 'stream', rows: total, bytes: bytes(), percent: null });
      }
    });

    pass.on('end', () => {
      const metric = this.metrics.complete(ctx.metricId, total, bytes());
      this.publishProgress(ctx, { phase: 'complete', rows: total, bytes: bytes(), percent: 100 });
      this.bus.publish({
        event: DOMAIN_EVENTS.EXPORT_COMPLETED,
        tenant_id: ctx.tenant,
        userId: ctx.user,
        entityId: ctx.resource,
        payload: { resource: ctx.resource, format: ctx.strategy.format, rows: total, bytes: bytes(), duration: Date.now() - started, metric },
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
      rows: total,
      size: bytes(),
      duration: Date.now() - started,
      user: ctx.user,
      tenant: ctx.tenant,
      mode: ctx.mode,
      generated_at: new Date().toISOString(),
    };

    return { stream: pass, rows: total, bytes, strategy: ctx.strategy, metadata };
  }

  /** Wrap a readable in a PassThrough that counts bytes as they flow. */
  private measured(raw: NodeJS.ReadableStream): { pass: PassThrough; bytes: () => number } {
    let count = 0;
    const pass = new PassThrough();
    pass.on('data', (c: Buffer) => { count += c.length; });
    raw.on('error', (e) => pass.destroy(e));
    raw.pipe(pass);
    return { pass, bytes: () => count };
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

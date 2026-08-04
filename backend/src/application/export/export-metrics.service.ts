/**
 * ExportMetricsService — collects per-export telemetry (Task T8).
 * In-memory only (no DB schema change). Records duration, rows exported, output
 * size and success/failure, and exposes a roll-up summary. Records are capped to
 * avoid unbounded growth. Reference: Task T8 — Enterprise Export Framework.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ExportMetric, ExportMetricSummary } from '../../core/entities/export-metric.entity';

const MAX_RETAINED = 500;

@Injectable()
export class ExportMetricsService {
  private readonly records = new Map<string, ExportMetric>();

  start(input: { tenant: string; user: string; resource: string; format: string; profile?: string }): ExportMetric {
    const metric: ExportMetric = {
      id: randomUUID(),
      tenant: input.tenant,
      user: input.user,
      resource: input.resource,
      format: input.format,
      profile: input.profile,
      rowsExported: 0,
      outputSize: 0,
      duration: 0,
      success: false,
      status: 'started',
      startedAt: new Date().toISOString(),
    };
    this.records.set(metric.id, metric);
    this.trim();
    return metric;
  }

  update(id: string, patch: Partial<ExportMetric>): ExportMetric | undefined {
    const existing = this.records.get(id);
    if (!existing) return undefined;
    const next = { ...existing, ...patch };
    this.records.set(id, next);
    return next;
  }

  complete(id: string, rowsExported: number, outputSize: number): ExportMetric | undefined {
    return this.update(id, {
      status: 'completed',
      success: true,
      rowsExported,
      outputSize,
      duration: this.elapsed(this.records.get(id)?.startedAt),
      completedAt: new Date().toISOString(),
    });
  }

  fail(id: string, error: string): ExportMetric | undefined {
    return this.update(id, {
      status: 'failed',
      success: false,
      error,
      duration: this.elapsed(this.records.get(id)?.startedAt),
      completedAt: new Date().toISOString(),
    });
  }

  get(id: string): ExportMetric | undefined {
    return this.records.get(id);
  }

  all(): ExportMetric[] {
    return Array.from(this.records.values());
  }

  summary(): ExportMetricSummary {
    const list = this.all();
    const successful = list.filter((m) => m.success).length;
    const failed = list.filter((m) => m.status === 'failed').length;
    const byFormat: Record<string, number> = {};
    for (const m of list) byFormat[m.format] = (byFormat[m.format] ?? 0) + 1;
    return {
      total: list.length,
      successful,
      failed,
      totalRowsExported: list.reduce((a, m) => a + m.rowsExported, 0),
      totalOutputBytes: list.reduce((a, m) => a + m.outputSize, 0),
      averageDurationMs: list.length ? list.reduce((a, m) => a + m.duration, 0) / list.length : 0,
      byFormat,
    };
  }

  private elapsed(startedAt?: string): number {
    if (!startedAt) return 0;
    return Math.max(0, Date.now() - new Date(startedAt).getTime());
  }

  private trim(): void {
    const keys = this.records.keys();
    while (this.records.size > MAX_RETAINED) {
      const first = keys.next();
      if (first.done) break;
      this.records.delete(first.value);
    }
  }
}

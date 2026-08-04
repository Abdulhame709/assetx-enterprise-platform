/**
 * ExportStrategyFactory — selects an ExportStrategy by format (Strategy Pattern).
 * Centralizes strategy selection so the pipeline/orchestrator has no switch.
 * New formats register here (or via the EXPORT_STRATEGIES token array) without
 * touching ExportService. Reference: Task T8 — Enterprise Export Framework.
 */
import { Injectable, Inject } from '@nestjs/common';
import { ExportFormat } from '../../../core/entities/export.entity';
import { ExportStrategy } from '../../../core/ports/export-strategy.port';
import { EXPORT_STRATEGIES } from '../../../core/ports/tokens';

@Injectable()
export class ExportStrategyFactory {
  private readonly byFormat = new Map<ExportFormat, ExportStrategy>();

  constructor(@Inject(EXPORT_STRATEGIES) strategies: ExportStrategy[]) {
    for (const s of strategies) this.byFormat.set(s.format, s);
  }

  get(format: ExportFormat): ExportStrategy {
    const strategy = this.byFormat.get(format);
    if (!strategy) throw new Error('UNSUPPORTED_EXPORT_FORMAT');
    return strategy;
  }
}

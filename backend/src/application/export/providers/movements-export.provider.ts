/**
 * MovementsExportProvider — fetches movement data for export.
 * Knows only its own data source (MovementRepository). No formatting logic.
 * Reference: Phase 11.3
 */
import { Inject, Injectable } from '@nestjs/common';
import { MovementPort } from '../../../core/ports/movement.port';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { MOVEMENT_PORT } from '../../../core/ports/tokens';

@Injectable()
export class MovementsExportProvider implements ExportProvider {
  readonly resource = 'movements';

  constructor(@Inject(MOVEMENT_PORT) private readonly movements: MovementPort) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const filters = options?.filters as { status?: 'pending' | 'approved' | 'rejected'; movement_type?: string } | undefined;
    const rows = await this.movements.list(tenantId, filters as { status?: 'pending' | 'approved' | 'rejected' } | undefined);
    return { rows, total: rows.length };
  }
}

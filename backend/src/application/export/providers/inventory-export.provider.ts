/**
 * InventoryExportProvider — fetches inventory result data for export.
 * Uses the latest cycle's results from InventoryResultService. No formatting logic.
 * Reference: Phase 11.3
 */
import { Injectable } from '@nestjs/common';
import { InventoryResultService } from '../../inventory-result.service';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';

const RESULT_AR: Record<string, string> = {
  matched: 'مطابق',
  deficit: 'عجز',
  surplus: 'زيادة',
  transferred: 'منقول',
  missing: 'مفقود',
  not_inventoried: 'غير مُجرّد',
};

const STATUS_AR: Record<string, string> = {
  'New': 'جديد',
  'Good': 'جيد',
  'Used': 'مستخدم',
  'Needs Maintenance': 'يحتاج صيانة',
};

/** Names used inside a saved condition-detail line ("تفصيل الحالة: New:2 | ...")
 *  written by the mobile app into the notes field. Export-only display map. */
const CONDITION_AR: Record<string, string> = {
  'New': 'جديد',
  'Good': 'جيد',
  'Used': 'مستخدم',
  'Needs Maintenance': 'يحتاج صيانة',
  'Damaged': 'تالف',
};

@Injectable()
export class InventoryExportProvider implements ExportProvider {
  readonly resource = 'inventory';

  constructor(private readonly results: InventoryResultService) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    // Use the most recent cycle for inventory results (options may specify cycle_id)
    const cycleId = (options?.filters as { cycle_id?: string } | undefined)?.cycle_id;
    const rows = cycleId
      ? await this.results.getResults(cycleId, tenantId)
      : await this.results.getResultsForLatest(tenantId);
    // Export-only presentation: map known status/result values to Arabic while
    // leaving internal DB names untouched (they are used as lookup keys).
    return { rows: rows.map((row) => this.translateRow(row as unknown as Record<string, unknown>)), total: rows.length };
  }

  private translateRow(row: Record<string, unknown>): Record<string, unknown> {
    const out = { ...row };
    if (typeof out.expected_status_name === 'string' && STATUS_AR[out.expected_status_name]) {
      out.expected_status_name = STATUS_AR[out.expected_status_name];
    }
    if (typeof out.actual_status_name === 'string' && STATUS_AR[out.actual_status_name]) {
      out.actual_status_name = STATUS_AR[out.actual_status_name];
    }
    if (typeof out.result === 'string' && RESULT_AR[out.result]) {
      out.result = RESULT_AR[out.result];
    }
    if (typeof out.notes === 'string') {
      out.notes = this.translateConditionNotes(out.notes);
    }
    return out;
  }

  /** Export-only: translate known status names inside a saved condition-detail
   *  line (e.g. "تفصيل الحالة: New:2 | Needs Maintenance:1") so the exported
   *  file reads in Arabic. DB data is never modified. Unknown names pass through. */
  private translateConditionNotes(notes: string): string {
    const match = notes.match(/تفصيل الحالة:\s*([^\n]*)/);
    if (!match) return notes;
    const translated = match[1]
      .split('|')
      .map((part) => {
        const trimmed = part.trim();
        const colon = trimmed.indexOf(':');
        if (colon < 0) return trimmed;
        const name = trimmed.slice(0, colon).trim();
        const qty = trimmed.slice(colon + 1).trim();
        const ar = CONDITION_AR[name];
        return ar ? `${ar}:${qty}` : trimmed;
      })
      .join(' | ');
    return notes.replace(match[0], `تفصيل الحالة: ${translated}`);
  }
}

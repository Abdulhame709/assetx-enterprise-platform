/**
 * Export port — the ExportService contract.
 * Always returns a Readable stream (never Buffer/string/Uint8Array) so the
 * contract is stable regardless of file type (architecture note 9).
 * Reference: Phase 11.3
 */
import { ExportRequest, ExportResult } from '../entities/export.entity';

export interface ExportPort {
  /** Generate and return a file stream for an export request. */
  generate(req: ExportRequest): Promise<ExportResult>;
}

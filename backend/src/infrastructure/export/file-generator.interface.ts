/**
 * FileGenerator — abstraction over file format generators.
 * Each generator (CSV/Excel/PDF) implements this; the factory picks the right one.
 * The contract returns a Readable stream (generators may buffer internally but
 * must expose a stream). No format-specific logic leaks to the Application layer.
 * Reference: Phase 11.3 (architecture note 3, 9)
 */
import { Readable } from 'stream';
import { ExportFormat, ExportOptions } from '../../core/entities/export.entity';

export interface FileGenerator {
  readonly format: ExportFormat;
  generate(data: unknown[], options?: ExportOptions): Readable;
  getMimeType(): string;
  getFileExtension(): string;
}

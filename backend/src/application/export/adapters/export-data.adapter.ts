/**
 * ExportDataAdapter — converts raw provider data into export row models.
 * Located in the Application layer (converts domain models only), not
 * Infrastructure. It does NOT modify data; it maps to uniform row objects.
 * Reference: Phase 11.3 (architecture note 2)
 */
import { Injectable } from '@nestjs/common';

export interface ExportRow {
  [key: string]: unknown;
}

@Injectable()
export class ExportDataAdapter {
  /** Normalize arbitrary records into uniform ExportRow objects. */
  toRows(data: unknown[]): ExportRow[] {
    return data.map((item) => {
      if (item && typeof item === 'object') {
        return { ...(item as Record<string, unknown>) };
      }
      return { value: item };
    });
  }
}

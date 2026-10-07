/**
 * ExportProfileRegistry — built-in audience profiles (Task T8).
 * Each profile is configuration only (columns + preferred format + page size).
 * The pipeline intersects a profile's columns with the actual row keys, so the
 * same profile is safe across resources (assets/movements/inventory/audit/…).
 * Reference: Task T8 — Enterprise Export Framework.
 */
import { Injectable } from '@nestjs/common';
import { ExportProfile, ExportProfileId } from '../../core/entities/export-profile.entity';
import { ExportColumn, ExportOptions } from '../../core/entities/export.entity';

@Injectable()
export class ExportProfileRegistry {
  private readonly profiles: Record<ExportProfileId, ExportProfile>;

  constructor() {
    this.profiles = {
      executive: {
        id: 'executive',
        name: 'Executive',
        description: 'High-level summary view for leadership.',
        preferredFormat: 'pdf',
        pageSize: 1000,
        columns: [
          { key: 'name', label: 'Asset', order: 1 },
          { key: 'full_asset_code', label: 'Asset Code', order: 2 },
          { key: 'quantity', label: 'Qty', order: 3 },
          { key: 'purchase_price', label: 'Value', order: 4 },
          { key: 'is_active', label: 'Active', order: 5 },
        ],
      },
      finance: {
        id: 'finance',
        name: 'Finance',
        description: 'Valuation and depreciation focus for finance.',
        preferredFormat: 'xlsx',
        pageSize: 2000,
        columns: [
          { key: 'name', label: 'Asset', order: 1 },
          { key: 'full_asset_code', label: 'Asset Code', order: 2 },
          { key: 'purchase_price', label: 'Purchase Price', order: 3 },
          { key: 'purchase_date', label: 'Purchase Date', order: 4 },
          { key: 'depreciation_rate', label: 'Depreciation Rate', order: 5 },
          { key: 'useful_life', label: 'Useful Life', order: 6 },
        ],
      },
      auditor: {
        id: 'auditor',
        name: 'Auditor',
        description: 'Full audit-oriented column set with status and ownership.',
        preferredFormat: 'xlsx',
        pageSize: 2000,
        columns: [
          { key: 'full_asset_code', label: 'Asset Code', order: 1 },
          { key: 'name', label: 'Asset', order: 2 },
          { key: 'base_asset_code', label: 'Base Code', order: 3 },
          { key: 'status_id', label: 'Status', order: 4 },
          { key: 'location_id', label: 'Location', order: 5 },
          { key: 'employee_id', label: 'Custodian', order: 6 },
          { key: 'serial_number', label: 'Serial No', order: 7 },
          { key: 'barcode', label: 'Barcode', order: 8 },
        ],
      },
      inventory: {
        id: 'inventory',
        name: 'Inventory',
        description: 'Physical-count oriented columns.',
        preferredFormat: 'csv',
        pageSize: 5000,
        columns: [
          { key: 'asset_code', label: 'Asset Code', order: 1 },
          { key: 'asset_name', label: 'Asset', order: 2 },
          { key: 'expected_quantity', label: 'Expected Qty', order: 3 },
          { key: 'actual_quantity', label: 'Actual Qty', order: 4 },
          { key: 'expected_location_path', label: 'Expected Location', order: 5 },
          { key: 'actual_location_path', label: 'Actual Location', order: 6 },
          { key: 'expected_employee_name', label: 'Expected Custodian', order: 7 },
          { key: 'actual_employee_name', label: 'Actual Custodian', order: 8 },
          { key: 'expected_status_name', label: 'Expected Status', order: 9 },
          { key: 'actual_status_name', label: 'Actual Status', order: 10 },
          { key: 'result', label: 'Result', order: 11 },
          { key: 'notes', label: 'Notes', order: 12 },
        ],
      },
      compliance: {
        id: 'compliance',
        name: 'Compliance',
        description: 'Compliance-relevant fields (barcode, ownership, status).',
        preferredFormat: 'pdf',
        pageSize: 1000,
        columns: [
          { key: 'full_asset_code', label: 'Asset Code', order: 1 },
          { key: 'name', label: 'Asset', order: 2 },
          { key: 'barcode', label: 'Barcode', order: 3 },
          { key: 'status_id', label: 'Status', order: 4 },
          { key: 'employee_id', label: 'Custodian', order: 5 },
          { key: 'location_id', label: 'Location', order: 6 },
        ],
      },
    };
  }

  /** Resolve a profile by id (undefined for a null/unknown id). */
  get(id?: ExportProfileId): ExportProfile | undefined {
    return id ? this.profiles[id] : undefined;
  }

  list(): ExportProfile[] {
    return Object.values(this.profiles);
  }

  /**
   * Apply a profile to export options: merges the profile's ordered columns into
   * options.columns (caller-specified columns win) and fills defaults. Returns
   * the effective options (new object; input not mutated).
   */
  apply(options: ExportOptions, profile?: ExportProfile): ExportOptions {
    if (!profile) return { ...options };
    const merged: ExportColumn[] = profile.columns.map((c) => ({
      key: c.key,
      label: c.label,
      order: c.order,
    }));
    // Caller-specified columns take precedence. When the caller (the web
    // report designer) supplies a column that already exists in the profile,
    // the caller's display label and order win — so translated column names
    // (Arabic/English per UI language) are never overwritten by the profile.
    for (const c of options.columns ?? []) {
      const existing = merged.find((m) => m.key === c.key);
      if (existing) {
        if (c.label) existing.label = c.label;
        if (c.order !== undefined) existing.order = c.order;
      } else {
        merged.push({ key: c.key, label: c.label, order: c.order });
      }
    }
    return {
      ...options,
      columns: merged,
      profile: profile.id,
      pageSize: options.pageSize ?? profile.pageSize,
    };
  }
}

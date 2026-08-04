/**
 * ReportTemplateService — validates templates, provides the default template,
 * and merges custom template over a default (style inheritance).
 * Presentation-only; no business logic. Reference: Task T6
 */
import { Injectable } from '@nestjs/common';
import { ReportTemplate } from '../core/entities/report-template.entity';

export const DEFAULT_REPORT_TEMPLATE: ReportTemplate = {
  id: 'default',
  name: 'Default',
  typography: { fontFamily: 'Helvetica', titleSize: 18, bodySize: 9, tableSize: 8, footerSize: 8 },
  colors: {
    primary: '#1f2937', secondary: '#6b7280', headerBg: '#2563eb', headerFg: '#ffffff',
    rowEven: '#f3f4f6', rowOdd: '#ffffff', title: '#1f2937', subtitle: '#6b7280',
  },
  page: { orientation: 'portrait', size: 'A4', margins: { top: 40, right: 40, bottom: 40, left: 40 } },
  table: { headerStyle: { bold: true, color: '#ffffff' }, alternatingRowColors: true, rowHeight: 16 },
  header: { showGeneratedAt: true, userPlaceholder: false, organizationPlaceholder: false },
  footer: { showPageNumbers: false },
  sections: [
    { type: 'header', order: 1 },
    { type: 'body', order: 2 },
    { type: 'footer', order: 3 },
  ],
};

@Injectable()
export class ReportTemplateService {
  /** Validate a template (presentation-only). Throws on invalid. */
  validate(template: ReportTemplate): void {
    if (!template || !template.id || !template.name) throw new Error('INVALID_TEMPLATE');
    const orientation = template.page?.orientation;
    if (orientation && orientation !== 'portrait' && orientation !== 'landscape') throw new Error('INVALID_TEMPLATE_ORIENTATION');
    const size = template.page?.size;
    if (size && !['A4', 'A3', 'LETTER', 'LEGAL'].includes(size)) throw new Error('INVALID_TEMPLATE_PAGE_SIZE');
    // section ordering must be unique and sequential (1..n)
    const orders = (template.sections ?? []).map((s) => s.order);
    if (orders.length !== new Set(orders).size) throw new Error('INVALID_TEMPLATE_SECTION_ORDER');
    for (const o of orders) {
      if (!Number.isInteger(o) || o < 1) throw new Error('INVALID_TEMPLATE_SECTION_ORDER');
    }
  }

  /** Merge a custom template over the default (style inheritance). */
  merge(base: ReportTemplate, custom?: ReportTemplate): ReportTemplate {
    if (!custom) return base;
    return {
      ...base,
      ...custom,
      typography: { ...base.typography, ...custom.typography },
      colors: { ...base.colors, ...custom.colors },
      page: { ...base.page, ...custom.page, margins: { ...base.page?.margins, ...custom.page?.margins } },
      table: {
        ...base.table,
        ...custom.table,
        headerStyle: { ...base.table?.headerStyle, ...custom.table?.headerStyle },
        cellStyle: { ...base.table?.cellStyle, ...custom.table?.cellStyle },
      },
      header: { ...base.header, ...custom.header },
      footer: { ...base.footer, ...custom.footer },
    };
  }

  /** Resolve the effective template (default or custom merged over default). */
  resolve(custom?: ReportTemplate): ReportTemplate {
    return this.merge(DEFAULT_REPORT_TEMPLATE, custom);
  }
}

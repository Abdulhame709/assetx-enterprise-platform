/**
 * Integration tests — Report Templates (Task T6).
 * Validation, default template, custom template, style inheritance, orientation,
 * header/footer rendering, multi-page. Real PostgreSQL (PGlite).
 * Reference: Task T6 approved scope
 */
import { createHarness, Harness } from './support/db.harness';
import { PdfGenerator } from '../src/infrastructure/export/pdf.generator';
import { ReportTemplate } from '../src/core/entities/report-template.entity';
import { DEFAULT_REPORT_TEMPLATE } from '../src/application/report-template.service';

describe('Report Templates — integration (Task T6)', () => {
  let h: Harness;

  beforeAll(async () => { h = await createHarness(); });

  function collect(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = ''; stream.on('data', (c) => (data += c.toString())); stream.on('end', () => resolve(data)); stream.on('error', reject);
    });
  }

  it('validates a template (invalid orientation throws)', () => {
    const bad = { ...DEFAULT_REPORT_TEMPLATE, id: 'x', name: 'X', page: { orientation: 'weird' as never } };
    expect(() => h.reportTemplates.validate(bad)).toThrow('INVALID_TEMPLATE_ORIENTATION');
  });

  it('provides a default template', () => {
    const t = h.reportTemplates.resolve();
    expect(t.id).toBe('default');
    expect(t.page?.size).toBe('A4');
    expect(t.sections?.length).toBeGreaterThan(0);
  });

  it('merges a custom template over default (style inheritance)', () => {
    const custom: ReportTemplate = {
      id: 'c1', name: 'Custom',
      colors: { headerBg: '#ff0000' },
      page: { orientation: 'landscape', size: 'LETTER' },
    };
    const merged = h.reportTemplates.merge(DEFAULT_REPORT_TEMPLATE, custom);
    expect(merged.colors?.headerBg).toBe('#ff0000');      // custom
    expect(merged.colors?.title).toBe(DEFAULT_REPORT_TEMPLATE.colors?.title); // inherited
    expect(merged.page?.orientation).toBe('landscape');
    expect(merged.page?.size).toBe('LETTER');
  });

  it('renders a landscape PDF with a custom template via PdfGenerator', async () => {
    const custom: ReportTemplate = {
      id: 'c2', name: 'Landscape',
      page: { orientation: 'landscape', size: 'LETTER' },
      header: { title: 'Custom Report', showGeneratedAt: true },
      footer: { text: 'Confidential' },
    };
    const gen = new PdfGenerator();
    const rows = Array.from({ length: 30 }, (_, i) => ({ name: `R${i}`, value: i }));
    const stream = gen.generate(rows, { includeHeaders: true, template: custom });
    const buf = Buffer.from(await collect(stream), 'binary');
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    // landscape LETTER media box: width(792) > height(612)
    const latin = buf.toString('latin1');
    expect(latin).toMatch(/\/MediaBox\s*\[\s*0 0 792 612/);
  });

  it('multi-page rendering still works with a custom template', async () => {
    const custom: ReportTemplate = { id: 'c3', name: 'Multi', table: { rowHeight: 16, alternatingRowColors: true } };
    const gen = new PdfGenerator();
    const rows = Array.from({ length: 90 }, (_, i) => ({ name: `R${i}`, value: i }));
    const buf = Buffer.from(await collect(gen.generate(rows, { template: custom })), 'binary');
    const pages = buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBeGreaterThan(1);
  });
});

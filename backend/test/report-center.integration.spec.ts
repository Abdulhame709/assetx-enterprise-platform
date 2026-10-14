/**
 * Integration tests — report center: filters (location / type / status / employee),
 * sorting, "no employee" handling, the location / type / duplicates / field-form
 * reports, and the Report Designer settings. Real PostgreSQL (PGlite).
 */
import { createHarness, Harness } from './support/db.harness';
import { SettingsService } from '../src/application/settings.service';
import { ReportMetaService } from '../src/application/export/report-meta.service';
import { ExportResource } from '../src/core/entities/export.entity';
import { normalizeText } from '../src/application/export/providers/duplicates-export.provider';
import { isGroupRow } from '../src/core/constants/report-groups';
import { isPlaceholderEmployee } from '../src/core/constants/placeholder-employee';

type Row = Record<string, unknown>;

describe('Report center — integration', () => {
  let h: Harness;
  let settings: SettingsService;
  let meta: ReportMetaService;
  let mainA: string;
  let subA1: string;
  let mainB: string;
  let emp: string;
  let placeholder: string;
  let typeB: string;

  const preview = async (resource: ExportResource, filters: Row = {}, lang = 'ar') => {
    const { rows } = await h.exportService.preview({
      tenant_id: h.tenantA, resource, options: { limit: 10000, filters, meta: { lang } as never },
    });
    return rows as Row[];
  };

  beforeAll(async () => {
    h = await createHarness();
    settings = new SettingsService(h.db);
    meta = new ReportMetaService(settings, h.db);
    mainA = (await h.locations.create({ tenant_id: h.tenantA, name: 'RC Main A', location_type: 'building' })).id;
    subA1 = (await h.locations.create({ tenant_id: h.tenantA, name: 'RC Sub A1', location_type: 'room', parent_id: mainA })).id;
    mainB = (await h.locations.create({ tenant_id: h.tenantA, name: 'RC Main B', location_type: 'building' })).id;
    emp = (await h.employees.create({ tenant_id: h.tenantA, name: 'RC Employee' })).id;
    placeholder = (await h.employees.create({ tenant_id: h.tenantA, name: 'غير مرتبط بموظف' })).id;
    typeB = (await h.categories.create({ tenant_id: h.tenantA, name: 'RC Type B' })).id;

    const make = (name: string, extra: Row) => h.assets.create({
      tenant_id: h.tenantA, name, category_id: h.refA.category, location_id: mainA, status_id: h.refA.status, ...extra,
    } as never);
    await make('RC Zeta', { location_id: mainA, employee_id: emp, purchase_price: 100 });
    await make('RC Alpha', { location_id: subA1, purchase_price: 50 });
    await make('RC Mid', { location_id: mainB, category_id: typeB, employee_id: placeholder, purchase_price: 10 });
    await make('RC Dup One', { location_id: mainB, serial_number: 'DUP-SERIAL-1' });
    await make('RC Dup Two', { location_id: mainB, serial_number: 'dup-serial-1' });
  });

  describe('assets report filters', () => {
    it('main location includes its sub-locations; sub location only itself', async () => {
      const main = (await preview('assets', { location_id: mainA })).map((r) => r.name);
      expect(main).toEqual(expect.arrayContaining(['RC Zeta', 'RC Alpha']));
      expect(main).not.toContain('RC Mid');
      const sub = (await preview('assets', { location_id: subA1 })).map((r) => r.name);
      expect(sub).toEqual(['RC Alpha']);
    });

    it('filters by asset type and by free-text name', async () => {
      expect((await preview('assets', { category_id: typeB })).map((r) => r.name)).toEqual(['RC Mid']);
      expect((await preview('assets', { q: 'Zeta' })).map((r) => r.name)).toEqual(['RC Zeta']);
    });

    it('filters by employee and by "no employee" (placeholder employees count as none)', async () => {
      expect((await preview('assets', { employee_id: emp })).map((r) => r.name)).toEqual(['RC Zeta']);
      const none = (await preview('assets', { no_employee: true })).map((r) => r.name);
      expect(none).toEqual(expect.arrayContaining(['RC Alpha', 'RC Mid']));
      expect(none).not.toContain('RC Zeta');
    });

    it('never prints the placeholder employee phrase', async () => {
      const mid = (await preview('assets', { q: 'RC Mid' }))[0];
      expect(mid.employee_name).toBe('');
      expect(isPlaceholderEmployee('غير مرتبط بموظف')).toBe(true);
      expect(isPlaceholderEmployee('Ahmed Ali')).toBe(false);
    });

    it('sorts by name and by price, in both directions', async () => {
      const names = (rows: Row[]) => rows.filter((r) => String(r.name).startsWith('RC ')).map((r) => r.name);
      expect(names(await preview('assets', { sort_by: 'name' })).slice(0, 3)).toEqual(['RC Alpha', 'RC Dup One', 'RC Dup Two']);
      expect(names(await preview('assets', { sort_by: 'name', sort_dir: 'desc' }))[0]).toBe('RC Zeta');
      expect(names(await preview('assets', { sort_by: 'price', sort_dir: 'desc' }))[0]).toBe('RC Zeta');
    });
  });

  describe('location / type / duplicate reports', () => {
    it('asset-locations: main only, sub only, with counts', async () => {
      const main = await preview('asset-locations', { location_scope: 'main' });
      const mainRow = main.find((r) => String(r.location_name).includes('RC Main A'))!;
      expect(mainRow.parent_name ?? '').toBe('');
      expect(Number(mainRow.direct_count)).toBe(1);
      expect(Number(mainRow.total_count)).toBe(2);
      expect(main.some((r) => String(r.location_name).includes('RC Sub A1'))).toBe(false);
      const sub = await preview('asset-locations', { location_scope: 'sub' });
      expect(sub.map((r) => String(r.location_name))).toEqual(expect.arrayContaining([expect.stringContaining('RC Sub A1')]));
      expect(sub.every((r) => String(r.parent_name ?? '') !== '')).toBe(true);
    });

    it('asset-types: counts per type', async () => {
      const rows = await preview('asset-types');
      const b = rows.find((r) => r.category_name === 'RC Type B')!;
      expect(Number(b.assets_count)).toBe(1);
      expect(Number(b.total_value)).toBe(10);
    });

    it('duplicates: groups assets sharing a serial number regardless of case', async () => {
      const rows = await preview('duplicates');
      const dups = rows.filter((r) => String(r.name).startsWith('RC Dup'));
      expect(dups).toHaveLength(2);
      expect(new Set(dups.map((r) => r.group_no)).size).toBe(1);
      expect(String(dups[0].reason)).toContain('الرقم التسلسلي');
      expect(rows.some((r) => r.name === 'RC Zeta')).toBe(false);
      const en = (await preview('duplicates', {}, 'en')).find((r) => String(r.name).startsWith('RC Dup'))!;
      expect(en.reason).toBe('Same serial number');
    });

    it('normalizes Arabic spelling variants when comparing names', () => {
      expect(normalizeText('  أجهزة  الحاسوب ')).toBe(normalizeText('اجهزه الحاسوب'));
    });
  });

  describe('field inventory form', () => {
    it('blank rows: numbered empty lines', async () => {
      const rows = await preview('inventory-form', { blank_rows: 12 });
      expect(rows).toHaveLength(12);
      expect(rows[0].row_no).toBe(1);
      expect(rows[11].row_no).toBe(12);
      expect(rows[0].name).toBe('');
    });

    it('caps blank rows', async () => {
      const { rows } = await h.exportService.preview({
        tenant_id: h.tenantA, resource: 'inventory-form', options: { limit: 10000, filters: { blank_rows: 100000 } },
      }, 1000);
      expect(rows.length).toBe(500);
    });

    it('with assets: expected quantity filled, count columns empty, sorted by location', async () => {
      const rows = await preview('inventory-form', { location_id: mainA });
      expect(rows.length).toBe(2);
      expect(rows[0].actual_quantity).toBe('');
      expect(Number(rows[0].expected_quantity)).toBeGreaterThan(0);
    });
  });

  describe('report meta', () => {
    it('describes filters with names, never raw ids', async () => {
      const built = await meta.build({
        tenantId: h.tenantA, userName: 'u', resource: 'assets', lang: 'ar',
        filters: { location_id: mainA, employee_id: emp, sort_by: 'name' },
      });
      expect(built.filtersText).toContain('RC Main A');
      expect(built.filtersText).toContain('RC Employee');
      expect(built.filtersText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    });

    it('form: landscape, no totals, formMode', async () => {
      const built = await meta.build({ tenantId: h.tenantA, userName: 'u', resource: 'inventory-form', lang: 'ar' });
      expect(built.formMode).toBe(true);
      expect(built.showTotals).toBe(false);
      expect(built.orientation).not.toBe('portrait');
    });
  });


  describe('location hierarchy and "nothing chosen = all"', () => {
    const run = async (filters: Row = {}, extra: Row = {}) => {
      const result = await h.exportService.preview({
        tenant_id: h.tenantA, resource: 'assets',
        options: { limit: 10000, filters: { ...filters, ...extra }, meta: { lang: 'ar' } as never },
      });
      return result.rows as Row[];
    };
    const bands = (rows: Row[]) => rows.filter((r) => isGroupRow(r)).map((r) => `${r.__level}:${r.__group}:${r.__count}`);

    it('sorting by location with nothing else chosen returns every asset', async () => {
      const all = await preview('assets');
      const sorted = await preview('assets', { sort_by: 'location' });
      expect(sorted.length).toBe(all.length);
      expect(sorted.length).toBeGreaterThan(0);
    });

    it('sorting by employee with nothing else chosen returns every asset', async () => {
      const all = await preview('assets');
      const sorted = await preview('assets', { sort_by: 'employee' });
      expect(sorted.length).toBe(all.length);
    });

    it('group_by=location without a location filter groups every asset under its location', async () => {
      const rows = await run({ group_by: 'location' });
      const details = rows.filter((r) => !isGroupRow(r));
      expect(details.length).toBe((await preview('assets')).length);
      expect(bands(rows)).toEqual(expect.arrayContaining(['0:RC Main A:2', '1:RC Sub A1:1', '0:RC Main B:3']));
    });

    it('a main location prints as parent band, then sub-location band, then its assets', async () => {
      const rows = await run({ group_by: 'location', location_id: mainA });
      const shape = rows.map((r) => (isGroupRow(r) ? `[${r.__group}]` : String(r.name)));
      expect(shape).toEqual(['[RC Main A]', 'RC Zeta', '[RC Sub A1]', 'RC Alpha']);
    });

    it('a sub location prints only its own band', async () => {
      const rows = await run({ group_by: 'location', location_id: subA1 });
      expect(bands(rows)).toEqual(['0:RC Main A:1', '1:RC Sub A1:1']);
    });

    it('group_by=location keeps the sort inside each location', async () => {
      const rows = await run({ group_by: 'location', location_id: mainB, sort_by: 'name' });
      const names = rows.filter((r) => !isGroupRow(r)).map((r) => r.name);
      expect(names).toEqual(['RC Dup One', 'RC Dup Two', 'RC Mid']);
    });

    it('the CSV file carries the same bands', async () => {
      const built = await meta.build({ tenantId: h.tenantA, userName: 'u', resource: 'assets', lang: 'en', filters: { location_id: mainA, group_by: 'location' } });
      expect(built.filtersText).toContain('Grouped by location');
      const result = await h.exportService.generate({
        tenant_id: h.tenantA, userId: 'u', resource: 'assets', format: 'csv',
        options: {
          limit: 100, includeHeaders: true, meta: built,
          columns: [{ key: 'name', order: 0 }, { key: 'location_name', order: 1 }],
          filters: { location_id: mainA, group_by: 'location', __report: { columns: ['name', 'location_name'] } },
        },
      });
      let text = '';
      for await (const chunk of result.stream as AsyncIterable<Buffer>) text += chunk.toString();
      const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
      expect(lines.slice(1)).toEqual(['RC Main A (2)', 'RC Zeta', '  RC Sub A1 (1)', 'RC Alpha']);
    });
  });

  describe('Report Designer settings', () => {
    it('has sensible defaults and a catalog', async () => {
      const view = await settings.getDesignerView(h.tenantA);
      expect(view.rows_per_page).toBe(0);
      expect(view.show_totals).toBe(true);
      expect(view.row_numbers).toBe(false);
      expect(view.catalog.assets?.columns).toContain('name');
      expect(view.labels.name).toBeDefined();
    });

    it('saves rows per page, totals, numbering and columns, and reports use them', async () => {
      await settings.updateDesigner(h.tenantA, {
        rows_per_page: 25, show_totals: false, row_numbers: true, columns: { assets: ['name', 'status_name'] },
      });
      const built = await meta.build({ tenantId: h.tenantA, userName: 'u', resource: 'assets', lang: 'ar' });
      expect(built.rowsPerPage).toBe(25);
      expect(built.showTotals).toBe(false);
      expect(built.rowNumbers).toBe(true);
      expect((await meta.defaultColumns(h.tenantA, 'assets'))?.map((c) => c.key)).toEqual(['name', 'status_name']);
    });

    it('numbers rows in the exported file', async () => {
      const columns = (await meta.defaultColumns(h.tenantA, 'assets'))!;
      const built = await meta.build({ tenantId: h.tenantA, userName: 'u', resource: 'assets', lang: 'en' });
      const result = await h.exportService.generate({
        tenant_id: h.tenantA, userId: 'u', resource: 'assets', format: 'csv',
        options: { limit: 10, includeHeaders: true, meta: built, columns },
      });
      let text = '';
      for await (const chunk of result.stream as AsyncIterable<Buffer>) text += chunk.toString();
      const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
      expect(lines[0].split(',')[0]).toBe('#');
      expect(lines[1].split(',')[0]).toBe('1');
      expect(lines[0]).toContain('Asset');
      expect(lines[0]).not.toContain('Barcode');
    });

    it('an empty column list resets a report to its defaults', async () => {
      await settings.updateDesigner(h.tenantA, { columns: { assets: [] } });
      const keys = (await meta.defaultColumns(h.tenantA, 'assets'))!.map((c) => c.key);
      expect(keys.length).toBeGreaterThan(2);
    });

    it('rejects invalid values', async () => {
      await expect(settings.updateDesigner(h.tenantA, { rows_per_page: 3 })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { rows_per_page: 1000 })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { rows_per_page: 'x' })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { show_totals: 'yes' })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { columns: { assets: ['nope'] } })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { columns: { assets: ['name', 'name'] } })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { columns: { dashboard: ['name'] } })).rejects.toThrow('SETTING_VALUE_INVALID');
    });

    it('saves column widths per report and hands them to the report header', async () => {
      await settings.updateDesigner(h.tenantA, { widths: { assets: { name: 30, status_name: 10 } } });
      expect((await settings.getDesigner(h.tenantA)).widths.assets).toEqual({ name: 30, status_name: 10 });
      const built = await meta.build({ tenantId: h.tenantA, userName: 'u', resource: 'assets', lang: 'ar' });
      expect(built.columnWidths).toEqual({ name: 30, status_name: 10 });
      const other = await meta.build({ tenantId: h.tenantA, userName: 'u', resource: 'movements', lang: 'ar' });
      expect(other.columnWidths).toBeUndefined();
    });

    it('an empty width map resets a report to automatic widths', async () => {
      await settings.updateDesigner(h.tenantA, { widths: { assets: {} } });
      expect((await settings.getDesigner(h.tenantA)).widths.assets).toBeUndefined();
      const built = await meta.build({ tenantId: h.tenantA, userName: 'u', resource: 'assets', lang: 'ar' });
      expect(built.columnWidths).toBeUndefined();
    });

    it('rejects widths out of range, for unknown columns or unknown reports', async () => {
      await expect(settings.updateDesigner(h.tenantA, { widths: { assets: { name: 2 } } })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { widths: { assets: { name: 61 } } })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { widths: { assets: { name: 'wide' } } })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { widths: { assets: { nope: 20 } } })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { widths: { dashboard: { name: 20 } } })).rejects.toThrow('SETTING_VALUE_INVALID');
      await expect(settings.updateDesigner(h.tenantA, { widths: [] })).rejects.toThrow('SETTING_VALUE_INVALID');
    });

    it('keeps designer settings separate per tenant', async () => {
      await settings.updateDesigner(h.tenantA, { rows_per_page: 40 });
      expect((await settings.getDesigner(h.tenantB)).rows_per_page).toBe(0);
    });
  });
});

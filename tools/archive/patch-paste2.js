// AssetX fix 2: inventory report exports latest-cycle ROWS (with status names) instead of summary. Run: node patch-paste2.js
const fs = require('fs');
const path = require('path');
function root() {
  for (const c of [__dirname, path.join(__dirname, '..'), path.join(__dirname, 'tools')]) {
    if (fs.existsSync(path.join(c, 'web', 'package.json')) && fs.existsSync(path.join(c, 'backend', 'package.json'))) return c;
  }
  return null;
}
function rd(p) { return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); }
function patch(r, rel, oldS, newS, lbl) {
  const p = path.join(r, rel);
  if (!fs.existsSync(p)) { console.log('MISS ' + lbl + ' (missing file)'); return false; }
  let t = rd(p);
  if (t.includes(newS)) { console.log('ALREADY ' + lbl); return true; }
  if (!t.includes(oldS)) { console.log('MISS ' + lbl + ' (anchor not found)'); return false; }
  const bak = p + '.bak-syncfix2';
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, t, 'utf8');
  fs.writeFileSync(p, t.split(oldS).join(newS), 'utf8');
  console.log('OK ' + lbl);
  return true;
}
const R = root();
if (!R) { console.log('ERROR: project root not found (web/ + backend/ must be nearby)'); process.exit(2); }
console.log('ROOT: ' + R);
let ok = 0;
if (patch(R, 'backend/src/application/inventory-result.service.ts',
  '  /** Summary for the most recent cycle, or null if none exists. */\n  async getSummaryForLatest(tenantId: string): Promise<InventorySummary | null> {\n    await this.db.setTenant(tenantId);\n    const cycles = await this.cycles.list(tenantId);\n    if (cycles.length === 0) return null;\n    // list is ordered by year DESC (latest first)\n    const latest = cycles[0];\n    return this.getSummary(latest.id, tenantId);\n  }',
  '  /** Summary for the most recent cycle, or null if none exists. */\n  async getSummaryForLatest(tenantId: string): Promise<InventorySummary | null> {\n    await this.db.setTenant(tenantId);\n    const cycles = await this.cycles.list(tenantId);\n    if (cycles.length === 0) return null;\n    // list is ordered by year DESC (latest first)\n    const latest = cycles[0];\n    return this.getSummary(latest.id, tenantId);\n  }\n\n  /** Per-record computed results for the most recent cycle, or [] if none exists. */\n  async getResultsForLatest(tenantId: string): Promise<InventoryRecordResult[]> {\n    await this.db.setTenant(tenantId);\n    const cycles = await this.cycles.list(tenantId);\n    if (cycles.length === 0) return [];\n    // list is ordered by year DESC (latest first)\n    return this.results.getResults(cycles[0].id, tenantId);\n  }',
  '1/2 latest-cycle rows service')) ok++;
if (patch(R, 'backend/src/application/export/providers/inventory-export.provider.ts',
  '    const cycleId = (options?.filters as { cycle_id?: string } | undefined)?.cycle_id;\n    if (!cycleId) {\n      // find latest cycle id via results repo is not exposed here; for now export from\n      // inventory analytics (aggregate) if no cycle given.\n      const summary = await this.results.getSummaryForLatest(tenantId);\n      return { rows: summary ? [summary] : [], total: summary ? 1 : 0 };\n    }\n    const rows = await this.results.getResults(cycleId, tenantId);\n    return { rows, total: rows.length };',
  '    const cycleId = (options?.filters as { cycle_id?: string } | undefined)?.cycle_id;\n    const rows = cycleId\n      ? await this.results.getResults(cycleId, tenantId)\n      : await this.results.getResultsForLatest(tenantId);\n    return { rows, total: rows.length };',
  '2/2 export provider rows')) ok++;
console.log(ok === 2 ? 'SUCCESS: report export now emits inventory rows. Restart the 3 windows (StartX.bat).' : 'PARTIAL: applied ' + ok + '/2 - send this output.');

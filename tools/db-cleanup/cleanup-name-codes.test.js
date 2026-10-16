// Run with:  node --test tools/db-cleanup/
const test = require('node:test');
const assert = require('node:assert');
const { planCleanup, fold, cleanName, generateFullCode } = require('./cleanup-name-codes.js');

let seq = 0;
const row = (over) => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
  name: 'كراسي', base_asset_code: '2026-0001', full_asset_code: `2026-0001@x-${seq}`, notes: null, quantity: 1,
  is_active: true, created_at: new Date(2026, 0, seq), location_id: 'L1', location_path: 'مبنى', category_id: 'C1',
  sub_type_id: null, model_id: null, status_id: 'S1', employee_id: null, purchase_price: 0, serial_number: null, barcode: null,
  ...over,
});
const plan = (rows, refs = []) => planCleanup(rows, rows.map((r) => r.full_asset_code), new Set(refs));

test('same folded name adopts the oldest base code; differing records stay separate', () => {
  const a = row({ name: 'كراسي أبو يدين', base_asset_code: '2026-0052', location_id: 'L1' });
  const b = row({ name: 'كراسي ابو  يدين', base_asset_code: '2026-0071', location_id: 'L2', location_path: 'مبنى 2' });
  const { changes, stats } = plan([a, b]);
  assert.equal(stats.multiCode, 1);
  assert.equal(stats.merged, 0);
  assert.equal(changes.get(b.id).after.base_asset_code, '2026-0052');
  assert.ok(changes.get(b.id).after.full_asset_code.startsWith('2026-0052@'));
  assert.equal(changes.has(a.id), false);
});

test('legacy code leaves the name and is kept in notes; identical twin is merged with summed quantity', () => {
  const twin = row({ name: 'كاميرا مراقبة', base_asset_code: '2026-0025', quantity: 2 });
  const coded = row({ name: 'كاميرا مراقبة (2025-0038-13@موقع)', base_asset_code: '2026-0032', quantity: 3 });
  const { changes, stats } = plan([twin, coded]);
  assert.equal(stats.merged, 1);
  assert.equal(changes.get(twin.id).after.quantity, 5);
  assert.ok(changes.get(twin.id).after.notes.includes('2025-0038-13@موقع'));
  assert.equal(changes.get(coded.id).after.is_active, false);
  assert.equal(changes.get(coded.id).after.name, 'كاميرا مراقبة');
  assert.equal(changes.get(coded.id).after.base_asset_code, '2026-0025');
});

test('identical records with history, or differing in notes/status/holder, are never merged', () => {
  const a = row({ base_asset_code: '2026-0010' });
  const withHistory = row({ base_asset_code: '2026-0011' });
  const otherNotes = row({ base_asset_code: '2026-0012', notes: 'كسر' });
  const otherStatus = row({ base_asset_code: '2026-0013', status_id: 'S2' });
  const otherHolder = row({ base_asset_code: '2026-0014', employee_id: 'E1' });
  const { changes, stats, skipped } = plan([a, withHistory, otherNotes, otherStatus, otherHolder], [withHistory.id]);
  assert.equal(stats.merged, 0);
  assert.equal(stats.mergeSkippedHistory, 1);
  assert.equal(skipped.length, 1);
  for (const r of [a, withHistory, otherNotes, otherStatus, otherHolder]) {
    assert.equal((changes.get(r.id)?.after.is_active ?? true), true);
    assert.equal((changes.get(r.id)?.after.base_asset_code ?? r.base_asset_code), '2026-0010');
  }
});

test('full codes stay unique and never reuse an existing one', () => {
  const rows = [row({ base_asset_code: '2026-0001' }), row({ base_asset_code: '2026-0002', notes: 'a' }), row({ base_asset_code: '2026-0003', notes: 'b' })];
  const { changes } = plan(rows);
  const fulls = new Set(rows.map((r) => r.full_asset_code));
  for (const c of changes.values()) {
    if (c.after.full_asset_code !== c.before.full_asset_code) assert.equal(fulls.has(c.after.full_asset_code), false);
    fulls.add(c.after.full_asset_code);
  }
  assert.equal(generateFullCode('2026-0001', 'مبنى/غرفة 1', new Set(['2026-0001@مبنى-غرفة-1'])), '2026-0001@مبنى-غرفة-1-01');
});

test('spelling is unified only with the option, to the most frequent spelling', () => {
  const rows = [row({ name: 'سله قمامه', notes: 'a' }), row({ name: 'سله قمامه', notes: 'b' }), row({ name: 'سلة قمامة', notes: 'c' })];
  assert.equal(plan(rows).stats.spellingUnified, 0);
  const res = planCleanup(rows, rows.map((r) => r.full_asset_code), new Set(), { unifySpelling: true });
  assert.equal(res.stats.spellingUnified, 1);
  assert.equal(res.changes.get(rows[2].id).after.name, 'سله قمامه');
});

test('fold ignores spaces, hamza, ya and ta-marbuta but not the open ta', () => {
  assert.equal(fold('أبو يدين'), fold('ابو  يدين'));
  assert.equal(fold('سلة'), fold('سله'));
  assert.notEqual(fold('سيارة'), fold('سيارت'));
  assert.equal(cleanName('كرسي (2025-0038-13@x)'), 'كرسي');
});

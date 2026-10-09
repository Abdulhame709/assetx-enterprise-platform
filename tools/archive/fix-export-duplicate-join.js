#!/usr/bin/env node
/**
 * fix-export-duplicate-join.js
 * ----------------------------
 * Removes DUPLICATE join lines from the inventory export query in
 * backend/src/infrastructure/repositories/result.repository.ts.
 *
 * Background: the earlier "add columns" patch appended the join block again
 * if the file already had some of the same joins, so the SQL ended up with
 * e.g. "LEFT JOIN statuses es ..." twice -> PostgreSQL error:
 *   table name "es" specified more than once
 *
 * This script keeps exactly ONE line per join alias (the first occurrence)
 * and verifies the final query has each join once. Safe to re-run.
 * This file is ASCII-only.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function findRoot() {
  const candidates = [__dirname, path.resolve(__dirname, '..'), process.cwd(), path.resolve(process.cwd(), '..')];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'backend', 'package.json'))) return c;
  }
  return null;
}

const ROOT = findRoot();
if (!ROOT) {
  console.log('[ERROR] project folder not found. Run from inside assetx-enterprise-platform-v2.');
  process.exit(1);
}

const FILE = path.join(ROOT, 'backend', 'src', 'infrastructure', 'repositories', 'result.repository.ts');

if (!fs.existsSync(FILE)) {
  console.log('[ERROR] missing ' + FILE);
  process.exit(1);
}

const raw = fs.readFileSync(FILE, 'utf8');
const text = raw.replace(/\r\n/g, '\n');
const crlf = /\r\n/.test(raw);

// Split the file into lines and remove duplicate JOIN lines.
// A JOIN line looks like:  LEFT JOIN statuses es ON es.id = ...
// (the alias is the first word after the table name).
const JOIN_LINE = /^(\s*(?:LEFT\s+)?JOIN\s+\S+\s+([a-zA-Z_]+)\s+ON\b.*)$/;
const seen = new Set();
const removed = [];
const kept = [];

for (const line of text.split('\n')) {
  const m = line.match(JOIN_LINE);
  if (m) {
    const alias = m[2];
    if (seen.has(alias)) {
      removed.push(line.trim());
      continue; // drop the duplicate
    }
    seen.add(alias);
  }
  kept.push(line);
}

const output = kept.join('\n');

// Safety: the final query must contain each join exactly once.
const joinChecks = [
  'LEFT JOIN statuses es ON es.id = ir.expected_status_id AND es.tenant_id = ir.tenant_id',
  'LEFT JOIN statuses ast ON ast.id = ir.actual_status_id AND ast.tenant_id = ir.tenant_id',
  'LEFT JOIN locations el ON el.id = ir.expected_location_id AND el.tenant_id = ir.tenant_id',
  'LEFT JOIN locations al ON al.id = ir.actual_location_id AND al.tenant_id = ir.tenant_id',
  'LEFT JOIN employees ee ON ee.id = ir.expected_employee_id AND ee.tenant_id = ir.tenant_id',
  'LEFT JOIN employees ae ON ae.id = ir.actual_employee_id AND ae.tenant_id = ir.tenant_id',
  'JOIN assets a ON a.id = ir.asset_id AND a.tenant_id = ir.tenant_id',
  'JOIN v_inventory_result vw ON vw.id = ir.id',
];

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

const problems = [];
for (const check of joinChecks) {
  const n = countOccurrences(output, check);
  if (n !== 1) problems.push(`${check.split(' AS ')[0]} (found ${n})`);
}
const stillDuplicate = problems.length > 0;

if (removed.length === 0) {
  console.log('[OK] no duplicate JOIN lines found');
} else {
  fs.writeFileSync(FILE, crlf ? output.replace(/\n/g, '\r\n') : output, 'utf8');
  console.log('[OK] removed ' + removed.length + ' duplicate JOIN line(s):');
  for (const r of removed) console.log('      - ' + r);
}

console.log('VERIFY: ' + (stillDuplicate ? 'FAILED -> ' + problems.join(', ') : 'ALL OK'));
console.log(stillDuplicate ? 'NOT DONE - the query still has a repeated join; please send the lines above.' : 'DONE. restart needed: close the 3 windows, run StartX.bat, then export again.');
if (stillDuplicate) process.exitCode = 1;

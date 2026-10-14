/**
 * Location grouping for printed reports.
 * "Group by location" turns a flat list of assets into a tree: the main location
 * as a band, its sub-locations as nested bands, and the assets under the location
 * they belong to. A band travels through the export pipeline as a marker row
 * (see GroupRow) so the CSV, XLSX and PDF generators can draw it their own way.
 */

/** Separator used by locations.full_path ("Main / Sub / Room"). */
export const LOCATION_SEPARATOR = ' / ';

/** Row key that identifies a band; detail rows never carry it. */
export const GROUP_KEY = '__group';

export interface GroupRow {
  /** name of this level only (not the whole path); '' means "no location" */
  __group: string;
  /** 0 for a main location, 1 for its sub-locations, … */
  __level: number;
  /** assets under this band, sub-locations included */
  __count: number;
}

export function isGroupRow(row: unknown): row is GroupRow {
  return !!row && typeof row === 'object' && GROUP_KEY in (row as Record<string, unknown>);
}

/** The text a band prints: indented name and the number of assets under it ("-" when it has no location). */
export function bandText(band: GroupRow): string {
  const name = band.__group === '' ? '-' : band.__group;
  return `${'  '.repeat(band.__level)}${name} (${band.__count})`;
}

/** Rows without the bands. */
export function detailRows<T>(rows: T[]): T[] {
  return rows.filter((row) => !isGroupRow(row));
}

function pathOf(row: Record<string, unknown>, key: string): string[] {
  const raw = row[key];
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  return raw.split(LOCATION_SEPARATOR).map((part) => part.trim()).filter(Boolean);
}

/**
 * Orders rows so that each location is contiguous and a parent comes right before
 * its children. Assets with no location go last. Rows of one location keep their
 * incoming order (stable), so a name or price sort still applies inside it.
 */
export function sortByLocation<T extends Record<string, unknown>>(rows: T[], key = 'location_name'): T[] {
  const decorated = rows.map((row, index) => ({ row, index, path: pathOf(row, key) }));
  decorated.sort((a, b) => {
    if (a.path.length === 0 || b.path.length === 0) {
      if (a.path.length === b.path.length) return a.index - b.index;
      return a.path.length === 0 ? 1 : -1;
    }
    const shared = Math.min(a.path.length, b.path.length);
    for (let i = 0; i < shared; i += 1) {
      const cmp = a.path[i].localeCompare(b.path[i], undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
    return a.path.length - b.path.length || a.index - b.index;
  });
  return decorated.map((d) => d.row);
}

/**
 * Inserts a band before the first row of every location level. `rows` must already
 * be ordered with sortByLocation. The location column itself is not touched here.
 */
export function insertLocationBands(rows: Array<Record<string, unknown>>, key = 'location_name'): Array<Record<string, unknown>> {
  const paths = rows.map((row) => pathOf(row, key));
  const counts = new Map<string, number>();
  const id = (path: string[], depth: number) => path.slice(0, depth).join(LOCATION_SEPARATOR);
  for (const path of paths) {
    if (path.length === 0) counts.set('', (counts.get('') ?? 0) + 1);
    for (let depth = 1; depth <= path.length; depth += 1) counts.set(id(path, depth), (counts.get(id(path, depth)) ?? 0) + 1);
  }

  const out: Array<Record<string, unknown>> = [];
  let open: string[] = [];
  let openedEmpty = false;
  rows.forEach((row, index) => {
    const path = paths[index];
    if (path.length === 0) {
      if (!openedEmpty) {
        out.push({ __group: '', __level: 0, __count: counts.get('') ?? 0 } satisfies GroupRow);
        openedEmpty = true;
      }
      out.push(row);
      return;
    }
    let common = 0;
    while (common < open.length && common < path.length && open[common] === path[common]) common += 1;
    for (let depth = common; depth < path.length; depth += 1) {
      out.push({ __group: path[depth], __level: depth, __count: counts.get(id(path, depth + 1)) ?? 0 } satisfies GroupRow);
    }
    open = path;
    out.push(row);
  });
  return out;
}

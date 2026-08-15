/**
 * Pure algorithms extracted from AssetX_README (3), section 13.
 * These functions have no database or framework dependency so they can be reused
 * by application services, import validation, mobile sync, and unit tests.
 */

export type DuplicateLevel = 'Merge' | 'NewVariant' | 'NewAsset';

export interface AssetIdentity {
  name: string;
  locationId?: string | null;
  categoryId?: string | null;
  statusId?: string | null;
  employeeId?: string | null;
  modelId?: string | null;
}

export interface DuplicateDecision<T extends AssetIdentity = AssetIdentity> {
  level: DuplicateLevel;
  existing: T | null;
  requiresMergeConfirmation: boolean;
  isNewVariant: boolean;
  isMerged: boolean;
  differences: string[];
}

export interface SearchableAsset {
  name?: string | null;
  baseAssetCode?: string | null;
  fullAssetCode?: string | null;
  serialNumber?: string | null;
  barcode?: string | null;
  description?: string | null;
  locationName?: string | null;
  assetTypeName?: string | null;
  employeeName?: string | null;
}

export interface SearchResult<T> {
  item: T;
  score: number;
}

export interface DepreciationInput {
  purchasePrice: number;
  depreciationRate: number;
  purchaseDate: Date | string;
  today?: Date | string;
}

export interface DepreciationResult {
  yearsOwned: number;
  bookValue: number;
  depreciationPercentage: number;
  ageYears: number;
  ageMonths: number;
}

/**
 * L1 location-inventory assistant. It only classifies a discrepancy and never
 * mutates an asset, an inventory record, or a movement. The caller must retain
 * the human confirmation and movement-approval steps defined by the workflow.
 */
export interface LocationAnomalyInput {
  expectedLocationId?: string | null;
  actualLocationId?: string | null;
  expectedQuantity?: number | null;
  actualQuantity?: number | null;
}

export interface LocationAnomalySuggestion {
  isAnomaly: boolean;
  riskScore: number;
  riskLevel: 'none' | 'medium' | 'high';
  reasonCodes: Array<'LOCATION_MISMATCH' | 'QUANTITY_VARIANCE' | 'LOCATION_UNRESOLVED'>;
  recommendedAction: 'none' | 'review_location' | 'confirm_transfer';
  requiresHumanConfirmation: boolean;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

/** Normalize Latin and Arabic text for matching without changing stored values. */
export function normalizeText(value: string | null | undefined): string {
  return text(value)
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(first: string, second: string): number {
  const a = Array.from(first);
  const b = Array.from(second);
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

/** README threshold: 1.0 means identical, 0.0 means completely different. */
export function calculateSimilarity(first: string, second: string): number {
  const a = normalizeText(first);
  const b = normalizeText(second);
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshteinDistance(a, b) / longest;
}

export function findSimilarAssetNames(
  name: string,
  candidates: string[],
  options: { displayThreshold?: number; warningThreshold?: number } = {},
): Array<{ name: string; similarity: number; warning: boolean }> {
  const displayThreshold = options.displayThreshold ?? 0.5;
  const warningThreshold = options.warningThreshold ?? 0.75;
  return candidates
    .filter((candidate) => text(candidate) !== '')
    .map((candidate) => {
      const similarity = calculateSimilarity(name, candidate);
      return { name: candidate, similarity, warning: similarity >= warningThreshold };
    })
    .filter((result) => result.similarity >= displayThreshold)
    .sort((left, right) => right.similarity - left.similarity || left.name.localeCompare(right.name));
}

/** Recycle the first unused YYYY-NNNN sequence, as specified by BR-CODE-001. */
export function findFirstAvailableCodeNumber(year: number, usedCodes: Iterable<string>): number {
  const prefix = `${year}-`;
  const used = new Set(
    Array.from(usedCodes)
      .filter((code) => code.startsWith(prefix))
      .map((code) => Number(code.slice(prefix.length)))
      .filter((number) => Number.isInteger(number) && number > 0),
  );
  let number = 1;
  while (used.has(number)) number += 1;
  return number;
}

export function generateBaseAssetCode(year: number, usedCodes: Iterable<string>, maxAttempts = 1000): string {
  const used = new Set(usedCodes);
  let number = findFirstAvailableCodeNumber(year, used);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = `${year}-${String(number).padStart(4, '0')}`;
    if (!used.has(code)) return code;
    number += 1;
  }
  throw new Error('BASE_CODE_GENERATION_EXHAUSTED');
}

export function cleanLocationName(locationName: string): string {
  const cleaned = text(locationName)
    .normalize('NFKC')
    .replace(/[\s_–—/\\,.;:|]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.toLowerCase() || 'location';
}

export function generateFullAssetCode(
  baseCode: string,
  locationName: string,
  usedFullCodes: Iterable<string>,
  maxAttempts = 100,
): string {
  const used = new Set(usedFullCodes);
  const root = `${baseCode}@${cleanLocationName(locationName)}`;
  if (!used.has(root)) return root;
  for (let suffix = 1; suffix <= maxAttempts; suffix += 1) {
    const candidate = `${root}-${String(suffix).padStart(2, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('FULL_CODE_GENERATION_EXHAUSTED');
}

const IDENTITY_FIELDS: Array<[keyof AssetIdentity, string]> = [
  ['name', 'name'], ['locationId', 'location'], ['categoryId', 'asset type'],
  ['statusId', 'status'], ['employeeId', 'employee'], ['modelId', 'model'],
];

function identityValue(asset: AssetIdentity, field: keyof AssetIdentity): string {
  const value = asset[field];
  return field === 'name' ? normalizeText(value) : text(value);
}

export function checkForDuplicates<T extends AssetIdentity>(
  candidate: T,
  existing: T[],
): DuplicateDecision<T> {
  const exact = existing.find((row) => IDENTITY_FIELDS.every(([field]) => identityValue(row, field) === identityValue(candidate, field)));
  if (exact) {
    return {
      level: 'Merge', existing: exact, requiresMergeConfirmation: true,
      isNewVariant: false, isMerged: false, differences: [],
    };
  }
  const sameName = existing.find((row) => normalizeText(row.name) === normalizeText(candidate.name));
  if (sameName) {
    const differences = IDENTITY_FIELDS
      .filter(([field]) => identityValue(sameName, field) !== identityValue(candidate, field))
      .map(([, label]) => label);
    return {
      level: 'NewVariant', existing: sameName, requiresMergeConfirmation: false,
      isNewVariant: true, isMerged: false, differences,
    };
  }
  return {
    level: 'NewAsset', existing: null, requiresMergeConfirmation: false,
    isNewVariant: false, isMerged: false, differences: [],
  };
}

const SEARCH_FIELDS: Array<keyof SearchableAsset> = [
  'name', 'baseAssetCode', 'fullAssetCode', 'serialNumber', 'barcode',
  'description', 'locationName', 'assetTypeName', 'employeeName',
];

export function smartSearch<T extends SearchableAsset>(assets: T[], query: string): SearchResult<T>[] {
  const needle = normalizeText(query);
  if (needle.length < 2) return [];
  return assets
    .map((item) => {
      let score = 0;
      SEARCH_FIELDS.forEach((field, index) => {
        const value = normalizeText(item[field]);
        if (!value) return;
        if (value === needle) score += 1000 - index * 10;
        else if (value.startsWith(needle)) score += 700 - index * 10;
        else if (value.includes(needle)) score += 400 - index * 10;
      });
      return { item, score };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || normalizeText(left.item.name).localeCompare(normalizeText(right.item.name)));
}

export function calculateDepreciation(input: DepreciationInput): DepreciationResult {
  const purchasePrice = Math.max(0, Number(input.purchasePrice) || 0);
  const rate = Math.min(100, Math.max(0, Number(input.depreciationRate) || 0));
  const purchaseDate = new Date(input.purchaseDate);
  const today = new Date(input.today ?? new Date());
  const elapsedMs = Math.max(0, today.getTime() - purchaseDate.getTime());
  const yearsOwned = elapsedMs / (365.25 * 24 * 60 * 60 * 1000);
  const bookValue = Math.max(0, purchasePrice - purchasePrice * (rate / 100) * yearsOwned);
  const depreciationPercentage = purchasePrice === 0 ? 0 : ((purchasePrice - bookValue) / purchasePrice) * 100;
  let ageYears = today.getUTCFullYear() - purchaseDate.getUTCFullYear();
  let ageMonths = today.getUTCMonth() - purchaseDate.getUTCMonth();
  if (today.getUTCDate() < purchaseDate.getUTCDate()) ageMonths -= 1;
  if (ageMonths < 0) { ageYears -= 1; ageMonths += 12; }
  return {
    yearsOwned,
    bookValue,
    depreciationPercentage,
    ageYears: Math.max(0, ageYears),
    ageMonths: Math.max(0, ageMonths),
  };
}

export function assessLocationAnomaly(input: LocationAnomalyInput): LocationAnomalySuggestion {
  const expected = input.expectedLocationId ?? null;
  const actual = input.actualLocationId ?? null;
  const expectedQuantity = Number(input.expectedQuantity ?? 0);
  const actualQuantity = Number(input.actualQuantity ?? 0);

  // Missing/zero counts remain an inventory-result concern, not a transfer recommendation.
  if (actualQuantity <= 0 || expected === actual) {
    return {
      isAnomaly: false, riskScore: 0, riskLevel: 'none', reasonCodes: [],
      recommendedAction: 'none', requiresHumanConfirmation: false,
    };
  }

  if (!expected || !actual) {
    return {
      isAnomaly: true, riskScore: 55, riskLevel: 'medium', reasonCodes: ['LOCATION_UNRESOLVED'],
      recommendedAction: 'review_location', requiresHumanConfirmation: true,
    };
  }

  const quantityVariance = expectedQuantity !== actualQuantity;
  return {
    isAnomaly: true,
    riskScore: quantityVariance ? 90 : 70,
    riskLevel: quantityVariance ? 'high' : 'medium',
    reasonCodes: quantityVariance ? ['LOCATION_MISMATCH', 'QUANTITY_VARIANCE'] : ['LOCATION_MISMATCH'],
    recommendedAction: 'confirm_transfer',
    requiresHumanConfirmation: true,
  };
}

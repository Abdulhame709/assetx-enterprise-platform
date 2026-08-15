import {
  calculateDepreciation,
  assessLocationAnomaly,
  calculateSimilarity,
  checkForDuplicates,
  cleanLocationName,
  findSimilarAssetNames,
  generateBaseAssetCode,
  generateFullAssetCode,
  smartSearch,
} from '../src/application/asset-algorithms';

describe('AssetX README algorithms', () => {
  it('normalizes Arabic text and calculates Levenshtein similarity', () => {
    expect(calculateSimilarity('حاسوب محمول', 'حاسوب-محمول')).toBe(1);
    expect(calculateSimilarity('حاسوب محمول', 'حاسوب مكتبي')).toBeGreaterThan(0.5);
  });

  it('returns similar names at display and warning thresholds', () => {
    const results = findSimilarAssetNames('Laptop Dell', ['Laptop Dell', 'Laptop Deli', 'Printer HP'], { displayThreshold: 0.5 });
    expect(results[0]).toMatchObject({ name: 'Laptop Dell', similarity: 1, warning: true });
    expect(results.some((result) => result.name === 'Printer HP')).toBe(false);
  });

  it('recycles the first available base code and creates unique full codes', () => {
    expect(generateBaseAssetCode(2026, ['2026-0001', '2026-0003'])).toBe('2026-0002');
    expect(cleanLocationName('المكتب الرئيسي / الدور 2')).toBe('المكتب-الرئيسي-الدور-2');
    expect(generateFullAssetCode('2026-0002', 'المكتب الرئيسي', ['2026-0002@المكتب-الرئيسي'])).toBe('2026-0002@المكتب-الرئيسي-01');
  });

  it('classifies exact duplicates as merge and same-name rows as variants', () => {
    const existing = { name: 'Laptop', locationId: 'l1', categoryId: 'c1', statusId: 's1', employeeId: 'e1', modelId: 'm1' };
    expect(checkForDuplicates({ ...existing }, [existing]).level).toBe('Merge');
    expect(checkForDuplicates({ ...existing, locationId: 'l2' }, [existing])).toMatchObject({ level: 'NewVariant', isNewVariant: true });
    expect(checkForDuplicates({ ...existing, name: 'Printer' }, [existing]).level).toBe('NewAsset');
  });

  it('searches across the nine README fields with name-first relevance', () => {
    const assets = [
      { name: 'Laptop Dell', baseAssetCode: '2026-0001', locationName: 'HQ' },
      { name: 'Office Printer', barcode: 'LAPTOP-DELL-2', locationName: 'HQ' },
    ];
    const results = smartSearch(assets, 'Laptop Dell');
    expect(results[0].item.name).toBe('Laptop Dell');
    expect(smartSearch(assets, 'x')).toHaveLength(0);
  });

  it('calculates book value, depreciation percentage, and asset age', () => {
    const result = calculateDepreciation({
      purchasePrice: 1000,
      depreciationRate: 20,
      purchaseDate: '2024-01-01T00:00:00.000Z',
      today: '2026-01-01T00:00:00.000Z',
    });
    expect(result.bookValue).toBeCloseTo(600, 0);
    expect(result.depreciationPercentage).toBeCloseTo(40, 0);
    expect(result.ageYears).toBe(2);
  });

  it('flags only observed location discrepancies and always preserves human confirmation', () => {
    expect(assessLocationAnomaly({ expectedLocationId: 'loc-a', actualLocationId: 'loc-a', expectedQuantity: 1, actualQuantity: 1 }))
      .toMatchObject({ isAnomaly: false, recommendedAction: 'none' });
    expect(assessLocationAnomaly({ expectedLocationId: 'loc-a', actualLocationId: 'loc-b', expectedQuantity: 1, actualQuantity: 1 }))
      .toMatchObject({ isAnomaly: true, riskLevel: 'medium', recommendedAction: 'confirm_transfer', requiresHumanConfirmation: true, reasonCodes: ['LOCATION_MISMATCH'] });
    expect(assessLocationAnomaly({ expectedLocationId: 'loc-a', actualLocationId: 'loc-b', expectedQuantity: 1, actualQuantity: 2 }))
      .toMatchObject({ riskLevel: 'high', riskScore: 90, reasonCodes: ['LOCATION_MISMATCH', 'QUANTITY_VARIANCE'] });
  });
});

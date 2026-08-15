import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { humanError } from './errors';

describe('humanError — protected master-data deactivation', () => {
  it('renders exact Arabic counts for a category with linked assets and child types', () => {
    const error = new ApiError(409, 'CATEGORY_HAS_CHILDREN', 'CONFLICT', {
      asset_count: 3,
      child_category_count: 2,
    });

    expect(humanError(error, undefined, 'ar')).toBe('لا يمكن تعطيل نوع الأصل لأنه مرتبط بـ 3 أصل نشط و2 نوع فرعي نشط.');
  });

  it('renders exact Arabic counts for a status linked to active assets', () => {
    const error = new ApiError(409, 'STATUS_HAS_ASSETS', 'CONFLICT', { asset_count: 1 });

    expect(humanError(error, undefined, 'ar')).toBe('لا يمكن تعطيل هذه الحالة لأنها مستخدمة بواسطة 1 أصل نشط.');
  });

  it('preserves a clear English count-aware message when the locale is English', () => {
    const error = new ApiError(409, 'CATEGORY_HAS_ASSETS', 'CONFLICT', { asset_count: 2, child_category_count: 0 });

    expect(humanError(error, undefined, 'en')).toBe('This asset type cannot be deactivated because it is linked to 2 active assets.');
  });
});

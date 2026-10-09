/**
 * Human-friendly mapping of backend error codes (error-codes.ts domains).
 * Prevents raw codes like 'DUPLICATE_LOCATION' from leaking into the UI.
 * Used by forms/pages when surfacing ApiError messages.
 */

const MESSAGES: Record<string, string> = {
  // Master data
  NAME_INVALID: 'Name must be at least 2 characters.',
  COLOR_INVALID: 'Color must be a hex value like #27ae60.',
  DUPLICATE_LOCATION: 'A location with this name already exists in the same parent.',
  DUPLICATE_CATEGORY: 'An asset type with this name already exists under the same parent.',
  CATEGORY_CYCLE: 'An asset type cannot be moved under itself or one of its descendants.',
  DUPLICATE_STATUS: 'A status with this name already exists.',
  LOCATION_NOT_FOUND: 'Location not found.',
  CATEGORY_NOT_FOUND: 'Asset type not found.',
  STATUS_NOT_FOUND: 'Status not found.',
  PARENT_NOT_FOUND: 'The selected parent no longer exists.',
  LOCATION_HAS_CHILDREN: 'Cannot delete a location that has child locations.',
  LOCATION_TYPE_NOT_FOUND: 'The selected location type is not available.',
  DUPLICATE_LOCATION_TYPE_CODE: 'A location type with this code already exists.',
  DUPLICATE_LOCATION_TYPE_NAME: 'A location type with this name already exists.',
  LOCATION_TYPE_HAS_LOCATIONS: 'This location type is used by active locations and cannot be deactivated.',
  LOCATION_TYPE_CODE_INVALID: 'Use lowercase letters, numbers, hyphens, or underscores for the code.',
  LOCATION_TYPE_NAME_EN_INVALID: 'The English name must be between 2 and 120 characters.',
  LOCATION_TYPE_ICON_INVALID: 'Choose a supported icon key.',
  LOCATION_TYPE_SORT_INVALID: 'The order must be a whole number from 0 to 9999.',
  CATEGORY_HAS_CHILDREN: 'This asset type cannot be deactivated because it still has linked records.',
  CATEGORY_HAS_ASSETS: 'This asset type cannot be deactivated because active assets use it.',
  STATUS_HAS_ASSETS: 'This asset status cannot be deactivated because active assets use it.',
  // Assets
  ASSET_NAME_INVALID: 'Asset name must be at least 2 characters.',
  ASSET_NOT_FOUND: 'Asset not found.',
  CATEGORY_REQUIRED: 'Please choose an asset type.',
  LOCATION_REQUIRED: 'Please choose a location.',
  STATUS_REQUIRED: 'Please choose a status.',
  QUANTITY_INVALID: 'Quantity must be greater than zero.',
  PRICE_INVALID: 'Price cannot be negative.',
  DEPRECIATION_RATE_INVALID: 'Depreciation rate must be between 0 and 100.',
  // Movements / lifecycle
  MOVEMENT_NOT_FOUND: 'Movement not found.',
  MOVEMENT_NOT_PENDING: 'This movement was already processed.',
  TRANSFER_TARGET_REQUIRED: 'Choose a destination location or custodian for the transfer.',
  SAME_LOCATION: 'The asset is already at this location.',
  DUPLICATE_PENDING: 'A pending movement of this type already exists for this asset.',
  EMPLOYEE_INACTIVE: 'The selected employee is inactive.',
  ASSET_INACTIVE: 'This asset is inactive and cannot be moved.',
  INVALID_TRANSITION: 'This action is not allowed in the asset current state.',
  // Inventory
  INVALID_YEAR: 'Year must be between 2000 and 2100.',
  CYCLE_YEAR_EXISTS: 'An inventory cycle already exists for this year.',
  CYCLE_NOT_FOUND: 'Inventory cycle not found.',
  CYCLE_CLOSED: 'This cycle is closed — records are locked.',
  INVALID_CYCLE_TRANSITION: 'This action is not allowed in the current cycle state.',
  RECORD_NOT_FOUND: 'Inventory record not found.',
  ASSET_NOT_IN_CYCLE: 'This asset is not part of the cycle snapshot.',
  CANNOT_VERIFY_UNINVENTORIED: 'Only counted records can be verified.',
  // Auth
  INVALID_CREDENTIALS: 'Incorrect username or password.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'You do not have permission for this action.',
  SESSION_EXPIRED: 'Your session expired. Please sign in again.',
};

const MESSAGES_AR: Record<string, string> = {
  LOCATION_TYPE_NOT_FOUND: 'نوع الموقع المحدد غير متاح.',
  DUPLICATE_LOCATION_TYPE_CODE: 'يوجد نوع موقع بهذا الرمز مسبقاً.',
  DUPLICATE_LOCATION_TYPE_NAME: 'يوجد نوع موقع بهذا الاسم مسبقاً.',
  LOCATION_TYPE_CODE_INVALID: 'استخدم أحرفاً إنجليزية صغيرة أو أرقاماً أو شرطات في الرمز.',
  LOCATION_TYPE_NAME_EN_INVALID: 'يجب أن يتكون الاسم الإنجليزي من حرفين إلى 120 حرفاً.',
  LOCATION_TYPE_ICON_INVALID: 'اختر رمزاً مدعوماً.',
  LOCATION_TYPE_SORT_INVALID: 'يجب أن يكون الترتيب رقماً صحيحاً من 0 إلى 9999.',
};

type ErrorDetails = { asset_count?: unknown; child_category_count?: unknown; location_count?: unknown };
type SupportedLocale = 'ar' | 'en';

const asPositiveCount = (value: unknown): number => {
  const count = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
};

const isArabic = (locale?: SupportedLocale): boolean =>
  locale ? locale === 'ar' : typeof document !== 'undefined' && document.documentElement.lang === 'ar';

function protectedDeactivationMessage(code: string, details: ErrorDetails, locale?: SupportedLocale): string | null {
  const assetCount = asPositiveCount(details.asset_count);
  const childCategoryCount = asPositiveCount(details.child_category_count);
  const locationCount = asPositiveCount(details.location_count);
  if (code === 'LOCATION_TYPE_HAS_LOCATIONS' && locationCount) {
    return isArabic(locale)
      ? `لا يمكن تعطيل نوع الموقع لأنه مستخدم بواسطة ${locationCount} موقع نشط.`
      : `This location type cannot be deactivated because ${locationCount} active location${locationCount === 1 ? '' : 's'} use it.`;
  }
  if (!assetCount && !childCategoryCount) return null;

  if (isArabic(locale)) {
    if (code === 'STATUS_HAS_ASSETS') return `لا يمكن تعطيل هذه الحالة لأنها مستخدمة بواسطة ${assetCount} أصل نشط.`;
    const blockers = [
      assetCount ? `${assetCount} أصل نشط` : '',
      childCategoryCount ? `${childCategoryCount} نوع فرعي نشط` : '',
    ].filter(Boolean).join(' و');
    return `لا يمكن تعطيل نوع الأصل لأنه مرتبط بـ ${blockers}.`;
  }

  if (code === 'STATUS_HAS_ASSETS') return `This status cannot be deactivated because ${assetCount} active asset${assetCount === 1 ? '' : 's'} use it.`;
  const blockers = [
    assetCount ? `${assetCount} active asset${assetCount === 1 ? '' : 's'}` : '',
    childCategoryCount ? `${childCategoryCount} active child type${childCategoryCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' and ');
  return `This asset type cannot be deactivated because it is linked to ${blockers}.`;
}

export function humanError(err: unknown, fallback = 'Something went wrong. Please try again.', locale?: SupportedLocale): string {
  const anyErr = err as { message?: string; code?: string; status?: number; details?: ErrorDetails };
  if (anyErr?.status === 404) return isArabic(locale) ? 'السجل المطلوب غير موجود.' : 'The requested record was not found.';
  if (anyErr?.status === 403) return isArabic(locale) ? 'لا تملك صلاحية تنفيذ هذا الإجراء.' : MESSAGES.FORBIDDEN;
  if (anyErr?.status === 401) return isArabic(locale) ? 'انتهت جلستك. سجّل الدخول مرة أخرى.' : MESSAGES.SESSION_EXPIRED;
  // The API envelope carries an HTTP-level code (for example CONFLICT) and a
  // domain-level message (for example STATUS_HAS_ASSETS). The latter is what
  // drives actionable, count-aware user feedback.
  const raw = typeof anyErr?.message === 'string' ? anyErr.message : typeof anyErr?.code === 'string' ? anyErr.code : null;
  if (!raw) return fallback;
  const protectedMessage = protectedDeactivationMessage(raw, anyErr?.details ?? {}, locale);
  if (protectedMessage) return protectedMessage;
  return (isArabic(locale) ? MESSAGES_AR[raw] : MESSAGES[raw]) ?? MESSAGES[raw] ?? raw;
}

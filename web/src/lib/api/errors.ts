/**
 * Human-friendly mapping of backend error codes (error-codes.ts domains).
 * Prevents raw codes like 'DUPLICATE_LOCATION' from leaking into the UI.
 * Used by forms/pages when surfacing ApiError messages.
 */

const MESSAGES: Record<string, string> = {
  INVALID_EXPORT_FILTER: 'One of the report filters is not valid.',
  INVALID_EXPORT_SUMMARY: 'The summary text is too long for the report.',
  INVALID_EXPORT_RESOURCE: 'This report cannot be shown on screen.',
  ORGANIZATION_NAME_INVALID: 'The organization name must be between 2 and 120 characters.',
  SETTING_VALUE_INVALID: 'One of the setting values is not valid.',
  LOGO_INVALID: 'The logo must be a PNG or JPEG image no larger than 300 KB.',
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
  CYCLE_YEAR_EXISTS: 'An inventory cycle already exists for this year. Open it, or delete it first if it was created by mistake.',
  CYCLE_CLOSED_CANNOT_DELETE: 'A closed cycle is a permanent record and cannot be deleted.',
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
  ACCOUNT_LOCKED: 'Too many failed attempts. The account is temporarily locked; try again later.',
  PASSWORD_TOO_WEAK: 'The password is too weak.',
  TENANT_REQUIRED: 'The organization is required.',
  USERNAME_EXISTS: 'This username is already taken.',
  ROLE_NOT_FOUND: 'Role not found.',
  USER_NOT_FOUND: 'User not found.',
  TENANT_NOT_FOUND: 'Organization not found.',
  SESSION_REVOKED: 'Your session was ended. Please sign in again.',
  PASSWORD_RESET_TOKEN_INVALID: 'The password reset link is invalid or expired.',
  PERMISSIONS_STALE: 'Your permissions changed. Please sign in again.',
  COMPLIANCE_VIEW_DENIED: 'You do not have permission to view compliance data.',
  SYNC_BATCH_TOO_LARGE: 'The upload is too large. Send fewer records at a time.',
  ASSET_BULK_EMPTY: 'Select at least one asset.',
  ASSET_BULK_FIELDS_REQUIRED: 'Choose at least one field to update.',
  ASSET_HAS_REFERENCES: 'This asset has linked records and cannot be deleted.',
  DUPLICATE_MODEL: 'A model with this name already exists.',
  MODEL_NOT_FOUND: 'Model not found.',
  EMPLOYEE_NOT_FOUND: 'Employee not found.',
  LOCATION_HAS_ASSETS: 'Cannot delete a location that has assets.',
  EMPLOYEE_HAS_ASSETS: 'Cannot delete an employee who has assets assigned.',
  INVALID_AUDIT_ACTION: 'The selected audit action is not valid.',
  TEMPLATE_NOT_FOUND: 'Report template not found.',
  NOTIFICATION_NOT_FOUND: 'Notification not found.',
  UNSUPPORTED_EXPORT_FORMAT: 'This export format is not supported.',
  UNSUPPORTED_EXPORT_RESOURCE: 'This report cannot be exported.',
  UNSUPPORTED_SEARCH_RESOURCE: 'This search type is not supported.',
  INVALID_SAVED_SEARCH_NAME: 'The saved search name is not valid.',
  INVALID_SAVED_SEARCH_RESOURCE: 'The saved search type is not valid.',
  SAVED_SEARCH_PAYLOAD_TOO_LARGE: 'The saved search is too large.',
  SAVED_SEARCH_NAME_EXISTS: 'A saved search with this name already exists.',
  SAVED_SEARCH_LIMIT_EXCEEDED: 'You have reached the maximum number of saved searches.',
  SAVED_SEARCH_NOT_FOUND: 'Saved search not found.',
  INVALID_UUID: 'One of the selected values is not valid.',
};

const MESSAGES_AR: Record<string, string> = {
  INVALID_EXPORT_FILTER: 'أحد مرشحات التقرير غير صحيح.',
  INVALID_EXPORT_SUMMARY: 'نص الملخص أطول من المسموح في التقرير.',
  INVALID_EXPORT_RESOURCE: 'لا يمكن عرض هذا التقرير على الشاشة.',
  ORGANIZATION_NAME_INVALID: 'يجب أن يتكون اسم الجهة من حرفين إلى 120 حرفاً.',
  SETTING_VALUE_INVALID: 'إحدى قيم الإعدادات غير صحيحة.',
  LOGO_INVALID: 'يجب أن يكون الشعار صورة PNG أو JPEG لا يزيد حجمها عن 300 كيلوبايت.',
  LOCATION_TYPE_NOT_FOUND: 'نوع الموقع المحدد غير متاح.',
  DUPLICATE_LOCATION_TYPE_CODE: 'يوجد نوع موقع بهذا الرمز مسبقاً.',
  DUPLICATE_LOCATION_TYPE_NAME: 'يوجد نوع موقع بهذا الاسم مسبقاً.',
  LOCATION_TYPE_CODE_INVALID: 'استخدم أحرفاً إنجليزية صغيرة أو أرقاماً أو شرطات في الرمز.',
  LOCATION_TYPE_NAME_EN_INVALID: 'يجب أن يتكون الاسم الإنجليزي من حرفين إلى 120 حرفاً.',
  LOCATION_TYPE_ICON_INVALID: 'اختر رمزاً مدعوماً.',
  LOCATION_TYPE_SORT_INVALID: 'يجب أن يكون الترتيب رقماً صحيحاً من 0 إلى 9999.',
  NAME_INVALID: 'يجب ألا يقل الاسم عن حرفين.',
  COLOR_INVALID: 'يجب أن يكون اللون بصيغة سداسية عشرية مثل #27ae60.',
  DUPLICATE_LOCATION: 'يوجد موقع بهذا الاسم مسبقاً ضمن نفس الموقع الأب.',
  DUPLICATE_CATEGORY: 'يوجد نوع أصل بهذا الاسم مسبقاً ضمن نفس النوع الأب.',
  CATEGORY_CYCLE: 'لا يمكن نقل نوع الأصل تحت نفسه أو تحت أحد فروعه.',
  DUPLICATE_STATUS: 'توجد حالة بهذا الاسم مسبقاً.',
  LOCATION_NOT_FOUND: 'الموقع غير موجود.',
  CATEGORY_NOT_FOUND: 'نوع الأصل غير موجود.',
  STATUS_NOT_FOUND: 'الحالة غير موجودة.',
  PARENT_NOT_FOUND: 'العنصر الأب المحدد لم يعد موجوداً.',
  LOCATION_HAS_CHILDREN: 'لا يمكن حذف موقع يحتوي على مواقع فرعية.',
  LOCATION_TYPE_HAS_LOCATIONS: 'نوع الموقع مستخدم في مواقع نشطة ولا يمكن تعطيله.',
  CATEGORY_HAS_CHILDREN: 'لا يمكن تعطيل نوع الأصل لأنه ما زال مرتبطاً بسجلات.',
  CATEGORY_HAS_ASSETS: 'لا يمكن تعطيل نوع الأصل لأن أصولاً نشطة تستخدمه.',
  STATUS_HAS_ASSETS: 'لا يمكن تعطيل حالة الأصل لأن أصولاً نشطة تستخدمها.',
  ASSET_NAME_INVALID: 'يجب ألا يقل اسم الأصل عن حرفين.',
  ASSET_NOT_FOUND: 'الأصل غير موجود.',
  CATEGORY_REQUIRED: 'اختر نوع الأصل.',
  LOCATION_REQUIRED: 'اختر الموقع.',
  STATUS_REQUIRED: 'اختر الحالة.',
  QUANTITY_INVALID: 'يجب أن تكون الكمية أكبر من صفر.',
  PRICE_INVALID: 'لا يمكن أن يكون السعر سالباً.',
  DEPRECIATION_RATE_INVALID: 'يجب أن تكون نسبة الإهلاك بين 0 و100.',
  MOVEMENT_NOT_FOUND: 'الحركة غير موجودة.',
  MOVEMENT_NOT_PENDING: 'تمت معالجة هذه الحركة مسبقاً.',
  TRANSFER_TARGET_REQUIRED: 'اختر موقع الوجهة أو المستلم لعملية النقل.',
  SAME_LOCATION: 'الأصل موجود في هذا الموقع بالفعل.',
  DUPLICATE_PENDING: 'توجد حركة معلّقة من هذا النوع لهذا الأصل.',
  EMPLOYEE_INACTIVE: 'الموظف المحدد غير نشط.',
  ASSET_INACTIVE: 'هذا الأصل غير نشط ولا يمكن نقله.',
  INVALID_TRANSITION: 'هذا الإجراء غير مسموح في الحالة الحالية للأصل.',
  INVALID_YEAR: 'يجب أن تكون السنة بين 2000 و2100.',
  CYCLE_YEAR_EXISTS: 'توجد دورة جرد لهذه السنة مسبقاً. افتحها، أو احذفها أولاً إن أُنشئت بالخطأ.',
  CYCLE_CLOSED_CANNOT_DELETE: 'الدورة المغلقة سجل دائم ولا يمكن حذفها.',
  CYCLE_NOT_FOUND: 'دورة الجرد غير موجودة.',
  CYCLE_CLOSED: 'هذه الدورة مغلقة — السجلات مقفلة.',
  INVALID_CYCLE_TRANSITION: 'هذا الإجراء غير مسموح في الحالة الحالية للدورة.',
  RECORD_NOT_FOUND: 'سجل الجرد غير موجود.',
  ASSET_NOT_IN_CYCLE: 'هذا الأصل ليس ضمن لقطة الدورة.',
  CANNOT_VERIFY_UNINVENTORIED: 'لا يمكن اعتماد إلا السجلات التي تم عدّها.',
  INVALID_CREDENTIALS: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  UNAUTHORIZED: 'غير مصرّح لك بتنفيذ هذا الإجراء.',
  FORBIDDEN: 'لا تملك صلاحية تنفيذ هذا الإجراء.',
  SESSION_EXPIRED: 'انتهت جلستك. سجّل الدخول مرة أخرى.',
  ACCOUNT_LOCKED: 'محاولات فاشلة كثيرة. الحساب مقفل مؤقتاً، حاول لاحقاً.',
  PASSWORD_TOO_WEAK: 'كلمة المرور ضعيفة جداً.',
  TENANT_REQUIRED: 'الجهة مطلوبة.',
  USERNAME_EXISTS: 'اسم المستخدم مستخدم مسبقاً.',
  ROLE_NOT_FOUND: 'الدور غير موجود.',
  USER_NOT_FOUND: 'المستخدم غير موجود.',
  TENANT_NOT_FOUND: 'الجهة غير موجودة.',
  SESSION_REVOKED: 'تم إنهاء جلستك. سجّل الدخول مرة أخرى.',
  PASSWORD_RESET_TOKEN_INVALID: 'رابط إعادة تعيين كلمة المرور غير صالح أو منتهي.',
  PERMISSIONS_STALE: 'تغيّرت صلاحياتك. سجّل الدخول مرة أخرى.',
  COMPLIANCE_VIEW_DENIED: 'لا تملك صلاحية عرض بيانات الامتثال.',
  SYNC_BATCH_TOO_LARGE: 'حجم الرفع كبير جداً. أرسل عدداً أقل من السجلات في كل مرة.',
  ASSET_BULK_EMPTY: 'اختر أصلاً واحداً على الأقل.',
  ASSET_BULK_FIELDS_REQUIRED: 'اختر حقلاً واحداً على الأقل للتحديث.',
  ASSET_HAS_REFERENCES: 'هذا الأصل مرتبط بسجلات ولا يمكن حذفه.',
  DUPLICATE_MODEL: 'يوجد موديل بهذا الاسم مسبقاً.',
  MODEL_NOT_FOUND: 'الموديل غير موجود.',
  EMPLOYEE_NOT_FOUND: 'الموظف غير موجود.',
  LOCATION_HAS_ASSETS: 'لا يمكن حذف موقع يحتوي على أصول.',
  EMPLOYEE_HAS_ASSETS: 'لا يمكن حذف موظف لديه أصول مسلّمة.',
  INVALID_AUDIT_ACTION: 'إجراء التدقيق المحدد غير صحيح.',
  TEMPLATE_NOT_FOUND: 'قالب التقرير غير موجود.',
  NOTIFICATION_NOT_FOUND: 'الإشعار غير موجود.',
  UNSUPPORTED_EXPORT_FORMAT: 'صيغة التصدير هذه غير مدعومة.',
  UNSUPPORTED_EXPORT_RESOURCE: 'لا يمكن تصدير هذا التقرير.',
  UNSUPPORTED_SEARCH_RESOURCE: 'نوع البحث هذا غير مدعوم.',
  INVALID_SAVED_SEARCH_NAME: 'اسم البحث المحفوظ غير صحيح.',
  INVALID_SAVED_SEARCH_RESOURCE: 'نوع البحث المحفوظ غير صحيح.',
  SAVED_SEARCH_PAYLOAD_TOO_LARGE: 'البحث المحفوظ كبير جداً.',
  SAVED_SEARCH_NAME_EXISTS: 'يوجد بحث محفوظ بهذا الاسم مسبقاً.',
  SAVED_SEARCH_LIMIT_EXCEEDED: 'وصلت إلى الحد الأقصى لعدد عمليات البحث المحفوظة.',
  SAVED_SEARCH_NOT_FOUND: 'البحث المحفوظ غير موجود.',
  INVALID_UUID: 'إحدى القيم المحددة غير صحيحة.',
};

const FALLBACK = {
  en: 'Something went wrong. Please try again.',
  ar: 'حدث خطأ ما. حاول مرة أخرى.',
};

const GENERIC_CODES_AR: Record<string, string> = {
  CONFLICT: 'تعذّر تنفيذ الطلب بسبب تعارض مع بيانات موجودة.',
  VALIDATION_ERROR: 'بعض البيانات المدخلة غير صحيحة.',
  NOT_FOUND: 'السجل المطلوب غير موجود.',
  PAYLOAD_TOO_LARGE: 'حجم البيانات المرسلة كبير جداً.',
};
const GENERIC_CODES_EN: Record<string, string> = {
  CONFLICT: 'The request conflicts with existing data.',
  VALIDATION_ERROR: 'Some of the entered data is not valid.',
  NOT_FOUND: 'The requested record was not found.',
  PAYLOAD_TOO_LARGE: 'The submitted data is too large.',
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

export function humanError(err: unknown, fallback?: string, locale?: SupportedLocale): string {
  const ar = isArabic(locale);
  const fallbackText = fallback ?? (ar ? FALLBACK.ar : FALLBACK.en);
  const anyErr = err as { message?: string; code?: string; status?: number; details?: ErrorDetails };
  // The API envelope carries an HTTP-level code (for example CONFLICT) and a
  // domain-level message (for example STATUS_HAS_ASSETS). The latter is what
  // drives actionable, count-aware user feedback.
  const raw = typeof anyErr?.message === 'string' ? anyErr.message : typeof anyErr?.code === 'string' ? anyErr.code : null;
  if (raw) {
    const protectedMessage = protectedDeactivationMessage(raw, anyErr?.details ?? {}, locale);
    if (protectedMessage) return protectedMessage;
    const known = (ar ? MESSAGES_AR[raw] : MESSAGES[raw]) ?? MESSAGES[raw];
    if (known) return known;
  }
  if (anyErr?.status === 404) return ar ? GENERIC_CODES_AR.NOT_FOUND : GENERIC_CODES_EN.NOT_FOUND;
  if (anyErr?.status === 403) return ar ? MESSAGES_AR.FORBIDDEN : MESSAGES.FORBIDDEN;
  if (anyErr?.status === 401) return ar ? MESSAGES_AR.SESSION_EXPIRED : MESSAGES.SESSION_EXPIRED;
  if (!raw) return fallbackText;
  const generic = (ar ? GENERIC_CODES_AR : GENERIC_CODES_EN)[raw];
  if (generic) return generic;
  // An unmapped internal code never reaches the screen, and in Arabic neither does raw English text.
  if (ar || /^[A-Z][A-Z0-9_]+$/.test(raw)) return fallbackText;
  return raw;
}

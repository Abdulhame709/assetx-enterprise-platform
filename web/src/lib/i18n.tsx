'use client';

/**
 * AssetX i18n + RTL support (Phase UX-1).
 * Provides:
 *  - a DirectionProvider that toggles html[dir] and persists the preference,
 *  - a lightweight dictionary + t() for translatable labels,
 *  - label maps for internal codes (asset states, movement types, audit actions).
 * No backend changes; presentation-layer mapping only.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export type Locale = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

const LANG_KEY = 'assetx.lang.v1';

/** Static UI dictionary. Keys are shared by the shell and feature pages. */
const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: {
    'nav.overview': 'Overview', 'nav.operations': 'Operations', 'nav.masterData': 'Master Data',
    'nav.insights': 'Insights', 'nav.administration': 'Administration', 'nav.dashboard': 'Dashboard',
    'nav.search': 'Search', 'nav.assets': 'Assets', 'nav.inventory': 'Inventory', 'nav.maintenance': 'Maintenance',
    'nav.movements': 'Movements', 'nav.employees': 'Employees', 'nav.notifications': 'Notifications',
    'nav.locations': 'Locations', 'nav.assetTypes': 'Asset Types', 'nav.reports': 'Reports',
    'nav.analytics': 'Analytics', 'nav.compliance': 'Compliance', 'nav.audit': 'Audit',
    'nav.importData': 'Import Data', 'nav.settings': 'Settings', 'nav.administrationPage': 'Administration',
    'common.home': 'Home', 'common.details': 'Details', 'common.tenant': 'Tenant',
    'common.mainNavigation': 'Main navigation', 'common.toggleNavigation': 'Toggle navigation',
    'common.toggleLanguage': 'Toggle language', 'common.arabic': 'العربية', 'common.english': 'English',
    'common.notifications': 'Notifications', 'common.unreadNotifications': 'unread notifications',
    'common.active': 'Active', 'common.inactive': 'Inactive', 'common.code': 'Code', 'common.name': 'Name',
    'common.location': 'Location', 'common.custodian': 'Custodian', 'common.status': 'Status', 'common.quantity': 'Qty',
    'common.value': 'Value', 'common.type': 'Type', 'common.export': 'Export', 'common.newAsset': 'New Asset',
    'common.dispose': 'Dispose', 'common.assets': 'assets', 'common.assetCreated': 'Asset created',
    'common.exportDownloaded': 'Export downloaded', 'common.exportLiveData': 'Your CSV file was generated from live data.',
    'common.exportFailed': 'Export failed', 'common.disposalRequestsCreated': 'Disposal requests created',
    'common.someRequestsFailed': 'Some requests failed',
    'assetForm.newTitle': 'New Asset', 'assetForm.editTitle': 'Edit asset', 'assetForm.assetName': 'Asset name *',
    'assetForm.assetType': 'Asset type *', 'assetForm.model': 'Model', 'assetForm.location': 'Location *',
    'assetForm.status': 'Status *', 'assetForm.custodian': 'Custodian (employee)', 'assetForm.quantity': 'Quantity *',
    'assetForm.purchasePrice': 'Purchase price', 'assetForm.purchaseDate': 'Purchase date', 'assetForm.serialNumber': 'Serial number',
    'assetForm.barcode': 'Barcode', 'assetForm.description': 'Description', 'assetForm.notes': 'Notes',
    'assetForm.chooseType': 'Choose type…', 'assetForm.optional': 'Optional…', 'assetForm.chooseLocation': 'Choose location…',
    'assetForm.chooseStatus': 'Choose status…', 'assetForm.exampleName': 'e.g. Laptop X4', 'assetForm.whatIsAsset': 'What is this asset?',
    'assetForm.internalNotes': 'Internal notes (optional)', 'assetForm.cancel': 'Cancel', 'assetForm.create': 'Create asset',
    'assetForm.save': 'Save changes', 'assetForm.createdTitle': 'Asset created', 'assetForm.createdDescription': 'The generated code is ready for search, printing, and QR labels.',
    'assetForm.fullCode': 'Full asset code', 'assetForm.baseCode': 'Base asset code', 'assetForm.openAsset': 'Open asset details',
    'assetForm.createAnother': 'Create another asset', 'assetForm.formLoadFailed': 'Could not load form options.',
    'assetForm.nameTooShort': 'Name must be at least 2 characters.', 'assetForm.chooseAssetType': 'Choose an asset type.',
    'assetForm.chooseAssetLocation': 'Choose a location.', 'assetForm.chooseAssetStatus': 'Choose a status.',
    'assetForm.quantityInvalid': 'Quantity must be a number greater than zero.', 'assetForm.priceNegative': 'Price cannot be negative.',
    'inventory.cycle': 'Inventory Cycle', 'inventory.backToCycles': 'Back to cycles', 'inventory.start': 'Start Cycle',
    'inventory.close': 'Close Cycle', 'inventory.started': 'Started', 'inventory.notStarted': 'Not started yet',
    'inventory.closed': 'Closed', 'inventory.netVariance': 'Net variance', 'inventory.expected': 'Expected',
    'inventory.counted': 'Counted', 'inventory.matched': 'Matched', 'inventory.deficitExtra': 'Deficit / Extra',
    'inventory.missing': 'Missing', 'inventory.transferredUncounted': 'Transferred / Uncounted', 'inventory.asset': 'Asset',
    'inventory.result': 'Result', 'inventory.countedOn': 'Counted on', 'inventory.verified': 'Verified',
    'inventory.count': 'Count', 'inventory.recount': 'Re-count', 'inventory.verify': 'Verify', 'inventory.unverify': 'Unverify',
    'inventory.filterByResult': 'Filter by result', 'inventory.noFilterRecords': 'No records match this filter',
    'inventory.noSnapshotRecords': 'No snapshot records', 'inventory.tryDifferentFilter': 'Try a different result filter.',
    'inventory.snapshotNoAssets': 'This cycle has no assets in its snapshot.', 'inventory.startConfirm': 'Start this cycle?',
    'inventory.startMessage': 'Counting begins. The snapshot stays as it was created.', 'inventory.startAction': 'Start cycle',
    'inventory.closeConfirm': 'Close this cycle?', 'inventory.closeMessage': 'Closing is final — records become read-only.',
    'inventory.closeAction': 'Close cycle', 'inventory.startedToast': 'Cycle started',
    'inventory.startedToastMessage': 'The cycle is now in progress — you can record counts.', 'inventory.closedToast': 'Cycle closed',
    'inventory.closedToastMessage': 'Records are locked. Summary is final.', 'inventory.countSaved': 'Count saved',
    'inventory.countSavedMessage': 'The record result was recomputed.', 'inventory.verificationFailed': 'Verification failed',
    'inventory.recordVerified': 'Record verified', 'inventory.verificationRemoved': 'Verification removed',
    'inventory.recordsUncounted': 'record(s) are still uncounted.', 'inventory.cycles': 'cycles', 'inventory.newCycle': 'New Cycle',
    'inventory.noCycles': 'No inventory cycles yet', 'inventory.createCycle': 'Create cycle',
    'inventory.createCycleHint': 'Create a cycle to snapshot your active assets and start counting.',
    'inventory.notClosed': 'Not closed', 'inventory.open': 'Open', 'inventory.summaryUnavailable': 'summary unavailable',
    'inventory.countedComplete': 'counted · complete', 'inventory.cycleCreated': 'Cycle created',
    'inventory.snapshotted': 'asset(s) snapshotted.',
    'placeholder.planned': 'This module is planned for a later phase.',
    'placeholder.employeeSubtitle': 'Employee custody and assignment records.',
    'placeholder.notificationSubtitle': 'System notifications and alerts.',
    'placeholder.settingsSubtitle': 'Tenant settings and preferences.',
    'placeholder.importSubtitle': 'Import assets and master data with reconciliation.',
  },
  ar: {
    'nav.overview': 'نظرة عامة', 'nav.operations': 'العمليات', 'nav.masterData': 'البيانات الأساسية',
    'nav.insights': 'الرؤى والتقارير', 'nav.administration': 'الإدارة', 'nav.dashboard': 'لوحة التحكم',
    'nav.search': 'البحث', 'nav.assets': 'الأصول', 'nav.inventory': 'الجرد', 'nav.maintenance': 'الصيانة',
    'nav.movements': 'الحركات', 'nav.employees': 'الموظفون', 'nav.notifications': 'الإشعارات',
    'nav.locations': 'المواقع', 'nav.assetTypes': 'أنواع الأصول', 'nav.reports': 'التقارير',
    'nav.analytics': 'التحليلات', 'nav.compliance': 'الامتثال', 'nav.audit': 'سجل التدقيق',
    'nav.importData': 'استيراد البيانات', 'nav.settings': 'الإعدادات', 'nav.administrationPage': 'الإدارة',
    'common.home': 'الرئيسية', 'common.details': 'التفاصيل', 'common.tenant': 'الجهة',
    'common.mainNavigation': 'التنقل الرئيسي', 'common.toggleNavigation': 'تبديل قائمة التنقل',
    'common.toggleLanguage': 'تبديل اللغة', 'common.arabic': 'العربية', 'common.english': 'English',
    'common.notifications': 'الإشعارات', 'common.unreadNotifications': 'إشعارات غير مقروءة',
    'common.active': 'نشط', 'common.inactive': 'غير نشط', 'common.code': 'الرمز', 'common.name': 'الاسم',
    'common.location': 'الموقع', 'common.custodian': 'المستلم', 'common.status': 'الحالة', 'common.quantity': 'الكمية',
    'common.value': 'القيمة', 'common.type': 'النوع', 'common.export': 'تصدير', 'common.newAsset': 'أصل جديد',
    'common.dispose': 'استبعاد', 'common.assets': 'أصول', 'common.assetCreated': 'تم إنشاء الأصل',
    'common.exportDownloaded': 'تم تنزيل التصدير', 'common.exportLiveData': 'تم إنشاء ملف CSV من البيانات الحالية.',
    'common.exportFailed': 'فشل التصدير', 'common.disposalRequestsCreated': 'تم إنشاء طلبات الاستبعاد',
    'common.someRequestsFailed': 'فشل بعض الطلبات',
    'assetForm.newTitle': 'إضافة أصل جديد', 'assetForm.editTitle': 'تعديل الأصل', 'assetForm.assetName': 'اسم الأصل *',
    'assetForm.assetType': 'نوع الأصل *', 'assetForm.model': 'الموديل', 'assetForm.location': 'الموقع *',
    'assetForm.status': 'الحالة *', 'assetForm.custodian': 'الموظف المستلم', 'assetForm.quantity': 'الكمية *',
    'assetForm.purchasePrice': 'سعر الشراء', 'assetForm.purchaseDate': 'تاريخ الشراء', 'assetForm.serialNumber': 'الرقم التسلسلي',
    'assetForm.barcode': 'الباركود', 'assetForm.description': 'الوصف', 'assetForm.notes': 'ملاحظات',
    'assetForm.chooseType': 'اختر النوع…', 'assetForm.optional': 'اختياري…', 'assetForm.chooseLocation': 'اختر الموقع…',
    'assetForm.chooseStatus': 'اختر الحالة…', 'assetForm.exampleName': 'مثال: حاسوب محمول X4', 'assetForm.whatIsAsset': 'ما وصف هذا الأصل؟',
    'assetForm.internalNotes': 'ملاحظات داخلية (اختياري)', 'assetForm.cancel': 'إلغاء', 'assetForm.create': 'إنشاء الأصل',
    'assetForm.save': 'حفظ التغييرات', 'assetForm.createdTitle': 'تم إنشاء الأصل', 'assetForm.createdDescription': 'الكود المولّد جاهز للبحث والطباعة وملصقات QR.',
    'assetForm.fullCode': 'كود الأصل الكامل', 'assetForm.baseCode': 'الكود الأساسي للأصل', 'assetForm.openAsset': 'فتح تفاصيل الأصل',
    'assetForm.createAnother': 'إضافة أصل آخر', 'assetForm.formLoadFailed': 'تعذر تحميل خيارات النموذج.',
    'assetForm.nameTooShort': 'يجب أن يتكون اسم الأصل من حرفين على الأقل.', 'assetForm.chooseAssetType': 'اختر نوع الأصل.',
    'assetForm.chooseAssetLocation': 'اختر موقع الأصل.', 'assetForm.chooseAssetStatus': 'اختر حالة الأصل.',
    'assetForm.quantityInvalid': 'يجب أن تكون الكمية رقماً أكبر من صفر.', 'assetForm.priceNegative': 'لا يمكن أن يكون السعر سالباً.',
    'inventory.cycle': 'دورة الجرد', 'inventory.backToCycles': 'العودة إلى دورات الجرد', 'inventory.start': 'بدء الدورة',
    'inventory.close': 'إغلاق الدورة', 'inventory.started': 'بدأت', 'inventory.notStarted': 'لم تبدأ بعد',
    'inventory.closed': 'أُغلقت', 'inventory.netVariance': 'صافي الفرق', 'inventory.expected': 'المتوقع',
    'inventory.counted': 'تم جرده', 'inventory.matched': 'مطابق', 'inventory.deficitExtra': 'العجز / الزيادة',
    'inventory.missing': 'مفقود', 'inventory.transferredUncounted': 'منقول / لم يُجرد', 'inventory.asset': 'الأصل',
    'inventory.result': 'النتيجة', 'inventory.countedOn': 'تاريخ الجرد', 'inventory.verified': 'معتمد',
    'inventory.count': 'جرد', 'inventory.recount': 'إعادة الجرد', 'inventory.verify': 'اعتماد', 'inventory.unverify': 'إلغاء الاعتماد',
    'inventory.filterByResult': 'تصفية حسب النتيجة', 'inventory.noFilterRecords': 'لا توجد سجلات مطابقة لهذا المرشح',
    'inventory.noSnapshotRecords': 'لا توجد سجلات لقطة', 'inventory.tryDifferentFilter': 'جرّب مرشح نتيجة آخر.',
    'inventory.snapshotNoAssets': 'لا تحتوي هذه الدورة على أصول في لقطة الجرد.', 'inventory.startConfirm': 'هل تريد بدء هذه الدورة؟',
    'inventory.startMessage': 'سيبدأ العد، وستبقى اللقطة كما أُنشئت.', 'inventory.startAction': 'بدء الدورة',
    'inventory.closeConfirm': 'هل تريد إغلاق هذه الدورة؟', 'inventory.closeMessage': 'الإغلاق نهائي — ستصبح السجلات للقراءة فقط.',
    'inventory.closeAction': 'إغلاق الدورة', 'inventory.startedToast': 'بدأت دورة الجرد',
    'inventory.startedToastMessage': 'الدورة قيد التنفيذ ويمكنك تسجيل الكميات.', 'inventory.closedToast': 'أُغلقت دورة الجرد',
    'inventory.closedToastMessage': 'تم قفل السجلات وأصبح الملخص نهائياً.', 'inventory.countSaved': 'تم حفظ الجرد',
    'inventory.countSavedMessage': 'تمت إعادة حساب نتيجة السجل.', 'inventory.verificationFailed': 'فشل اعتماد السجل',
    'inventory.recordVerified': 'تم اعتماد السجل', 'inventory.verificationRemoved': 'تم إلغاء اعتماد السجل',
    'inventory.recordsUncounted': 'سجل ما زال دون جرد.', 'inventory.cycles': 'دورات', 'inventory.newCycle': 'دورة جديدة',
    'inventory.noCycles': 'لا توجد دورات جرد بعد', 'inventory.createCycle': 'إنشاء دورة',
    'inventory.createCycleHint': 'أنشئ دورة لإنشاء لقطة من الأصول النشطة والبدء في الجرد.',
    'inventory.notClosed': 'لم تُغلق', 'inventory.open': 'فتح', 'inventory.summaryUnavailable': 'الملخص غير متاح',
    'inventory.countedComplete': 'تم جرده · مكتمل', 'inventory.cycleCreated': 'تم إنشاء دورة الجرد',
    'inventory.snapshotted': 'أصل في اللقطة.',
    'placeholder.planned': 'هذه الوحدة مدرجة ضمن مرحلة لاحقة.',
    'placeholder.employeeSubtitle': 'سجلات الموظفين والعهد والتكليفات.',
    'placeholder.notificationSubtitle': 'إشعارات النظام والتنبيهات.',
    'placeholder.settingsSubtitle': 'إعدادات الجهة والتفضيلات.',
    'placeholder.importSubtitle': 'استيراد الأصول والبيانات الأساسية مع المطابقة.',
  },
};

const AR_LABELS: Record<string, string> = {
  draft: 'مسودة', registered: 'مسجل', active: 'نشط', assigned: 'مُسلَّم', in_maintenance: 'قيد الصيانة',
  transferred: 'منقول', disposed: 'مستبعد', archived: 'مؤرشف', transfer: 'نقل', assignment: 'تسليم عهدة',
  return: 'إرجاع', maintenance_return: 'إرجاع من الصيانة', disposal: 'استبعاد', retirement: 'إحالة للتقاعد',
  pending: 'معلّق', approved: 'معتمد', rejected: 'مرفوض', new: 'جديد', in_progress: 'قيد التنفيذ', closed: 'مغلق',
  matched: 'مطابق', deficit: 'عجز', surplus: 'زيادة', missing: 'مفقود', not_inventoried: 'لم يُجرد',
  Uncategorized: 'غير مصنف', Unassigned: 'غير مسند', AUTH_LOGIN_SUCCESS: 'تم تسجيل الدخول',
  AUTH_LOGIN_FAILED: 'فشل تسجيل الدخول', AUTH_LOGOUT: 'تم تسجيل الخروج', AUTH_TOKEN_REFRESH: 'تم تحديث الرمز',
  AUTH_REGISTER: 'تم تسجيل الحساب', AUTH_PASSWORD_RESET: 'إعادة تعيين كلمة المرور', PERMISSION_GRANTED: 'تم منح الصلاحية',
  PERMISSION_DENIED: 'رُفضت الصلاحية', PERMISSION_CHANGED: 'تم تغيير الصلاحية', ASSET_CREATED: 'تم إنشاء الأصل',
  ASSET_UPDATED: 'تم تحديث الأصل', ASSET_STATUS_CHANGED: 'تم تغيير حالة الأصل', ASSET_DELETED: 'تم حذف الأصل',
  MOVEMENT_CREATED: 'تم إنشاء الحركة', MOVEMENT_APPROVED: 'تم اعتماد الحركة', MOVEMENT_REJECTED: 'تم رفض الحركة',
  INVENTORY_CREATED: 'تم إنشاء دورة الجرد', INVENTORY_STARTED: 'بدأت دورة الجرد', INVENTORY_CLOSED: 'أُغلقت دورة الجرد',
  INVENTORY_RECORD_VERIFIED: 'تم اعتماد سجل الجرد', COMPLIANCE_WARNING: 'تحذير امتثال', EXPORT_STARTED: 'بدأ التصدير',
  EXPORT_COMPLETED: 'اكتمل التصدير', EXPORT_FAILED: 'فشل التصدير', SAVED_SEARCH_CREATED: 'تم إنشاء البحث المحفوظ',
  SAVED_SEARCH_UPDATED: 'تم تحديث البحث المحفوظ', SAVED_SEARCH_DELETED: 'تم حذف البحث المحفوظ',
  SAVED_SEARCH_EXECUTED: 'تم تنفيذ البحث المحفوظ', API_REQUEST: 'طلب API',
};

/** Human labels for internal codes (presentation-only; backend untouched). */
const LABELS: Record<string, string> = {
  // lifecycle states
  draft: 'Draft',
  registered: 'Registered',
  active: 'Active',
  assigned: 'Assigned',
  in_maintenance: 'In Maintenance',
  transferred: 'Transferred',
  disposed: 'Disposed',
  archived: 'Archived',
  // movement types
  transfer: 'Transfer',
  assignment: 'Assignment',
  return: 'Return',
  maintenance_return: 'Maintenance Return',
  disposal: 'Disposal',
  retirement: 'Retirement',
  // movement status
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  // inventory cycle status
  new: 'New',
  in_progress: 'In Progress',
  closed: 'Closed',
  // inventory record result (computed, ADL-006) — `transferred` shared with lifecycle states above
  matched: 'Matched',
  deficit: 'Deficit',
  surplus: 'Surplus',
  missing: 'Missing',
  not_inventoried: 'Not Counted',
  // audit actions (full backend catalog — audit-events.ts)
  AUTH_LOGIN_SUCCESS: 'Sign-in succeeded',
  AUTH_LOGIN_FAILED: 'Sign-in failed',
  AUTH_LOGOUT: 'Signed out',
  AUTH_TOKEN_REFRESH: 'Token refreshed',
  AUTH_REGISTER: 'Account registered',
  AUTH_PASSWORD_RESET: 'Password reset',
  PERMISSION_GRANTED: 'Permission granted',
  PERMISSION_DENIED: 'Permission denied',
  PERMISSION_CHANGED: 'Permission changed',
  ASSET_CREATED: 'Asset created',
  ASSET_UPDATED: 'Asset updated',
  ASSET_STATUS_CHANGED: 'Asset status changed',
  ASSET_DELETED: 'Asset deleted',
  MOVEMENT_CREATED: 'Movement created',
  MOVEMENT_APPROVED: 'Movement approved',
  MOVEMENT_REJECTED: 'Movement rejected',
  INVENTORY_CREATED: 'Inventory cycle created',
  INVENTORY_STARTED: 'Inventory cycle started',
  INVENTORY_CLOSED: 'Inventory cycle closed',
  INVENTORY_RECORD_VERIFIED: 'Inventory record verified',
  COMPLIANCE_WARNING: 'Compliance warning',
  EXPORT_STARTED: 'Export started',
  EXPORT_COMPLETED: 'Export completed',
  EXPORT_FAILED: 'Export failed',
  SAVED_SEARCH_CREATED: 'Saved search created',
  SAVED_SEARCH_UPDATED: 'Saved search updated',
  SAVED_SEARCH_DELETED: 'Saved search deleted',
  SAVED_SEARCH_EXECUTED: 'Saved search executed',
  API_REQUEST: 'API request',
  // misc
  Uncategorized: 'Uncategorized',
  Unassigned: 'Unassigned',
};

interface I18nContextValue {
  locale: Locale;
  dir: Direction;
  setLocale: (l: Locale) => void;
  /** Translate a stable UI key, falling back to English or the supplied fallback. */
  t: (key: string, fallback?: string) => string;
  /** human label for an internal code, falling back to the raw value */
  label: (code?: string | null) => string;
  /** whether a code is known/humanized (vs raw internal) */
  isKnownLabel: (code?: string | null) => boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Restore the saved preference once on mount. NOTE (P1 fix UX-03): this
  // effect must be the ONLY storage reader-at-boot and nothing may write
  // LANG_KEY during mount — otherwise the mount-effect ordering race
  // (write of the default 'en' before the restore re-reads) destroys the
  // saved preference. Persistence therefore happens only in setLocale
  // (an explicit user gesture), never in the dir-sync effect.
  useEffect(() => {
    const saved = (localStorage.getItem(LANG_KEY) as Locale) || 'en';
    setLocaleState(saved === 'ar' ? 'ar' : 'en');
  }, []);

  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
    setLocaleState(l);
  }, []);
  const dir: Direction = locale === 'ar' ? 'rtl' : 'ltr';

  const t = useCallback((key: string, fallback?: string): string => {
    return TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key] ?? fallback ?? key;
  }, [locale]);

  const label = useCallback((code?: string | null): string => {
    if (!code) return '—';
    return locale === 'ar' ? (AR_LABELS[code] ?? LABELS[code] ?? code) : (LABELS[code] ?? code);
  }, [locale]);

  const isKnownLabel = useCallback((code?: string | null): boolean => !!code && code in LABELS, []);

  const value = useMemo(
    () => ({ locale, dir, setLocale, t, label, isKnownLabel }),
    [locale, dir, setLocale, t, label, isKnownLabel],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Locale-aware date/time formatting (respects the current dir). */
export function formatDateTime(iso?: string | null, locale: Locale = 'en'): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'ar' ? 'ar' : 'en', {
      dateStyle: 'medium', timeStyle: 'short',
    });
  } catch { return iso; }
}

/** Relative time ("3 days ago") — readable timestamps without backend changes. */
export function relativeTime(iso?: string | null, locale: Locale = 'en'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const abs = Math.abs(diffMs);
  const min = Math.round(abs / 60000);
  const hr = Math.round(abs / 3600000);
  const day = Math.round(abs / 86400000);
  const suffix = diffMs >= 0 ? 'ago' : 'from now';
  const unit = locale === 'ar' ? 'منذ' : '';
  if (min < 1) return locale === 'ar' ? 'الآن' : 'just now';
  if (min < 60) return locale === 'ar' ? `${unit} ${min} دقيقة` : `${min}m ${suffix}`;
  if (hr < 24) return locale === 'ar' ? `${unit} ${hr} ساعة` : `${hr}h ${suffix}`;
  if (day < 30) return locale === 'ar' ? `${unit} ${day} يوم` : `${day}d ${suffix}`;
  return formatDateTime(iso, locale);
}

/**
 * Language sent with every export request so the backend prints the report
 * (titles, column labels, direction) in the language the user selected.
 * Read from the same storage key as the I18nProvider; Arabic is the default.
 */
const LANG_KEY = 'assetx.lang.v1';

export type ReportLang = 'ar' | 'en';

export function currentReportLang(): ReportLang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

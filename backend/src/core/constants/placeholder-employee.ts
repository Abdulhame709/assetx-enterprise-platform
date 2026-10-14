/**
 * Imported data can contain a stand-in employee that only means "no custodian"
 * (for example "غير مرتبط بموظف"). Reports must show such assets with an empty
 * custodian cell, and the "no employee" filter must include them.
 * The pattern is a POSIX regular expression usable in SQL (`~*`) and in JS.
 */
export const PLACEHOLDER_EMPLOYEE_PATTERN =
  String.raw`^\s*(غير\s+مرتبط|غير\s+معين|بدون\s+موظف)|^\s*(unassigned|not\s+linked|none)\s*$`;

const PLACEHOLDER_EMPLOYEE_REGEX = new RegExp(PLACEHOLDER_EMPLOYEE_PATTERN, 'i');

export function isPlaceholderEmployee(name: string | null | undefined): boolean {
  return typeof name === 'string' && PLACEHOLDER_EMPLOYEE_REGEX.test(name);
}

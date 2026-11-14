import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

/** Most data rows one Excel import may contain (each row costs several queries). */
export const MAX_IMPORT_ROWS = 5000;

/** An .xlsx file is a ZIP archive and always starts with "PK\x03\x04". */
export function isZipBuffer(buffer: Buffer | Uint8Array): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

/** Reject files that are not real ZIP/XLSX containers before handing them to the parser. */
export function assertXlsxBuffer(buffer: Buffer | Uint8Array): void {
  if (!isZipBuffer(buffer)) throw new BadRequestException('IMPORT_FILE_INVALID');
}

/** Reject worksheets with more data rows than the import limit (row 1 is the header). */
export function assertImportRowCount(sheetRowCount: number): void {
  if (sheetRowCount - 1 > MAX_IMPORT_ROWS) throw new PayloadTooLargeException('IMPORT_TOO_MANY_ROWS');
}

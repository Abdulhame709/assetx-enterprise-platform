/**
 * Report Template entities — presentation-only layout for reports.
 * Templates describe ONLY presentation; no business logic, SQL, filtering,
 * grouping, or aggregation (those remain in ReportBuilderService).
 * Reference: Task T6 (approved scope)
 */

export type PageOrientation = 'portrait' | 'landscape';
export type PageSize = 'A4' | 'A3' | 'LETTER' | 'LEGAL';

export interface Typography {
  fontFamily?: string;
  titleSize?: number;
  headingSize?: number;
  bodySize?: number;
  tableSize?: number;
  footerSize?: number;
}

export interface ColorPalette {
  primary?: string;
  secondary?: string;
  headerBg?: string;
  headerFg?: string;
  rowEven?: string;
  rowOdd?: string;
  title?: string;
  subtitle?: string;
}

export interface MarginSettings {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface PageSettings {
  orientation?: PageOrientation;
  size?: PageSize;
  margins?: MarginSettings;
  /** page break after each section/group (future), or row threshold */
  breakAfterRows?: number;
}

export interface CellStyle {
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
  color?: string;
  bold?: boolean;
}

export interface TableStyle {
  headerStyle?: CellStyle;
  cellStyle?: CellStyle;
  alternatingRowColors?: boolean;
  rowHeight?: number;
  columnAlignments?: Record<string, CellStyle['align']>;
}

export interface TemplateHeader {
  /** company logo placeholder (URL/key) — future extension */
  logoPlaceholder?: string;
  title?: string;
  showGeneratedAt?: boolean;
  userPlaceholder?: boolean;
  organizationPlaceholder?: boolean;
}

export interface TemplateFooter {
  showPageNumbers?: boolean;
  text?: string;
}

export interface TemplateSection {
  /** cover | header | body | footer | future: charts/images/signatures/watermarks/qr/barcode/digitalsig */
  type: string;
  order: number;
  /** future extension point */
  config?: Record<string, unknown>;
}

export interface TemplateMetadata {
  name?: string;
  version?: number;
  description?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  typography?: Typography;
  colors?: ColorPalette;
  page?: PageSettings;
  table?: TableStyle;
  header?: TemplateHeader;
  footer?: TemplateFooter;
  sections?: TemplateSection[];
  metadata?: TemplateMetadata;
}

// Future extension-point placeholders (NOT implemented):
// charts, images, signatures, watermarks, qrCode, barcode, digitalSignature
export const TEMPLATE_FUTURE_SECTIONS = [
  'chart', 'image', 'signature', 'watermark', 'qrCode', 'barcode', 'digitalSignature',
] as const;

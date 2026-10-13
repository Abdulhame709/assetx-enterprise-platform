/**
 * DashboardExportProvider — fetches dashboard analytics for export.
 * Knows only its own data source (ReportingService). The analytics are nested
 * objects, so they are flattened into plain "section / metric / value" rows that
 * every format (CSV, XLSX, PDF) can render.
 * Reference: Phase 11.3
 */
import { Injectable } from '@nestjs/common';
import { ReportingService } from '../../reporting.service';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';

const SECTION_AR: Record<string, string> = {
  assets: 'الأصول',
  movements: 'الحركات',
  inventory: 'الجرد',
  aging: 'أعمار الأصول',
};

const METRIC_AR: Record<string, string> = {
  total_assets: 'إجمالي الأصول',
  active_assets: 'الأصول النشطة',
  inactive_assets: 'الأصول غير النشطة',
  under_maintenance: 'تحت الصيانة',
  retired: 'خارج الخدمة / تالف',
  total_value: 'القيمة الإجمالية للأصول النشطة',
  total_movements: 'إجمالي الحركات',
  pending: 'قيد الاعتماد',
  approved: 'معتمدة',
  rejected: 'مرفوضة',
  expected: 'المتوقع جرده',
  inventoried: 'تم جرده',
  matched: 'مطابق',
  missing: 'مفقود',
  surplus: 'زيادة',
  deficit: 'عجز',
  transferred: 'منقول',
  not_inventoried: 'غير مُجرّد',
  completion: 'نسبة الإنجاز %',
  match_rate: 'نسبة المطابقة %',
  avg_age: 'متوسط العمر (سنة)',
  high_value: 'أصول عالية القيمة',
  near_replacement: 'قريبة من الاستبدال',
};

const GROUP_AR: Record<string, string> = {
  status_distribution: 'الحالة',
  by_type: 'نوع الحركة',
  top_locations: 'أكثر المواقع استقبالاً',
  top_departments: 'أكثر الأقسام استقبالاً',
};

interface MetricRow {
  section: string;
  metric: string;
  value: string | number;
}

@Injectable()
export class DashboardExportProvider implements ExportProvider {
  readonly resource = 'dashboard';

  constructor(private readonly reporting: ReportingService) {}

  async getData(tenantId: string, _options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    const [assets, movements, inventory, aging] = await Promise.all([
      this.reporting.getAssetDashboard(tenantId),
      this.reporting.getMovementAnalytics(tenantId),
      this.reporting.getInventoryAnalytics(tenantId),
      this.reporting.getAssetAging(tenantId),
    ]);
    const rows: MetricRow[] = [
      ...this.flatten('assets', assets as unknown as Record<string, unknown>),
      ...this.flatten('movements', movements as unknown as Record<string, unknown>),
      ...this.flatten('inventory', inventory as unknown as Record<string, unknown>),
      ...this.flatten('aging', {
        total_assets: aging.total_assets,
        avg_age: aging.avg_age,
        high_value: aging.high_value,
        near_replacement: aging.near_replacement,
      }),
    ];
    return { rows, total: rows.length };
  }

  private flatten(section: string, data: Record<string, unknown>): MetricRow[] {
    const out: MetricRow[] = [];
    const sectionLabel = SECTION_AR[section] ?? section;
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        // distributions: [{ name|movement_type|department, count }]
        for (const item of value as Record<string, unknown>[]) {
          const label = String(item.name ?? item.movement_type ?? item.department ?? '');
          out.push({ section: sectionLabel, metric: `${GROUP_AR[key] ?? key}: ${label}`, value: Number(item.count ?? 0) });
        }
      } else if (value && typeof value === 'object') {
        // last_cycle: { id, year, status }
        const cycle = value as Record<string, unknown>;
        if (cycle.year !== undefined) out.push({ section: sectionLabel, metric: 'سنة آخر دورة جرد', value: Number(cycle.year) });
        if (cycle.status !== undefined) out.push({ section: sectionLabel, metric: 'حالة آخر دورة جرد', value: String(cycle.status) });
      } else if (value !== null && value !== undefined) {
        out.push({ section: sectionLabel, metric: METRIC_AR[key] ?? key, value: value as string | number });
      }
    }
    return out;
  }
}

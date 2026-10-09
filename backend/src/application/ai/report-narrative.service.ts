import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { ReportingService } from '../reporting.service';
import { AUDIT_EVENTS } from '../../core/constants/audit-events';
import { AiTextPort } from '../../core/ports/ai-text.port';
import { AI_TEXT_PORT } from '../../core/ports/tokens';

export type AiReportResource = 'assets' | 'dashboard';
export type AiSummarySource = 'llm' | 'deterministic';

export interface ReportNarrativeRequest {
  resource: AiReportResource;
}

export interface ReportNarrative {
  source: AiSummarySource;
  provider: string;
  model: string | null;
  summary: string;
  key_findings: string[];
  warnings: string[];
  confidence: number;
  evidence: string[];
  generated_at: string;
}

interface AssetEvidence {
  resource: AiReportResource;
  total_assets: number;
  active_assets: number;
  inactive_assets: number;
  under_maintenance: number;
  retired: number;
  total_value: number;
  status_distribution: Array<{ name: string; count: number }>;
}

interface NarrativePayload {
  summary: unknown;
  key_findings: unknown;
  warnings: unknown;
  confidence: unknown;
  evidence: unknown;
}

@Injectable()
export class ReportNarrativeService {
  constructor(
    private readonly reporting: ReportingService,
    private readonly audit: AuditService,
    @Inject(AI_TEXT_PORT) private readonly ai: AiTextPort,
  ) {}

  async generate(resource: AiReportResource, tenantId: string, userId: string): Promise<ReportNarrative> {
    const evidence = await this.loadEvidence(resource, tenantId);
    const deterministic = this.deterministicNarrative(evidence);
    let narrative = deterministic;

    if (this.ai.isAvailable()) {
      try {
        const response = await this.ai.complete({
          messages: [
            {
              role: 'system',
              content: [
                'أنت مساعد تقارير مؤسسية عربي دقيق.',
                'حلل بيانات JSON المرفقة فقط ولا تخترع أرقاماً أو كيانات.',
                'أعد JSON مطابقاً للمخطط المطلوب، واجعل النص واضحاً ومختصراً.',
                'لا تقترح تعديلاً تلقائياً على الأصول أو الحركات.',
              ].join(' '),
            },
            {
              role: 'user',
              content: `بيانات التقرير الموثوقة:\n${JSON.stringify(evidence)}`,
            },
          ],
          maxTokens: 900,
          responseFormat: {
            name: 'assetx_report_narrative',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                key_findings: { type: 'array', items: { type: 'string' }, maxItems: 5 },
                warnings: { type: 'array', items: { type: 'string' }, maxItems: 5 },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                evidence: { type: 'array', items: { type: 'string' }, maxItems: 8 },
              },
              required: ['summary', 'key_findings', 'warnings', 'confidence', 'evidence'],
              additionalProperties: false,
            },
          },
        });
        const parsed = this.parseNarrative(response.content);
        if (parsed) {
          narrative = {
            ...parsed,
            source: 'llm',
            provider: response.provider,
            model: response.model,
            generated_at: new Date().toISOString(),
          };
        }
      } catch {
        // The deterministic narrative is the safe fallback and is returned to the user.
      }
    }

    await this.audit.log({
      tenant_id: tenantId,
      userId,
      action: AUDIT_EVENTS.AI_REPORT_SUMMARY_GENERATED,
      entity: 'report',
      metadata: {
        resource,
        source: narrative.source,
        provider: narrative.provider,
        model: narrative.model,
        confidence: narrative.confidence,
      },
    }).catch(() => undefined);

    return narrative;
  }

  private async loadEvidence(resource: AiReportResource, tenantId: string): Promise<AssetEvidence> {
    const dashboard = await this.reporting.getAssetDashboard(tenantId);
    return {
      resource,
      total_assets: this.safeCount(dashboard.total_assets),
      active_assets: this.safeCount(dashboard.active_assets),
      inactive_assets: this.safeCount(dashboard.inactive_assets),
      under_maintenance: this.safeCount(dashboard.under_maintenance),
      retired: this.safeCount(dashboard.retired),
      total_value: this.safeNumber(dashboard.total_value),
      status_distribution: (dashboard.status_distribution ?? [])
        .slice(0, 10)
        .map((item) => ({ name: String(item.name).slice(0, 80), count: this.safeCount(item.count) })),
    };
  }

  private deterministicNarrative(evidence: AssetEvidence): ReportNarrative {
    const activeRate = evidence.total_assets > 0
      ? Math.round((evidence.active_assets / evidence.total_assets) * 100)
      : 0;
    const summary = evidence.total_assets === 0
      ? 'لا توجد أصول مسجلة حالياً ضمن نطاق الجهة لعرض ملخص تشغيلي.'
      : `يبلغ إجمالي الأصول ${this.formatNumber(evidence.total_assets)}، منها ${this.formatNumber(evidence.active_assets)} أصل نشط بنسبة ${activeRate}%. وتبلغ القيمة المسجلة ${this.formatNumber(evidence.total_value)}.`;
    const keyFindings = [
      `الأصول النشطة: ${this.formatNumber(evidence.active_assets)} (${activeRate}%).`,
      `الأصول قيد الصيانة: ${this.formatNumber(evidence.under_maintenance)}.`,
      `الأصول المتقاعدة: ${this.formatNumber(evidence.retired)}.`,
    ];
    const warnings = evidence.under_maintenance > 0
      ? [`يوجد ${this.formatNumber(evidence.under_maintenance)} أصل قيد الصيانة ويستحسن مراجعة أوامرها المفتوحة.`]
      : [];
    return {
      source: 'deterministic',
      provider: 'assetx-rules',
      model: null,
      summary,
      key_findings: keyFindings,
      warnings,
      confidence: 1,
      evidence: [
        `total_assets=${evidence.total_assets}`,
        `active_assets=${evidence.active_assets}`,
        `under_maintenance=${evidence.under_maintenance}`,
        `total_value=${evidence.total_value}`,
      ],
      generated_at: new Date().toISOString(),
    };
  }

  private parseNarrative(value: string): Omit<ReportNarrative, 'source' | 'provider' | 'model' | 'generated_at'> | null {
    let parsed: NarrativePayload;
    try {
      parsed = JSON.parse(value) as NarrativePayload;
    } catch {
      return null;
    }
    if (
      typeof parsed.summary !== 'string'
      || !Array.isArray(parsed.key_findings)
      || !Array.isArray(parsed.warnings)
      || !Array.isArray(parsed.evidence)
      || typeof parsed.confidence !== 'number'
      || !Number.isFinite(parsed.confidence)
    ) return null;
    const textArray = (items: unknown[]) => items
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 8);
    const keyFindings = textArray(parsed.key_findings);
    const warnings = textArray(parsed.warnings);
    const evidence = textArray(parsed.evidence);
    if (!keyFindings.length && !warnings.length) return null;
    return {
      summary: parsed.summary.trim().slice(0, 1_000),
      key_findings: keyFindings,
      warnings,
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
      evidence,
    };
  }

  private safeCount(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
  }

  private safeNumber(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(value);
  }
}

import { ReportNarrativeService } from '../src/application/ai/report-narrative.service';
import { AiTextPort } from '../src/core/ports/ai-text.port';
import { AuditService } from '../src/application/audit.service';
import { ReportingService } from '../src/application/reporting.service';

describe('ReportNarrativeService', () => {
  const reporting = {
    getAssetDashboard: jest.fn(),
  } as unknown as ReportingService;
  const audit = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const ai = {
    isAvailable: jest.fn(),
    complete: jest.fn(),
  } as unknown as AiTextPort;
  let service: ReportNarrativeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportNarrativeService(reporting, audit, ai);
    reporting.getAssetDashboard = jest.fn().mockResolvedValue({
      total_assets: 10,
      active_assets: 8,
      inactive_assets: 2,
      under_maintenance: 1,
      retired: 1,
      total_value: 25000,
      status_distribution: [{ name: 'نشط', count: 8 }],
    });
    ai.isAvailable = jest.fn().mockReturnValue(false);
  });

  it('returns a safe deterministic summary when the provider is disabled', async () => {
    const result = await service.generate('assets', '11111111-1111-4111-8111-111111111111', 'user-1');

    expect(result).toMatchObject({ source: 'deterministic', provider: 'assetx-rules', model: null, confidence: 1 });
    expect(result.summary).toContain('١٠');
    expect(ai.complete).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'AI_REPORT_SUMMARY_GENERATED',
      entity: 'report',
      metadata: expect.objectContaining({ source: 'deterministic', resource: 'assets' }),
    }));
  });

  it('accepts only the validated structured response from an available provider', async () => {
    ai.isAvailable = jest.fn().mockReturnValue(true);
    ai.complete = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'توجد نسبة نشاط مرتفعة.',
        key_findings: ['8 أصول نشطة.'],
        warnings: [],
        confidence: 0.92,
        evidence: ['active_assets=8'],
      }),
      model: 'test-model',
      provider: 'test-provider',
    });

    const result = await service.generate('dashboard', '11111111-1111-4111-8111-111111111111', 'user-1');

    expect(result).toMatchObject({ source: 'llm', provider: 'test-provider', model: 'test-model', confidence: 0.92 });
    expect(result.summary).toBe('توجد نسبة نشاط مرتفعة.');
  });

  it('falls back when the provider returns invalid structured content', async () => {
    ai.isAvailable = jest.fn().mockReturnValue(true);
    ai.complete = jest.fn().mockResolvedValue({ content: 'not-json', model: 'test-model', provider: 'test-provider' });

    const result = await service.generate('assets', '11111111-1111-4111-8111-111111111111', 'user-1');

    expect(result.source).toBe('deterministic');
    expect(result.provider).toBe('assetx-rules');
  });
});

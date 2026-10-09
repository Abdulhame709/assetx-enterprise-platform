import { createHarness, Harness } from './support/db.harness';
import { ReportDefinition } from '../src/core/entities/report.entity';
import { SavedReportTemplateRepository } from '../src/infrastructure/repositories/saved-report-template.repository';
import { SavedReportTemplateService } from '../src/application/saved-report-template.service';

const definition: ReportDefinition = {
  id: 'asset-summary',
  name: 'Asset summary',
  resource: 'assets',
  format: 'csv',
  columns: [{ field: 'name' }, { field: 'status_id' }],
  sorting: [{ field: 'name', dir: 'asc' }],
};

describe('Report template sharing — integration', () => {
  let h: Harness;
  let service: SavedReportTemplateService;
  let ownerId: string;
  let peerId: string;
  let otherTenantUserId: string;

  beforeAll(async () => {
    h = await createHarness();
    const owner = await h.auth.register({ tenantId: h.tenantA, username: 'template_owner', password: 'Pass123456' });
    const peer = await h.auth.register({ tenantId: h.tenantA, username: 'template_peer', password: 'Pass123456' });
    const other = await h.auth.register({ tenantId: h.tenantB, username: 'template_other', password: 'Pass123456' });
    ownerId = owner.user.id;
    peerId = peer.user.id;
    otherTenantUserId = other.user.id;
    service = new SavedReportTemplateService(new SavedReportTemplateRepository(h.db), h.db, h.reportBuilder, h.audit);
  });

  it('keeps private templates visible only to their creator', async () => {
    const created = await service.create(h.tenantA, ownerId, {
      name: 'Private asset summary',
      resource: 'assets',
      format: 'csv',
      definition,
    });
    expect(created.is_shared).toBe(false);
    expect((await service.list(h.tenantA, ownerId)).map((item) => item.id)).toContain(created.id);
    expect((await service.list(h.tenantA, peerId)).map((item) => item.id)).not.toContain(created.id);
    await expect(service.getById(h.tenantA, peerId, created.id)).rejects.toThrow('REPORT_TEMPLATE_NOT_FOUND');
  });

  it('shares a template with users in the same tenant but not another tenant', async () => {
    const shared = await service.create(h.tenantA, ownerId, {
      name: 'Shared asset summary',
      resource: 'assets',
      format: 'xlsx',
      definition: { ...definition, format: 'xlsx' },
      is_shared: true,
    });
    expect((await service.list(h.tenantA, peerId)).map((item) => item.id)).toContain(shared.id);
    expect((await service.list(h.tenantB, otherTenantUserId)).map((item) => item.id)).not.toContain(shared.id);
  });

  it('allows only the creator to update or delete a shared template', async () => {
    const shared = (await service.list(h.tenantA, ownerId)).find((item) => item.name === 'Shared asset summary');
    expect(shared).toBeDefined();
    await expect(service.update(h.tenantA, peerId, shared!.id, { name: 'Peer rename' })).rejects.toThrow('REPORT_TEMPLATE_NOT_FOUND');
    const updated = await service.update(h.tenantA, ownerId, shared!.id, { name: 'Renamed shared summary', is_shared: false });
    expect(updated.version).toBeGreaterThan(shared!.version);
    expect((await service.list(h.tenantA, peerId)).map((item) => item.id)).not.toContain(shared!.id);
    await expect(service.remove(h.tenantA, peerId, shared!.id)).rejects.toThrow('REPORT_TEMPLATE_NOT_FOUND');
    await service.remove(h.tenantA, ownerId, shared!.id);
    await expect(service.getById(h.tenantA, ownerId, shared!.id)).rejects.toThrow('REPORT_TEMPLATE_NOT_FOUND');
  });
});

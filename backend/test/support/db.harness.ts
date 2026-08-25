/**
 * Test harness — boots a real PGlite (PostgreSQL) instance, applies the verified
 * migration + seed, and returns an in-memory database with helper factories.
 * Reference: db/migrations/001_init.sql · db/seed/001_seed.sql
 */
import { PGlite } from '@electric-sql/pglite';
import { PGliteDatabase } from '../../src/infrastructure/database/pglite.database';
import { BcryptHasher } from '../../src/infrastructure/auth/bcrypt.hasher';
import { JwtTokenManager } from '../../src/infrastructure/auth/jwt.token-manager';
import { UserRepository } from '../../src/infrastructure/repositories/user.repository';
import { AuthService } from '../../src/application/auth.service';
import { UsersService } from '../../src/application/users.service';
import { AssetRepository } from '../../src/infrastructure/repositories/asset.repository';
import { AssetService } from '../../src/application/asset.service';
import { LocationRepository } from '../../src/infrastructure/repositories/location.repository';
import { LocationTypeRepository } from '../../src/infrastructure/repositories/location-type.repository';
import { LocationService } from '../../src/application/location.service';
import { LocationTypeService } from '../../src/application/location-type.service';
import { CategoryRepository } from '../../src/infrastructure/repositories/category.repository';
import { CategoryService } from '../../src/application/category.service';
import { ModelRepository } from '../../src/infrastructure/repositories/model.repository';
import { ModelService } from '../../src/application/model.service';
import { EmployeeRepository } from '../../src/infrastructure/repositories/employee.repository';
import { EmployeeService } from '../../src/application/employee.service';
import { CycleRepository } from '../../src/infrastructure/repositories/cycle.repository';
import { RecordRepository } from '../../src/infrastructure/repositories/record.repository';
import { ResultRepository } from '../../src/infrastructure/repositories/result.repository';
import { CycleService } from '../../src/application/cycle.service';
import { RecordService } from '../../src/application/record.service';
import { InventoryResultService } from '../../src/application/inventory-result.service';
import { MovementRepository } from '../../src/infrastructure/repositories/movement.repository';
import { MovementService } from '../../src/application/movement.service';
import { MaintenanceRepository } from '../../src/infrastructure/repositories/maintenance.repository';
import { MaintenanceService } from '../../src/application/maintenance.service';
import { ReportingRepository } from '../../src/infrastructure/repositories/reporting.repository';
import { ReportingService } from '../../src/application/reporting.service';
import { seedPermissions } from '../../src/bootstrap/permission-seed';
import { seedNotificationTemplates } from '../../src/bootstrap/notification-seed';
import { AuditRepository } from '../../src/infrastructure/repositories/audit.repository';
import { AuditService } from '../../src/application/audit.service';
import { ComplianceService } from '../../src/application/compliance.service';
import { EventBus } from '../../src/core/events/event-bus';
import { NotificationRepository } from '../../src/infrastructure/repositories/notification.repository';
import { NotificationService } from '../../src/application/notification.service';
import { TemplateRenderer } from '../../src/application/template-renderer.service';
import { SSEManager } from '../../src/common/sse/sse-manager';
import { RealtimeService } from '../../src/application/realtime.service';
import { CsvGenerator } from '../../src/infrastructure/export/csv.generator';
import { ExcelGenerator } from '../../src/infrastructure/export/excel.generator';
import { PdfGenerator } from '../../src/infrastructure/export/pdf.generator';
import { FileGeneratorFactory } from '../../src/infrastructure/export/file-generator.factory';
import { ExportDataAdapter } from '../../src/application/export/adapters/export-data.adapter';
import { AssetsExportProvider } from '../../src/application/export/providers/assets-export.provider';
import { MovementsExportProvider } from '../../src/application/export/providers/movements-export.provider';
import { InventoryExportProvider } from '../../src/application/export/providers/inventory-export.provider';
import { AuditExportProvider } from '../../src/application/export/providers/audit-export.provider';
import { DashboardExportProvider } from '../../src/application/export/providers/dashboard-export.provider';
import { ExportService } from '../../src/application/export.service';
import { ExportPipelineService } from '../../src/application/export/export-pipeline.service';
import { ExportProfileRegistry } from '../../src/application/export/export-profile.registry';
import { ExportMetricsService } from '../../src/application/export/export-metrics.service';
import { CsvExportStrategy } from '../../src/infrastructure/export/strategies/csv-export.strategy';
import { ExcelExportStrategy } from '../../src/infrastructure/export/strategies/excel-export.strategy';
import { PdfExportStrategy } from '../../src/infrastructure/export/strategies/pdf-export.strategy';
import { ExportStrategyFactory } from '../../src/infrastructure/export/strategies/export-strategy.factory';
import { AssetLifecycleStateMachineService } from '../../src/application/lifecycle-state-machine.service';
import { LifecycleReadService } from '../../src/application/lifecycle-read.service';
import { AssetAnalyticsService } from '../../src/application/asset-analytics.service';
import { LifecycleStateConfig } from '../../src/application/lifecycle/lifecycle-state.config';
import { AssetLifecycleSnapshotAdapter } from '../../src/application/lifecycle/asset-lifecycle-snapshot.adapter';
import { LifecycleEventService } from '../../src/application/lifecycle/lifecycle-event.service';
import { LifecycleEventSubscriber } from '../../src/application/lifecycle/lifecycle-event.subscriber';
import { WorkflowEngineService } from '../../src/application/workflow-engine.service';
import { BusinessRulesEngineService } from '../../src/application/business-rules-engine.service';
import { SearchQueryBuilder } from '../../src/application/search/search-query-builder';
import { AssetsSearchProvider } from '../../src/application/search/providers/assets-search.provider';
import { MovementsSearchProvider } from '../../src/application/search/providers/movements-search.provider';
import { AuditSearchProvider } from '../../src/application/search/providers/audit-search.provider';
import { SearchService } from '../../src/application/search.service';
import { SavedSearchRepository } from '../../src/infrastructure/repositories/saved-search.repository';
import { SavedSearchService } from '../../src/application/saved-search.service';
import { IntegrityCheckerService } from '../../src/application/integrity-checker.service';
import { ScheduledReportService } from '../../src/application/scheduled-report.service';
import { ReportBuilderService } from '../../src/application/report-builder.service';
import { ReportTemplateService } from '../../src/application/report-template.service';
import { AnalyticsService } from '../../src/application/analytics.service';
import * as fs from 'fs';
import * as path from 'path';

export interface Harness {
  db: PGliteDatabase;
  repo: UserRepository;
  auth: AuthService;
  users: UsersService;
  tokens: JwtTokenManager;
  hasher: BcryptHasher;
  assetRepo: AssetRepository;
  assets: AssetService;
  locations: LocationService;
  locationTypes: LocationTypeService;
  categories: CategoryService;
  models: ModelService;
  employees: EmployeeService;
  cycles: CycleService;
  records: RecordService;
  inventoryResult: InventoryResultService;
  movements: MovementService;
  maintenance: MaintenanceService;
  reporting: ReportingService;
  audit: AuditService;
  compliance: ComplianceService;
  integrity: IntegrityCheckerService;
  notificationService: NotificationService;
  realtime: RealtimeService;
  sse: SSEManager;
  bus: EventBus;
  exportService: ExportService;
  exportStrategyFactory: ExportStrategyFactory;
  exportProfiles: ExportProfileRegistry;
  exportMetrics: ExportMetricsService;
  exportPipeline: ExportPipelineService;
  lifecycle: AssetLifecycleStateMachineService;
  lifecycleConfig: LifecycleStateConfig;
  lifecycleAdapter: AssetLifecycleSnapshotAdapter;
  lifecycleRead: LifecycleReadService;
  assetAnalytics: AssetAnalyticsService;
  lifecycleEvents: LifecycleEventService;
  workflow: WorkflowEngineService;
  rules: BusinessRulesEngineService;
  scheduledReports: ScheduledReportService;
  reportBuilder: ReportBuilderService;
  reportTemplates: ReportTemplateService;
  analytics: AnalyticsService;
  searchService: SearchService;
  savedSearches: SavedSearchService;
  tenantA: string;
  tenantB: string;
  /** Reference data for tenant A: statuses/locations/categories used by asset tests. */
  refA: { status: string; location: string; category: string };
  refB: { status: string; location: string; category: string };
}

const ACCESS = 'test-access-secret';
const REFRESH = 'test-refresh-secret';

export async function createHarness(): Promise<Harness> {
  const pg = new PGlite();
  const db = new PGliteDatabase(pg);

  const migrationsDir = path.resolve(__dirname, '../../../db/migrations');
  const migration001 = fs.readFileSync(path.join(migrationsDir, '001_init.sql'), 'utf8');
  await db.exec(migration001);
  const migration002 = fs.readFileSync(path.join(migrationsDir, '002_movement_lifecycle.sql'), 'utf8');
  await db.exec(migration002);
  const migration003 = fs.readFileSync(path.join(migrationsDir, '003_saved_searches.sql'), 'utf8');
  await db.exec(migration003);
  const migration004 = fs.readFileSync(path.join(migrationsDir, '004_password_reset_tokens.sql'), 'utf8');
  await db.exec(migration004);

  // Create a non-owner 'authenticated' role and grant table access.
  // This mirrors the Supabase production model where the API connects as a
  // non-owner role, so Row-Level Security actually applies (owner bypasses RLS).
  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
    END $$;
  `);
  const migration005 = fs.readFileSync(path.join(migrationsDir, '005_authenticate_user_function.sql'), 'utf8');
  await db.exec(migration005);
  const migration006 = fs.readFileSync(path.join(migrationsDir, '006_auth_sessions.sql'), 'utf8');
  await db.exec(migration006);
  const migration007 = fs.readFileSync(path.join(migrationsDir, '007_runtime_grants.sql'), 'utf8');
  await db.exec(migration007);
  const migration008 = fs.readFileSync(path.join(migrationsDir, '008_maintenance_orders_workflow.sql'), 'utf8');
  await db.exec(migration008);
  const migration009 = fs.readFileSync(path.join(migrationsDir, '009_inventory_missing_movement.sql'), 'utf8');
  await db.exec(migration009);
  const migration010 = fs.readFileSync(path.join(migrationsDir, '010_report_templates.sql'), 'utf8');
  await db.exec(migration010);
  const migration011 = fs.readFileSync(path.join(migrationsDir, '011_hierarchy_integrity.sql'), 'utf8');
  await db.exec(migration011);
  // Tenants must exist before migration 012 seeds the standard catalog.
  await db.exec(`
    INSERT INTO tenants (tenant_code, name, status)
    VALUES ('tenant_a','Tenant A','active'), ('tenant_b','Tenant B','active')
    ON CONFLICT (tenant_code) DO NOTHING;
  `);
  const migration012 = fs.readFileSync(path.join(migrationsDir, '012_location_types_catalog.sql'), 'utf8');
  await db.exec(migration012);
  await db.exec(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      tenants, organizations, employees, users, roles, permissions, role_permissions,
      user_roles, user_permissions, password_reset_tokens, asset_categories, asset_models, statuses,
      locations, assets, asset_movements, maintenance_orders, inventory_cycles,
      inventory_team, inventory_records, audit_events, notification_templates,
      notifications, report_templates, location_types TO authenticated;
    GRANT EXECUTE ON FUNCTION authenticate_user(text) TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON auth_sessions TO authenticated;
    GRANT USAGE ON SCHEMA public TO authenticated;
  `);

  // Seed reference data for two tenants (as owner — RLS bypassed during setup)
  await db.exec(
    `INSERT INTO tenants (tenant_code, name, status) VALUES ('tenant_a','Tenant A','active'), ('tenant_b','Tenant B','active') ON CONFLICT (tenant_code) DO NOTHING;`,
  );
  const { rows: tenants } = await db.query<{ id: string; tenant_code: string }>(
    `SELECT id, tenant_code FROM tenants;`,
  );
  const tenantA = tenants.find((t) => t.tenant_code === 'tenant_a')!.id;
  const tenantB = tenants.find((t) => t.tenant_code === 'tenant_b')!.id;

  // Seed roles + reference data for each tenant (owner context, RLS not applied)
  for (const tid of [tenantA, tenantB]) {
    await db.exec(
      `INSERT INTO roles (tenant_id, name, role_type) VALUES
         ('${tid}','Administrator','admin'),
         ('${tid}','Asset Manager','manager'),
         ('${tid}','Auditor','auditor'),
         ('${tid}','Department Manager','manager'),
         ('${tid}','Inventory Team','field'),
         ('${tid}','Maintenance','maintenance'),
         ('${tid}','Employee','employee');
       INSERT INTO statuses (tenant_id, name, color) VALUES
         ('${tid}','Good','#27ae60'),
         ('${tid}','Maintenance','#e67e22')
       ON CONFLICT (tenant_id, name) DO NOTHING;
       INSERT INTO locations (tenant_id, name, path, full_path, level_number)
         VALUES ('${tid}','HQ','hq','HQ',0);
       INSERT INTO asset_categories (tenant_id, name) VALUES ('${tid}','IT');`,
    );
  }

  async function refFor(tid: string) {
    const status = (await db.query<{ id: string }>(`SELECT id FROM statuses WHERE tenant_id='${tid}' LIMIT 1`)).rows[0].id;
    const location = (await db.query<{ id: string }>(`SELECT id FROM locations WHERE tenant_id='${tid}' LIMIT 1`)).rows[0].id;
    const category = (await db.query<{ id: string }>(`SELECT id FROM asset_categories WHERE tenant_id='${tid}' LIMIT 1`)).rows[0].id;
    return { status, location, category };
  }
  const refA = await refFor(tenantA);
  const refB = await refFor(tenantB);

  // Seed permission catalog (flat keys → roles) + notification templates.
  await seedPermissions(db, tenantA);
  await seedPermissions(db, tenantB);
  await seedNotificationTemplates(db, tenantA);
  await seedNotificationTemplates(db, tenantB);

  // Act as the authenticated role for all subsequent (app) queries.
  await db.exec(`SET ROLE authenticated;`);

  const hasher = new BcryptHasher();
  const tokens = new JwtTokenManager(ACCESS, REFRESH);
  const repo = new UserRepository(db);
  const audit = new AuditService(new AuditRepository(db), db);
  const bus = new EventBus();
  const notificationService = new NotificationService(bus, new NotificationRepository(db), db, new TemplateRenderer());
  await notificationService.onModuleInit();
  const sse = new SSEManager();
  const realtime = new RealtimeService(bus, sse);
  const auth = new AuthService(db, repo, hasher, tokens, audit);
  const users = new UsersService(repo);
  const assetRepo = new AssetRepository(db);
  const assets = new AssetService(assetRepo, db, audit, bus);
  const locationTypes = new LocationTypeService(new LocationTypeRepository(db), db, audit);
  const locations = new LocationService(new LocationRepository(db), new LocationTypeRepository(db), db);
  const categories = new CategoryService(new CategoryRepository(db), db, audit);
  const models = new ModelService(new ModelRepository(db), db);
  const employees = new EmployeeService(new EmployeeRepository(db), db);
  const cycleRepo = new CycleRepository(db);
  const recordRepo = new RecordRepository(db);
  const resultRepo = new ResultRepository(db);
  const cycles = new CycleService(cycleRepo, recordRepo, db, audit, bus);
  const records = new RecordService(cycleRepo, recordRepo, db);
  const inventoryResult = new InventoryResultService(cycleRepo, resultRepo, db);
  const movements = new MovementService(new MovementRepository(db), assetRepo, db, audit, bus);
  const maintenance = new MaintenanceService(new MaintenanceRepository(db), db, audit);
  const reporting = new ReportingService(new ReportingRepository(db), db);
  const compliance = new ComplianceService(db, audit, bus);
  const csvStrategy = new CsvExportStrategy(new CsvGenerator());
  const excelStrategy = new ExcelExportStrategy(new ExcelGenerator());
  const pdfStrategy = new PdfExportStrategy(new PdfGenerator());
  const exportStrategyFactory = new ExportStrategyFactory([csvStrategy, excelStrategy, pdfStrategy]);
  const exportProfiles = new ExportProfileRegistry();
  const exportMetrics = new ExportMetricsService();
  const reportBuilder = new ReportBuilderService();
  const exportPipeline = new ExportPipelineService(bus, exportMetrics, new ExportDataAdapter(), reportBuilder);
  const exportService = new ExportService(
    exportStrategyFactory,
    exportPipeline,
    exportProfiles,
    exportMetrics,
    audit,
    bus,
    [
      new AssetsExportProvider(assetRepo),
      new MovementsExportProvider(new MovementRepository(db)),
      new InventoryExportProvider(inventoryResult),
      new AuditExportProvider(new AuditRepository(db)),
      new DashboardExportProvider(reporting),
    ],
  );

  const searchService = new SearchService(
    new SearchQueryBuilder(),
    db,
    [
      new AssetsSearchProvider(assetRepo),
      new MovementsSearchProvider(new MovementRepository(db)),
      new AuditSearchProvider(new AuditRepository(db)),
    ],
  );
  const savedSearches = new SavedSearchService(new SavedSearchRepository(db), db, audit);
  const integrity = new IntegrityCheckerService(db);
  const lifecycleConfig = new LifecycleStateConfig();
  const lifecycle = new AssetLifecycleStateMachineService(lifecycleConfig);
  const lifecycleAdapter = new AssetLifecycleSnapshotAdapter(db);
  const lifecycleEvents = new LifecycleEventService(bus);
  const lifecycleSubscriber = new LifecycleEventSubscriber(bus, lifecycle, lifecycleAdapter, lifecycleEvents);
  lifecycleSubscriber.onModuleInit();
  const lifecycleRead = new LifecycleReadService(lifecycle, lifecycleAdapter);
  const assetAnalytics = new AssetAnalyticsService(db);
  const workflow = new WorkflowEngineService();
  const rules = new BusinessRulesEngineService();
  const scheduledReports = new ScheduledReportService(exportService, bus);
  const reportTemplates = new ReportTemplateService();
  const analytics = new AnalyticsService();

  return { db, repo, auth, users, tokens, hasher, assetRepo, assets,     locations, locationTypes, categories, models, employees, cycles, records, inventoryResult, movements, maintenance, reporting, audit, compliance, integrity,
 notificationService, realtime, sse, bus, exportService, exportStrategyFactory, exportProfiles, exportMetrics, exportPipeline, lifecycle, lifecycleConfig, lifecycleAdapter, lifecycleRead, assetAnalytics, lifecycleEvents, workflow, rules, scheduledReports, reportBuilder, reportTemplates, analytics, searchService, savedSearches, tenantA, tenantB, refA, refB };
}

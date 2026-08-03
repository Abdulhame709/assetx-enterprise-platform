/**
 * AppModule — composition root wiring infrastructure, application, and API layers.
 * Clean Architecture: core defines ports (injectable via string tokens); infrastructure
 * implements them; API consumes services. Ports are injected by token to satisfy NestJS.
 */
import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PGlite } from '@electric-sql/pglite';
import { PGliteDatabase } from './infrastructure/database/pglite.database';
import { initLocalDatabase } from './bootstrap/db-init';
import { BcryptHasher } from './infrastructure/auth/bcrypt.hasher';
import { JwtTokenManager } from './infrastructure/auth/jwt.token-manager';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { AuthService } from './application/auth.service';
import { UsersService } from './application/users.service';
import { AuthController } from './api/auth/auth.controller';
import { UsersController } from './api/users/users.controller';
import { TenantController } from './api/tenant/tenant.controller';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { AssetService } from './application/asset.service';
import { AssetRepository } from './infrastructure/repositories/asset.repository';
import { AssetController } from './api/assets/asset.controller';
import { LocationService } from './application/location.service';
import { LocationRepository } from './infrastructure/repositories/location.repository';
import { LocationController } from './api/locations/location.controller';
import { CategoryService } from './application/category.service';
import { CategoryRepository } from './infrastructure/repositories/category.repository';
import { CategoryController } from './api/categories/category.controller';
import { ModelService } from './application/model.service';
import { ModelRepository } from './infrastructure/repositories/model.repository';
import { ModelController } from './api/models/model.controller';
import { EmployeeService } from './application/employee.service';
import { EmployeeRepository } from './infrastructure/repositories/employee.repository';
import { EmployeeController } from './api/employees/employee.controller';
import { CycleService } from './application/cycle.service';
import { CycleRepository } from './infrastructure/repositories/cycle.repository';
import { RecordRepository } from './infrastructure/repositories/record.repository';
import { RecordService } from './application/record.service';
import { ResultRepository } from './infrastructure/repositories/result.repository';
import { InventoryResultService } from './application/inventory-result.service';
import { InventoryController } from './api/inventory/inventory.controller';
import { MovementService } from './application/movement.service';
import { MovementRepository } from './infrastructure/repositories/movement.repository';
import { MovementController } from './api/movements/movement.controller';
import { ReportingService } from './application/reporting.service';
import { ReportingRepository } from './infrastructure/repositories/reporting.repository';
import { DashboardController } from './api/dashboard/dashboard.controller';
import { AuditService } from './application/audit.service';
import { AuditRepository } from './infrastructure/repositories/audit.repository';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditController } from './api/audit/audit.controller';
import { ComplianceService } from './application/compliance.service';
import { ComplianceController } from './api/compliance/compliance.controller';
import { EventBus } from './core/events/event-bus';
import { NotificationRepository } from './infrastructure/repositories/notification.repository';
import { NotificationService } from './application/notification.service';
import { TemplateRenderer } from './application/template-renderer.service';
import { SSEManager } from './common/sse/sse-manager';
import { RealtimeService } from './application/realtime.service';
import { NotificationController } from './api/notifications/notification.controller';
import { CsvGenerator } from './infrastructure/export/csv.generator';
import { ExcelGenerator } from './infrastructure/export/excel.generator';
import { PdfGenerator } from './infrastructure/export/pdf.generator';
import { FileGeneratorFactory } from './infrastructure/export/file-generator.factory';
import { ExportDataAdapter } from './application/export/adapters/export-data.adapter';
import { AssetsExportProvider } from './application/export/providers/assets-export.provider';
import { MovementsExportProvider } from './application/export/providers/movements-export.provider';
import { InventoryExportProvider } from './application/export/providers/inventory-export.provider';
import { AuditExportProvider } from './application/export/providers/audit-export.provider';
import { DashboardExportProvider } from './application/export/providers/dashboard-export.provider';
import { ExportService } from './application/export.service';
import { ExportController } from './api/export/export.controller';
import {
  DATABASE_PORT,
  PASSWORD_HASHER,
  TOKEN_MANAGER,
  PGLITE,
  ASSET_PORT,
  LOCATION_PORT,
  CATEGORY_PORT,
  MODEL_PORT,
  EMPLOYEE_PORT,
  CYCLE_PORT,
  RECORD_PORT,
  RESULT_PORT,
  MOVEMENT_PORT,
  REPORTING_PORT,
  AUDIT_PORT,
  EVENT_BUS,
  NOTIFICATION_PORT,
  REALTIME_PORT,
  EXPORT_PROVIDERS,
} from './core/ports/tokens';

// Secrets come from environment in production (Vault). Defaults for local dev only.
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'assetx-local-access-secret-dev-only';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'assetx-local-refresh-secret-dev-only';

@Global()
@Module({
  providers: [
    {
      provide: PGLITE,
      useFactory: async () => {
        const pg = new PGlite();
        // Apply the verified migration + demo tenant so the runtime is connected to a real schema.
        await initLocalDatabase(pg);
        return pg;
      },
    },
    {
      provide: DATABASE_PORT,
      useFactory: (pg: PGlite) => new PGliteDatabase(pg),
      inject: [PGLITE],
    },
    { provide: PASSWORD_HASHER, useClass: BcryptHasher },
    {
      provide: TOKEN_MANAGER,
      useFactory: () => new JwtTokenManager(ACCESS_SECRET, REFRESH_SECRET),
    },
    UserRepository,
    AuthService,
    UsersService,
    {
      provide: ASSET_PORT,
      useClass: AssetRepository,
    },
    AssetService,
    { provide: LOCATION_PORT, useClass: LocationRepository },
    LocationService,
    { provide: CATEGORY_PORT, useClass: CategoryRepository },
    CategoryService,
    { provide: MODEL_PORT, useClass: ModelRepository },
    ModelService,
    { provide: EMPLOYEE_PORT, useClass: EmployeeRepository },
    EmployeeService,
    { provide: CYCLE_PORT, useClass: CycleRepository },
    { provide: RECORD_PORT, useClass: RecordRepository },
    { provide: RESULT_PORT, useClass: ResultRepository },
    { provide: MOVEMENT_PORT, useClass: MovementRepository },
    { provide: REPORTING_PORT, useClass: ReportingRepository },
    { provide: AUDIT_PORT, useClass: AuditRepository },
    AuditService,
    ComplianceService,
    { provide: EVENT_BUS, useClass: EventBus },
    { provide: NOTIFICATION_PORT, useClass: NotificationRepository },
    { provide: REALTIME_PORT, useClass: SSEManager },
    TemplateRenderer,
    NotificationService,
    SSEManager,
    RealtimeService,
    CsvGenerator,
    ExcelGenerator,
    PdfGenerator,
    FileGeneratorFactory,
    ExportDataAdapter,
    AssetsExportProvider,
    MovementsExportProvider,
    InventoryExportProvider,
    AuditExportProvider,
    DashboardExportProvider,
    {
      provide: EXPORT_PROVIDERS,
      useFactory: (assets, movements, inventory, audit, dashboard) => [assets, movements, inventory, audit, dashboard],
      inject: [AssetsExportProvider, MovementsExportProvider, InventoryExportProvider, AuditExportProvider, DashboardExportProvider],
    },
    ExportService,
    CycleService,
    RecordService,
    InventoryResultService,
    MovementService,
    ReportingService,
    {
      provide: AuthGuard,
      useFactory: (tokens: JwtTokenManager, db: PGliteDatabase) => new AuthGuard(tokens, db),
      inject: [TOKEN_MANAGER, DATABASE_PORT],
    },
    RolesGuard,
    PermissionGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  controllers: [
    AuthController, UsersController, TenantController, AssetController,
    LocationController, CategoryController, ModelController, EmployeeController,
    InventoryController, MovementController, DashboardController, AuditController, ComplianceController,
    NotificationController, ExportController,
  ],
  exports: [DATABASE_PORT, TOKEN_MANAGER, PASSWORD_HASHER, UserRepository, AuthService, UsersService, ASSET_PORT, AssetService, AUDIT_PORT, AuditService],
})
export class AppModule {}

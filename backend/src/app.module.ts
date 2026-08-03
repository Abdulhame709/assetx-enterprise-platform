/**
 * AppModule — composition root wiring infrastructure, application, and API layers.
 * Clean Architecture: core defines ports (injectable via string tokens); infrastructure
 * implements them; API consumes services. Ports are injected by token to satisfy NestJS.
 */
import { Module, Global } from '@nestjs/common';
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
    CycleService,
    RecordService,
    InventoryResultService,
    {
      provide: AuthGuard,
      useFactory: (tokens: JwtTokenManager) => new AuthGuard(tokens),
      inject: [TOKEN_MANAGER],
    },
    RolesGuard,
  ],
  controllers: [
    AuthController, UsersController, TenantController, AssetController,
    LocationController, CategoryController, ModelController, EmployeeController,
    InventoryController,
  ],
  exports: [DATABASE_PORT, TOKEN_MANAGER, PASSWORD_HASHER, UserRepository, AuthService, UsersService, ASSET_PORT, AssetService],
})
export class AppModule {}

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
import {
  DATABASE_PORT,
  PASSWORD_HASHER,
  TOKEN_MANAGER,
  PGLITE,
  ASSET_PORT,
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
    {
      provide: AuthGuard,
      useFactory: (tokens: JwtTokenManager) => new AuthGuard(tokens),
      inject: [TOKEN_MANAGER],
    },
    RolesGuard,
  ],
  controllers: [AuthController, UsersController, TenantController, AssetController],
  exports: [DATABASE_PORT, TOKEN_MANAGER, PASSWORD_HASHER, UserRepository, AuthService, UsersService, ASSET_PORT, AssetService],
})
export class AppModule {}

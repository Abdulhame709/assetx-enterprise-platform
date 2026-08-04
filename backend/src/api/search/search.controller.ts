/**
 * SearchController — advanced search endpoints.
 * GET /search/assets · /search/movements · /search/audit · /search/global
 * Permission-based; no business logic; delegates to SearchService.
 * Saved-search endpoints are added after the saved_searches migration is approved.
 * Reference: Advanced-Search-Design-Specification §14
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from '../../application/search.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@Controller('search')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('assets')
  @RequirePermission('asset.view')
  assets(@Query() query: Record<string, unknown>, @CurrentUser() u: RequestUser) {
    return this.search.search(u.tenant_id, 'assets', query);
  }

  @Get('movements')
  @RequirePermission('movement.view')
  movements(@Query() query: Record<string, unknown>, @CurrentUser() u: RequestUser) {
    return this.search.search(u.tenant_id, 'movements', query);
  }

  @Get('audit')
  @RequirePermission('audit.view')
  audit(@Query() query: Record<string, unknown>, @CurrentUser() u: RequestUser) {
    return this.search.search(u.tenant_id, 'audit', query);
  }

  @Get('global')
  @RequirePermission('search.global')
  global(@Query('q') q: string, @Query() query: Record<string, unknown>, @CurrentUser() u: RequestUser) {
    return this.search.global(u.tenant_id, q ?? '', query);
  }
}

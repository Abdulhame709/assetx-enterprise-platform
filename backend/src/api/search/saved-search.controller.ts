/**
 * SavedSearchController — saved-search endpoints (ADR-011).
 * GET/POST /search/saved · PATCH/DELETE /search/saved/:id · GET /search/saved/:id/execute
 * Permission: search.save; owner-only via service (user_id scoped).
 * Reference: Advanced-Search-Design-Specification §10 · ADR-011 §7
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SavedSearchService } from '../../application/saved-search.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { assertUuid } from '../../common/utils/uuid';

@Controller('search/saved')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class SavedSearchController {
  constructor(private readonly saved: SavedSearchService) {}

  @Get()
  @RequirePermission('search.save')
  list(@CurrentUser() u: RequestUser) {
    return this.saved.list(u.tenant_id, u.sub);
  }

  @Post()
  @RequirePermission('search.save')
  create(@Body() dto: { name: string; resource: string; filters?: Record<string, unknown>; is_default?: boolean }, @CurrentUser() u: RequestUser) {
    return this.saved.create(u.tenant_id, u.sub, {
      name: dto.name,
      resource: dto.resource as never,
      filters: dto.filters,
      is_default: dto.is_default,
    });
  }

  @Patch(':id')
  @RequirePermission('search.save')
  update(@Param('id') id: string, @Body() dto: { name?: string; filters?: Record<string, unknown>; is_default?: boolean }, @CurrentUser() u: RequestUser) {
    assertUuid(id);
    return this.saved.update(u.tenant_id, u.sub, id, dto);
  }

  @Delete(':id')
  @RequirePermission('search.save')
  async remove(@Param('id') id: string, @CurrentUser() u: RequestUser) {
    assertUuid(id);
    await this.saved.remove(u.tenant_id, u.sub, id);
    return { message: 'deleted' };
  }

  @Get(':id/execute')
  @RequirePermission('search.save')
  async execute(@Param('id') id: string, @CurrentUser() u: RequestUser) {
    assertUuid(id);
    const criteria = await this.saved.getForExecution(u.tenant_id, u.sub, id);
    if (!criteria) throw new Error('SAVED_SEARCH_NOT_FOUND');
    return criteria;
  }
}

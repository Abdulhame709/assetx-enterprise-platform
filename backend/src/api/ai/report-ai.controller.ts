import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ReportNarrativeService, AiReportResource } from '../../application/ai/report-narrative.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

interface ReportSummaryBody {
  resource?: unknown;
}

@Controller('ai/reports')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class ReportAiController {
  constructor(private readonly narratives: ReportNarrativeService) {}

  @Post('summary')
  @RequirePermission({ permissions: ['report.view', 'ai.use'], mode: 'ALL' })
  summary(@Body() body: ReportSummaryBody, @CurrentUser() user: RequestUser) {
    const resource = body?.resource;
    if (resource !== 'assets' && resource !== 'dashboard') {
      throw new BadRequestException('INVALID_AI_REPORT_RESOURCE');
    }
    return this.narratives.generate(resource as AiReportResource, user.tenant_id, user.sub);
  }
}

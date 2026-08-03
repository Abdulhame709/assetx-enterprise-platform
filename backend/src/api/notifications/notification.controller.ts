/**
 * NotificationController — notification APIs + SSE stream.
 * Reference: Phase 11.2 · permission: notification.view
 * SSE stream is auth+permission-guarded; each connection validates JWT/permission/tenant.
 */
import {
  Body, Controller, Get, Header, Param, Patch, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { NotificationService } from '../../application/notification.service';
import { RealtimeService } from '../../application/realtime.service';
import { SSEManager } from '../../common/sse/sse-manager';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly realtime: RealtimeService,
    private readonly sse: SSEManager,
  ) {}

  @Get()
  @RequirePermission('notification.view')
  list(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.getUserNotifications(user.tenant_id, user.sub);
  }

  @Get('unread-count')
  @RequirePermission('notification.view')
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notifications.countUnread(user.tenant_id, user.sub).then((count) => ({ unread: count }));
  }

  @Patch(':id/read')
  @RequirePermission('notification.view')
  markRead(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.markAsRead(user.tenant_id, user.sub, id);
  }

  @Get('stream')
  @RequirePermission('notification.view')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  stream(@Req() req: Request, @Res() res: Response, @CurrentUser() user: RequestUser) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    // Initial comment to establish the stream
    res.write(': connected\n\n');
    const conn = this.realtime.connect(user.sub, user.tenant_id);
    this.sse.bind(conn as never, res);
    // Keep alive heartbeat every 25s
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { /* ignore */ }
    }, 25000);
    res.on('close', () => clearInterval(heartbeat));
  }
}

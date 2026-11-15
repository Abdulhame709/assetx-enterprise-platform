import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DatabasePort } from '../../core/ports/database.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

/**
 * Health endpoints. Public and exempt from rate limiting so load balancers and
 * orchestrator probes are never answered with 429.
 *
 *   GET /health        readiness + legacy path (checks the database)
 *   GET /health/ready  readiness (checks the database; 503 when it is down)
 *   GET /health/live   liveness (process only; never touches the database, so a
 *                      database outage does not make the orchestrator restart us)
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  @Get()
  async check(): Promise<{ status: 'ok'; database: 'ok'; timestamp: string }> {
    return this.ready();
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ok'; database: 'ok'; timestamp: string }> {
    try {
      await this.db.query('SELECT 1 AS health');
    } catch {
      // Do not echo driver errors (they can contain hostnames / SQL).
      throw new ServiceUnavailableException({ status: 'unavailable', database: 'down' });
    }
    return { status: 'ok', database: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('live')
  live(): { status: 'ok'; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}

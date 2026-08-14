import { Controller, Get, Inject } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  @Get()
  async check(): Promise<{ status: 'ok'; database: 'ok'; timestamp: string }> {
    await this.db.query('SELECT 1 AS health');
    return {
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

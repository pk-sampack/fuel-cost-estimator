import { Controller, Get, Inject } from '@nestjs/common';
import { SQL, type SqlClient } from '../../db/token';
import { nowIso } from '../../common/time';

@Controller('health')
export class HealthController {
  constructor(@Inject(SQL) private readonly sql: SqlClient) {}

  @Get()
  async health() {
    await this.sql.query('SELECT 1');
    return { status: 'ok', calcVersion: 'v1', time: nowIso() };
  }
}

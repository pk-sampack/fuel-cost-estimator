import { Inject, Injectable } from '@nestjs/common';
import { SQL, type SqlClient } from '../../db/token';

@Injectable()
export class AuditService {
  constructor(@Inject(SQL) private readonly sql: SqlClient) {}

  async record(
    actor: string,
    action: string,
    entity: string,
    entityId: string | null,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await this.sql.query(
      'INSERT INTO audit_log (actor, action, entity, entity_id, before, after) VALUES ($1, $2, $3, $4, $5, $6)',
      [actor, action, entity, entityId, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after)],
    );
  }

  async list(limit = 100): Promise<Array<Record<string, unknown>>> {
    const result = await this.sql.query<Record<string, unknown>>(
      'SELECT id, actor, action, entity, entity_id, before, after, at FROM audit_log ORDER BY at DESC LIMIT $1',
      [Math.min(Math.max(limit, 1), 500)],
    );
    return result.rows;
  }
}

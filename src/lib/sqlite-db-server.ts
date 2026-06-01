// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

// Resolve database path relative to process.cwd() or fallback
const dbPath = path.join(process.cwd(), 'ghg.db');

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
  }
  return dbInstance;
}

export interface QueryFilter {
  type: 'eq' | 'in';
  col: string;
  val: any;
}

export interface QueryPayload {
  action: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  table: string;
  selects?: string;
  filters?: QueryFilter[];
  orderCol?: string | null;
  orderAsc?: boolean;
  rangeFrom?: number | null;
  rangeTo?: number | null;
  limit?: number | null;
  data?: any;
  onConflict?: string;
}

export function runLocalQuery(payload: QueryPayload): { data: any; error: any; count?: number } {
  try {
    const db = getDb();
    const { action, table } = payload;

    if (action === 'select') {
      let selects = payload.selects || '*';
      if (selects.trim() === '') selects = '*';

      // Parse selects if it contains custom counting or modifier, but app uses standard column lists
      let sql = `SELECT ${selects} FROM ${table}`;
      const params: any[] = [];
      const whereClauses: string[] = [];

      if (payload.filters && payload.filters.length > 0) {
        for (const filter of payload.filters) {
          if (filter.type === 'eq') {
            if (filter.val === null) {
              whereClauses.push(`${filter.col} IS NULL`);
            } else {
              whereClauses.push(`${filter.col} = ?`);
              params.push(filter.val);
            }
          } else if (filter.type === 'in') {
            if (!Array.isArray(filter.val) || filter.val.length === 0) {
              whereClauses.push('1 = 0'); // Force empty list if filter array is empty
            } else {
              const placeholders = filter.val.map(() => '?').join(', ');
              whereClauses.push(`${filter.col} IN (${placeholders})`);
              params.push(...filter.val);
            }
          }
        }
      }

      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      if (payload.orderCol) {
        const direction = payload.orderAsc !== false ? 'ASC' : 'DESC';
        sql += ` ORDER BY ${payload.orderCol} ${direction}`;
      }

      if (payload.rangeFrom !== undefined && payload.rangeFrom !== null && payload.rangeTo !== undefined && payload.rangeTo !== null) {
        const offset = payload.rangeFrom;
        const limitCount = payload.rangeTo - payload.rangeFrom + 1;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(limitCount, offset);
      } else if (payload.limit !== undefined && payload.limit !== null) {
        sql += ` LIMIT ?`;
        params.push(payload.limit);
      }

      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      return { data: rows, error: null, count: rows.length };
    }

    if (action === 'insert') {
      const records = Array.isArray(payload.data) ? payload.data : [payload.data];
      if (records.length === 0) return { data: [], error: null };

      // Ensure id exists (SQLite needs string UUIDs for relationship parity)
      for (const rec of records) {
        if (!rec.id) {
          rec.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }
      }

      const columns = Object.keys(records[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      const stmt = db.prepare(sql);

      db.exec('BEGIN TRANSACTION');
      try {
        for (const rec of records) {
          const vals = columns.map(col => rec[col]);
          stmt.run(...vals);
        }
        db.exec('COMMIT');
        return { data: records, error: null };
      } catch (err: any) {
        db.exec('ROLLBACK');
        console.error(`[SQLite Insert Error in table ${table}]:`, err);
        return { data: null, error: { message: err.message } };
      }
    }

    if (action === 'update') {
      const record = payload.data;
      if (!record || typeof record !== 'object') {
        return { data: null, error: { message: 'Invalid record data for update' } };
      }

      // Filter out id from update columns
      const updateCols = Object.keys(record).filter(col => col !== 'id' && col !== 'created_at');
      const setClauses = updateCols.map(col => `${col} = ?`).join(', ');
      const params: any[] = updateCols.map(col => record[col]);

      let sql = `UPDATE ${table} SET ${setClauses}`;
      const whereClauses: string[] = [];

      if (payload.filters && payload.filters.length > 0) {
        for (const filter of payload.filters) {
          if (filter.type === 'eq') {
            if (filter.val === null) {
              whereClauses.push(`${filter.col} IS NULL`);
            } else {
              whereClauses.push(`${filter.col} = ?`);
              params.push(filter.val);
            }
          }
        }
      }

      if (whereClauses.length === 0) {
        return { data: null, error: { message: 'Update operations require filters to prevent table-wide update' } };
      }

      sql += ` WHERE ${whereClauses.join(' AND ')}`;
      const stmt = db.prepare(sql);
      stmt.run(...params);
      return { data: [record], error: null };
    }

    if (action === 'delete') {
      let sql = `DELETE FROM ${table}`;
      const params: any[] = [];
      const whereClauses: string[] = [];

      if (payload.filters && payload.filters.length > 0) {
        for (const filter of payload.filters) {
          if (filter.type === 'eq') {
            if (filter.val === null) {
              whereClauses.push(`${filter.col} IS NULL`);
            } else {
              whereClauses.push(`${filter.col} = ?`);
              params.push(filter.val);
            }
          }
        }
      }

      if (whereClauses.length === 0) {
        return { data: null, error: { message: 'Delete operations require filters to prevent table-wide truncation' } };
      }

      sql += ` WHERE ${whereClauses.join(' AND ')}`;
      const stmt = db.prepare(sql);
      stmt.run(...params);
      return { data: [], error: null };
    }

    if (action === 'upsert') {
      const records = Array.isArray(payload.data) ? payload.data : [payload.data];
      if (records.length === 0) return { data: [], error: null };

      // Check conflict columns based on table
      let conflictTarget = '';
      let updateSet = '';

      if (table === 'emissions_data') {
        conflictTarget = 'factory_id, year, month, scope, category';
        updateSet = 'activity_data = excluded.activity_data, emissions_tco2e = excluded.emissions_tco2e, cost_usd = excluded.cost_usd, notes = excluded.notes, updated_at = CURRENT_TIMESTAMP';
      } else if (table === 'production_data') {
        conflictTarget = 'factory_id, year, month, category';
        updateSet = 'quantity = excluded.quantity, unit = excluded.unit, updated_at = CURRENT_TIMESTAMP';
      } else {
        // Fallback or generic ID conflict
        conflictTarget = 'id';
        const cols = Object.keys(records[0]).filter(c => c !== 'id' && c !== 'created_at');
        updateSet = cols.map(c => `${c} = excluded.${c}`).join(', ') + ', updated_at = CURRENT_TIMESTAMP';
      }

      for (const rec of records) {
        if (!rec.id) {
          rec.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }
      }

      const columns = Object.keys(records[0]);
      const placeholders = columns.map(() => '?').join(', ');
      
      const sql = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT(${conflictTarget})
        DO UPDATE SET ${updateSet}
      `;
      const stmt = db.prepare(sql);

      db.exec('BEGIN TRANSACTION');
      try {
        for (const rec of records) {
          const vals = columns.map(col => rec[col]);
          stmt.run(...vals);
        }
        db.exec('COMMIT');
        return { data: records, error: null };
      } catch (err: any) {
        db.exec('ROLLBACK');
        console.error(`[SQLite Upsert Error in table ${table}]:`, err);
        return { data: null, error: { message: err.message } };
      }
    }

    return { data: null, error: { message: `Unsupported action: ${action}` } };
  } catch (err: any) {
    console.error('[SQLite Query Error]:', err);
    return { data: null, error: { message: err.message || err } };
  }
}

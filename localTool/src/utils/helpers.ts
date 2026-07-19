/**
 * HTTP 工具函数
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

export function json(res: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function sendError(res: ServerResponse, message: string, status = 500): void {
  json(res, { error: message }, status);
}

export function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      if (raw.length === 0) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw.toString('utf-8')));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * 解析 multipart/form-data
 * 返回 { fields: Record<string, string>, files: Record<string, { filename: string, data: Buffer, mimeType: string }> }
 */
export function parseMultipart(
  req: IncomingMessage,
): Promise<{ fields: Record<string, string>; files: Record<string, { filename: string; data: Buffer; mimeType: string }> }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (!boundaryMatch) {
        resolve({ fields: {}, files: {} });
        return;
      }

      const boundary = boundaryMatch[1];
      const sep = Buffer.from(`--${boundary}`);
      const parts: Buffer[] = [];
      let start = 0;

      while (true) {
        const idx = raw.indexOf(sep, start);
        if (idx === -1) break;
        if (start > 0) {
          parts.push(raw.slice(start, idx));
        }
        start = idx + sep.length + 2; // skip \r\n
      }

      const fields: Record<string, string> = {};
      const files: Record<string, { filename: string; data: Buffer; mimeType: string }> = {};

      for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;

        const header = part.slice(0, headerEnd).toString('utf-8');
        const body = part.slice(headerEnd + 4, part.length - 2); // strip trailing \r\n

        const nameMatch = header.match(/name="([^"]+)"/);
        const filenameMatch = header.match(/filename="([^"]+)"/);
        if (!nameMatch) continue;

        const fieldName = nameMatch[1];

        if (filenameMatch) {
          const mimeTypeMatch = header.match(/Content-Type:\s*(.+)/);
          files[fieldName] = {
            filename: filenameMatch[1],
            data: body,
            mimeType: mimeTypeMatch ? mimeTypeMatch[1].trim() : 'application/octet-stream',
          };
        } else {
          fields[fieldName] = body.toString('utf-8');
        }
      }

      resolve({ fields, files });
    });
    req.on('error', reject);
  });
}

/**
 * 分页参数解析
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: 'ASC' | 'DESC';
  search?: string;
  filters?: Record<string, unknown>;
}

export function parsePagination(url: URL, defaults: { sortBy: string; sortDir: 'ASC' | 'DESC' }): PaginationParams {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20));
  const sortBy = url.searchParams.get('sortBy') || defaults.sortBy;
  const sortDir = (url.searchParams.get('sortDir')?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';
  const search = url.searchParams.get('search') || undefined;

  let filters: Record<string, unknown> | undefined;
  const filtersStr = url.searchParams.get('filters');
  if (filtersStr) {
    try {
      filters = JSON.parse(filtersStr);
    } catch {
      filters = undefined;
    }
  }

  return { page, pageSize, sortBy, sortDir, search, filters };
}

/**
 * camelCase → snake_case（用于把 V1 前端过滤键映射到 DB 列名）
 * 例：isFavorite → is_favorite；folder/type 保持不变
 */
function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

/**
 * 构建分页 SQL 查询
 *
 * 支持 V1 前端发送的过滤器 DSL：
 *  - 数组值    → column IN (?, ?, ...)
 *  - {eqOrPrefix: x} → (column = ? OR column LIKE ?)  （精确 + 前缀匹配）
 *  - 普通值    → column = ?
 * 过滤键会自动从 camelCase 转为 snake_case 以匹配 DB 列名。
 */
export function buildPaginatedQuery(
  table: string,
  params: PaginationParams,
  searchColumns: string[] = [],
): { sql: string; countSql: string; values: unknown[]; countValues: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const countValues: unknown[] = [];

  // 搜索
  if (params.search && searchColumns.length > 0) {
    const searchConditions = searchColumns.map((col) => `${col} LIKE ?`);
    conditions.push(`(${searchConditions.join(' OR ')})`);
    for (const _ of searchColumns) {
      values.push(`%${params.search}%`);
      countValues.push(`%${params.search}%`);
    }
  }

  // 过滤器（支持 V1 的过滤器 DSL：数组 IN / eqOrPrefix 前缀 / 普通等值）
  if (params.filters) {
    for (const [rawKey, rawVal] of Object.entries(params.filters)) {
      if (rawVal === undefined || rawVal === null) continue;
      const column = camelToSnake(rawKey);

      if (Array.isArray(rawVal)) {
        // 数组 → IN (?, ?, ...)
        if (rawVal.length === 0) continue;
        const placeholders = rawVal.map(() => '?').join(', ');
        conditions.push(`${column} IN (${placeholders})`);
        for (const v of rawVal) {
          values.push(v);
          countValues.push(v);
        }
      } else if (typeof rawVal === 'object' && 'eqOrPrefix' in (rawVal as Record<string, unknown>)) {
        // {eqOrPrefix: x} → 精确匹配 + 前缀匹配（文件夹或其子目录）
        const prefix = String((rawVal as Record<string, unknown>).eqOrPrefix);
        conditions.push(`(${column} = ? OR ${column} LIKE ?)`);
        values.push(prefix, `${prefix}/%`);
        countValues.push(prefix, `${prefix}/%`);
      } else {
        // 普通值 → 等值
        conditions.push(`${column} = ?`);
        values.push(rawVal);
        countValues.push(rawVal);
      }
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 验证 sortBy 防止 SQL 注入
  const validSortColumns = new Set(searchColumns);
  const safeSortBy = validSortColumns.has(params.sortBy) ? params.sortBy : 'rowid';
  const safeSortDir = params.sortDir === 'ASC' ? 'ASC' : 'DESC';

  const offset = (params.page - 1) * params.pageSize;

  const sql = `SELECT * FROM ${table} ${whereClause} ORDER BY ${safeSortBy} ${safeSortDir} LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) as total FROM ${table} ${whereClause}`;

  return {
    sql,
    countSql,
    values: [...values, params.pageSize, offset],
    countValues,
  };
}

/**
 * 分页结果封装
 */
export function paginatedResult<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

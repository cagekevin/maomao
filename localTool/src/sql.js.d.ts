declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  export interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(params?: Record<string, unknown[]>): Record<string, unknown>;
    get(): unknown[];
    free(): boolean;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
}

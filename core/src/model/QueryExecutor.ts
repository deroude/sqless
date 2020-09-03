import { Migration } from "./Migration";

export interface QueryExecutor {
    executeQuery: (query: string, args?: any[]) => Promise<any>;
    executeMigration: (migrationSet: { id: string, apply: string, rollback: string }[]) => Promise<void>;
}
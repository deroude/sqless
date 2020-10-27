import { Migration } from "./Migration";

export interface QueryExecutor {
    executeQuery: (query: string, args?: any[]) => Promise<any>;
}
import { QueryExecutor } from "./QueryExecutor";

export interface DelegateMethodExecutor {
    execute: (params: any, queryExecutor: QueryExecutor) => Promise<any>;
}

export interface DelegateConfig {
    type: 'sql' | 'function';
    path: string;
}
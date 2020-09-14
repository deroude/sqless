import { QueryExecutor } from "./QueryExecutor";

export interface DelegateMethodExecutor {
    execute: (params: any, queryExecutor: QueryExecutor) => Promise<any>;
}

export interface DelegateConfig {
    type: 'sql' | 'function';
    path: string;
}

export function isConfig(delegate: DelegateConfig | DelegateMethodExecutor): delegate is DelegateConfig {
    return (delegate as DelegateConfig).type !== undefined;
}

export function isExecutor(delegate: DelegateConfig | DelegateMethodExecutor): delegate is DelegateMethodExecutor {
    return (delegate as DelegateMethodExecutor).execute !== undefined;
}
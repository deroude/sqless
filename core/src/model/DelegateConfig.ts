import { TemplateOperationExecutor } from "../business/TemplateOperationExecutor";
import { MailOperationExecutor } from "../business/MailOperationExecutor";
import { SQLOperationExecutor } from "../business/SQLOperationExecutor";

export interface OperationExecutor {
    execute(context: any): Promise<void>;
}

export interface OperationConfig {
    id: string;
    type: string;
}

export interface SQLOperationConfig extends OperationConfig {
    template: string;
    params?: string[];
    forEach?: { var: string, of: string };
    assign?: { column?: string, var: string };
    singleRow?: boolean;
    singleField?: string;
}

export interface TemplateOperationConfig extends OperationConfig {
    templateVar: string;
    assign: string;
}

export interface MailOperationConfig extends OperationConfig {
    template: string;
    fromVar?: string;
    toVar?: string;
    subject: string;
    forEach?: { var: string, of: string };
}

export interface QueryDelegateConfig {
    operations: OperationConfig[];
    return: string;
}

const registeredOperationExecutors: { [k: string]: (cfg: OperationConfig, deps?: any) => OperationExecutor } = {
    'sql': (cfg: SQLOperationConfig, deps: any) => new SQLOperationExecutor(cfg, deps.queryExecutor),
    'mail': (cfg: MailOperationConfig, deps: any) => new MailOperationExecutor(cfg, deps.mailExecutor),
    'template': (cfg: TemplateOperationConfig) => new TemplateOperationExecutor(cfg)
}

export function registerOperationExecutor(type: string, factory: (cfg: OperationConfig) => OperationExecutor) {
    registeredOperationExecutors[type] = factory;
}

export function getExecutor(cfg: OperationConfig, deps?: any): OperationExecutor {
    return registeredOperationExecutors[cfg.type](cfg, deps);
}
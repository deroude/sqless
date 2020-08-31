export interface QueryOperation {
    template: string;
    params?: string[];
    forEach?: { var: string, of: string };
    setVar?: string;
    return?: boolean;
    singleRow?: boolean;
    singleField?: string;
}

export interface QueryDelegateConfig {
    operations: QueryOperation[];
}
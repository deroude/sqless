export interface XSQLMigration {
    name?: string;
    migrate: string;
    rollback?: string;
}

export interface XSQLAssign {
    column: string;
    var: string;
}

export interface XSQLForeach {
    var: string;
    of: string;
}

export interface XSQLOperation {
    template: string;
    params?: string[];
    foreach?: XSQLForeach;
    assign?: XSQLAssign;
    return?: boolean;
}

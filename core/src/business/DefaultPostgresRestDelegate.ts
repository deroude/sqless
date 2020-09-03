import { DelegateMethodExecutor } from '../model/Delegate';
import { QueryExecutor } from '../model/QueryExecutor';
import { PostgresDelegate } from './PostgresDelegate';
import { QueryDelegateConfig } from '../model/QueryDelegateConfig';

const BY_ID = /^\/([^\s\/\?\\]+)\/\{([^\s\/\?\\])\}$/g;
const ALL = /^\/([^\s\/\?\\]+)$/g;

export const RestMapper: (path: string, method: string) => QueryDelegateConfig = (path, method) => {
    switch (method.toLowerCase()) {
        case 'get':
            if (ALL.test(path)) {
                return {
                    operations: [
                        { template: `SELECT * FROM "${ALL.exec(path)[1]}";` }
                    ]
                }
            }
            if (BY_ID.test(path)) {
                const parts = BY_ID.exec(path);
                return {
                    operations: [
                        { template: `SELECT * FROM "${parts[1]}" WHERE ${parts[2]}=$1";`, params: [`params.${parts[2]}`] }
                    ]
                }
            }
        case 'delete':
            if (BY_ID.test(path)) {
                const parts = BY_ID.exec(path);
                return {
                    operations: [
                        { template: `DELETE FROM "${parts[1]}" WHERE ${parts[2]}=$1";`, params: [`params.${parts[2]}`] }
                    ]
                }
            }
    }
}

export class DefaultPostgresRestDelegate implements DelegateMethodExecutor {

    delegate: PostgresDelegate;

    constructor(private path: string, method: string) {
        const config: QueryDelegateConfig = RestMapper(path, method);
        this.delegate = new PostgresDelegate(config);
    }

    execute(params: any, queryExecutor: QueryExecutor): Promise<any> {
        return this.delegate.execute(params, queryExecutor);
    }

}

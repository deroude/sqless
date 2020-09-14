import { DelegateMethodExecutor } from '../model/Delegate';
import { QueryExecutor } from '../model/QueryExecutor';
import { PostgresDelegate } from './PostgresDelegate';
import { QueryDelegateConfig } from '../model/QueryDelegateConfig';

const BY_ID = /^\/([^\s\/\?\\]+)\/\{([^\s\/\?\\]+)\}$/;
const ALL = /^\/([^\s\/\?\\]+)$/;

export const RestMapper: (path: string, method: string) => QueryDelegateConfig = (path, method) => {
    let parts;
    switch (method.toLowerCase()) {
        case 'get':
            parts = path.match(ALL);
            if (parts) {
                return {
                    operations: [
                        { template: `SELECT * FROM "${parts[1]}";`, return: true }
                    ]
                }
            }
            parts = path.match(BY_ID);
            if (parts) {
                return {
                    operations: [
                        { template: `SELECT * FROM "${parts[1]}" WHERE ${parts[2]}=$1;`, params: [`params.${parts[2]}`], return: true }
                    ]
                }
            }
        case 'delete':
            parts = path.match(BY_ID)
            if (parts) {
                return {
                    operations: [
                        { template: `DELETE FROM "${parts[1]}" WHERE ${parts[2]}=$1;`, params: [`params.${parts[2]}`]}
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

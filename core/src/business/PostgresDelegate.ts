import { DelegateMethodExecutor } from '../model/Delegate';
import { QueryExecutor } from '../model/QueryExecutor';
import { getExecutor, QueryDelegateConfig } from '../model/DelegateConfig';
import _ from 'lodash';

export class PostgresDelegate implements DelegateMethodExecutor {

    constructor(private config: QueryDelegateConfig) { }

    async execute(params: any, queryExecutor: QueryExecutor): Promise<any> {
        const ctx = params;
        try {
            await queryExecutor.executeQuery('BEGIN');
            for (const op of this.config.operations) {
                await getExecutor(op, { queryExecutor }).execute(ctx);
            }
            await queryExecutor.executeQuery('COMMIT');
        } catch (err) {
            try {
                await queryExecutor.executeQuery('ROLLBACK');
            } catch (rbErr) {
                console.error(rbErr);
            }
            return Promise.reject(err);
        }
        return Promise.resolve(ctx[this.config.return]);
    }



}
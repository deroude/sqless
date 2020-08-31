import { DelegateMethodExecutor } from '../model/Delegate';
import { QueryExecutor } from '../model/QueryExecutor';
import { QueryDelegateConfig, QueryOperation } from '../model/QueryDelegateConfig';
import _ from 'lodash';

export class PostgresDelegate implements DelegateMethodExecutor {

    constructor(private config: QueryDelegateConfig) { }

    async execute(params: any, queryExecutor: QueryExecutor): Promise<any> {
        let re = null;
        const ctx = params;
        try {
            for (const op of this.config.operations)
                if (op.forEach) {
                    const loopCtx = ctx;
                    const forEachOf = _.get(ctx, op.forEach.of);
                    for (const item of forEachOf) {
                        loopCtx[op.forEach.var] = item;
                        const q = await this.executeQuery(queryExecutor, op, loopCtx);
                        if (!!op.return) re = q;
                        if (!!op.setVar) loopCtx[op.setVar] = q;
                    }
                } else {
                    const q = await this.executeQuery(queryExecutor, op, ctx);
                    if (!!op.return) re = q;
                    if (!!op.setVar) ctx[op.setVar] = q;
                }
        } catch (err) {
            return Promise.reject(err);
        }
        return Promise.resolve(re);
    }

    private async executeQuery(queryExecutor: QueryExecutor, op: QueryOperation, ctx: any): Promise<any> {
        try {
            const args = op.params.map(p => _.get(ctx, p));
            const rs = await queryExecutor.executeQuery(op.template, args);
            if (op.singleRow) {
                if (rs.length === 1) {
                    return Promise.resolve(rs[0]);
                } else {
                    return Promise.reject(`Single row query expected to return only 1 row, but returned ${rs.length} instead`);
                }
            }
            if (!!op.singleField) {
                if (rs.length === 1) {
                    return Promise.resolve(rs[0][op.singleField]);
                } else {
                    return Promise.reject(`Single field query expected to return only 1 row, but returned ${rs.length} instead`);
                }
            }
            return Promise.resolve(rs)
        } catch (err) {
            return Promise.reject(err);
        }
    }

}
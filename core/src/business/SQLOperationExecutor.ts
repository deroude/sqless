import { QueryExecutor } from "../model/QueryExecutor";
import { OperationExecutor, SQLOperationConfig } from "../model/QueryDelegateConfig";
import _ from "lodash";

export class SQLOperationExecutor implements OperationExecutor {

    constructor(private config: SQLOperationConfig, private queryExecutor: QueryExecutor) { }

    async execute(ctx: any): Promise<void> {
        if (this.config.forEach) {
            const loopCtx = ctx;
            const forEachOf = _.get(ctx, this.config.forEach.of);
            for (const item of forEachOf) {
                loopCtx[this.config.forEach.var] = item;
                const q = await this.executeQuery(this.queryExecutor, loopCtx);
                if (!!this.config.assign && !!this.config.singleRow) {
                    if (!!this.config.assign.column) {
                        loopCtx[this.config.assign.var] = q[this.config.assign.column];
                    } else {
                        loopCtx[this.config.assign.var] = q;
                    }
                }
            }
        } else {
            const q = await this.executeQuery(this.queryExecutor, ctx);
            if (!!this.config.assign) {
                if (!!this.config.assign.column) {
                    ctx[this.config.assign.var] = q[this.config.assign.column];
                } else {
                    ctx[this.config.assign.var] = q;
                }
            }
        }
    }

    private async executeQuery(queryExecutor: QueryExecutor, ctx: any): Promise<any> {
        try {
            const args = this.config.params.map(p => _.get(ctx, p));
            const rs = await queryExecutor.executeQuery(this.config.template, args);
            if (!!this.config.singleRow) {
                if (rs.length === 1) {
                    return Promise.resolve(rs[0]);
                } else {
                    return Promise.reject(`Single row query expected to return only 1 row, but returned ${rs.length} instead`);
                }
            }
            if (!!this.config.singleField) {
                if (rs.length === 1) {
                    return Promise.resolve(rs[0][this.config.singleField]);
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
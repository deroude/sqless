import { QueryExecutor } from "../model/QueryExecutor";
import { DelegateMethodExecutor } from "../model/Delegate";

export class NotImplementedDelegate implements DelegateMethodExecutor {

    execute(params: any, queryExecutor: QueryExecutor): Promise<any> {
        return Promise.reject('Method not yet implemented');
    }


}
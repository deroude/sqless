import { OperationExecutor, TemplateOperationConfig } from "../model/DelegateConfig";

export class TemplateOperationExecutor implements OperationExecutor {

    constructor(private config: TemplateOperationConfig) { }

    execute(ctx: any): Promise<void> {
        try {
            const template = Handlebars.compile(ctx[this.config.templateVar]);
            ctx[this.config.assign] = template(ctx);
            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }
}
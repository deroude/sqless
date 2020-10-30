import { MailOperationConfig } from "../model/DelegateConfig";
import { OperationExecutor } from "../model/DelegateConfig";
import { NodeMailerExecutor } from "./NodeMailerExecutor";

export class MailOperationExecutor implements OperationExecutor {

    template: HandlebarsTemplateDelegate;

    constructor(private config: MailOperationConfig, private mail: NodeMailerExecutor) {
        this.template = Handlebars.compile(this.config.template);
    }

    async execute(ctx: any): Promise<void> {
        try {
            this.mail.sendMail(ctx[this.config.fromVar], ctx[this.config.toVar], this.config.subject, this.template(ctx));
        } catch (err) {
            return Promise.reject(err);
        }
        return Promise.resolve();
    }
}
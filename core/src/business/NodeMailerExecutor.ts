import { MailConfig } from "../model/MailConfig";

import * as nodemailer from 'nodemailer';
import { SentMessageInfo, Transporter } from "nodemailer";

export class NodeMailerExecutor {

    transport: Transporter;

    constructor(private config: MailConfig) {
        this.transport = nodemailer.createTransport(this.config.smtp.uri ||
            `${this.config.smtp.secure ? 'smtps' : 'smtp'}://${this.config.smtp.username}:${this.config.smtp.password}@${this.config.smtp.host}:${this.config.smtp.port}`);
    }

    sendMail(from: string, to: string, subject: string, text: string): Promise<SentMessageInfo> {
        return this.transport.sendMail({ from: from || this.config.defaultSender, to, subject, text });
    }

}
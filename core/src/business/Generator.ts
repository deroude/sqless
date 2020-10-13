import path from 'path';
import fs from 'fs';
import * as yaml from 'js-yaml';
import { GeneratorConfig } from "../model/GeneratorConfig";
import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';
import Handlebars from 'handlebars';

global.Handlebars = Handlebars;

import './templates/precompiled';

export class Generator {
    constructor(private config: GeneratorConfig) { }

    async init(): Promise<void> {
        let api: OpenAPIV3.Document;

        if (this.config.apiPath) {
            console.log(`Loading API from ${this.config.apiPath}`);
            if (fs.existsSync(this.config.apiPath)) {
                try {
                    api = yaml.safeLoad(fs.readFileSync(this.config.apiPath, 'utf-8')) as OpenAPIV3.Document;
                    console.log('API file loaded');
                } catch (err) {
                    console.error(`Unable to load API file [${this.config.apiPath}]`);
                    console.error(err);
                    return Promise.reject(err);
                }
            }
        }

        if (!api) {
            console.error(`No API file available`);
            return Promise.reject('No API file available');
        }

        await this.writeFile('.sqless/sqless-config.yaml', Handlebars.templates['sqless-config.yaml'], { apiPath: this.config.apiPath.replace(/^\.[\/\\]/, '') });

        return Promise.resolve();
    }

    private async writeFile(fPath: string, f: HandlebarsTemplateDelegate, args: any): Promise<void> {
        const dirname = path.dirname(fPath);
        if (!fs.existsSync(dirname)) {
            try {
                await fs.promises.mkdir(dirname, { recursive: true });
            } catch (err) {
                console.error(err);
                return Promise.reject(err);
            }
        }
        try {
            await fs.promises.writeFile(fPath, f(args), 'utf-8');
        } catch (err) {
            console.error(err);
            return Promise.reject(err);
        }
        return Promise.resolve();
    }

}
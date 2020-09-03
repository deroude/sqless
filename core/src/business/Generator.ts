import { OpenAPIObject } from "openapi3-ts";
import path from 'path';
import fs from 'fs';
import * as yaml from 'js-yaml';
import { Template } from "./templates/Template";
import { Renderer } from "./templates/Renderer";
import SQLessConfigTemplate from './templates/SQLessConfigTemplate';
import { GeneratorConfig } from "../model/GeneratorConfig";

export class Generator {
    constructor(private config: GeneratorConfig) { }

    async init(): Promise<void> {
        let api: OpenAPIObject;

        if (this.config.apiPath) {
            console.log(`Loading API from ${this.config.apiPath}`);
            if (fs.existsSync(this.config.apiPath)) {
                try {
                    api = yaml.safeLoad(fs.readFileSync(this.config.apiPath, 'utf-8')) as OpenAPIObject;
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

        this.writeFile(SQLessConfigTemplate, { apiPath: this.config.apiPath });

        return Promise.resolve();
    }

    private async writeFile(f: Template, args: any): Promise<void> {
        const fPath: string = this.isRenderer(f.path) ? f.path.render(args) : f.path;
        const fContent: string = this.isRenderer(f.content) ? f.content.render(args) : f.content;
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
            await fs.promises.writeFile(fPath, fContent, 'utf-8');
        } catch (err) {
            console.error(err);
            return Promise.reject(err);
        }
        return Promise.resolve();
    }

    private isRenderer(tpl: Renderer | string): tpl is Renderer {
        return (tpl as Renderer).render !== undefined;
    }
}
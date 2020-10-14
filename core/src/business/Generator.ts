import path from 'path';
import fs from 'fs';
import * as yaml from 'js-yaml';
import { GeneratorConfig } from "../model/GeneratorConfig";
import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';
import Handlebars from 'handlebars';

global.Handlebars = Handlebars;

import './templates/precompiled';

type PGType = 'serial' | 'varchar' | 'decimal' | 'int' | 'bigint' | 'boolean' | 'timestamptz';

interface Property {
    name: string;
    type: PGType,
    isId: boolean;
    isRequired: boolean;
}

interface Entity {
    name: string;
    properties: Property[];
}

const typeMap: { [k: string]: PGType } = {
    'string': 'varchar',
    'string:date': 'timestamptz',
    'string:date-time': 'timestamptz',
    'string:password': 'varchar',
    'integer': 'int',
    'integer:int32': 'int',
    'integer:int64': 'bigint',
    'number': 'decimal',
    'number:float': 'decimal',
    'number:double': 'decimal',
    'boolean': 'boolean'
}

const toSnake = (a: string) => a.split(/(?=[A-Z])/).join('_').toLowerCase();

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

        const entities = [];

        for (const [k, v] of Object.entries(api.components.schemas)) {
            const entity: Entity = { name: toSnake(k), properties: [] };
            const schema: OpenAPIV3.SchemaObject = v as OpenAPIV3.SchemaObject;
            for (const [pk, pv] of Object.entries(schema.properties)) {
                // TODO treat references
                const ps: OpenAPIV3.SchemaObject = pv as OpenAPIV3.SchemaObject;
                const property: Property = {
                    name: toSnake(pk),
                    isId: pk.toLowerCase() === 'id',
                    isRequired: schema.required && schema.required.indexOf(pk.toLowerCase()) > 0,
                    type: typeMap[ps.format ? `${ps.type}:${ps.format}` : ps.type]
                }
                entity.properties.push(property);
            }
            entities.push(entity);
        }

        await this.writeFile('.sqless/sqless-config.yaml', Handlebars.templates['sqless-config.yaml'], { apiPath: this.config.apiPath.replace(/^\.[\/\\]/, '') });
        await this.writeFile('.sqless/docker-compose.yaml', Handlebars.templates['docker-compose.yaml'], {});
        await this.writeFile('.sqless/postgres-init.sql', Handlebars.templates['postgres-init.sql'], {});
        await this.writeFile('.sqless/migrations/001_initial.sql', Handlebars.templates['001_initial.sql'], { entities });


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
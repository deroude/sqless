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
    nameSnake: string;
    type: PGType,
    isId: boolean;
    isRequired: boolean;
    fk?: string;
    index: number;
}

interface Operation {
    method: string;
    delegate: string;
}

interface Entity {
    name: string;
    nameSnake: string;
    properties: Property[];
    operations: Operation[];
    lastIndex: number;
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

function toSnake(a: string) { return a.split(/(?=[A-Z])/).join('_').toLowerCase(); }

function isReference(prop: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): prop is OpenAPIV3.ReferenceObject {
    return (prop as OpenAPIV3.ReferenceObject).$ref !== undefined;
}

const refPattern = /^#\/components\/schemas\/(.+)$/;
const pathPattern = /^\/([^\/]+)$/;

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
            const entity: Entity = { name: k, nameSnake: toSnake(k), properties: [], operations: [], lastIndex: 0 };
            const schema: OpenAPIV3.SchemaObject = v as OpenAPIV3.SchemaObject;
            let index = 1;
            for (const [pk, pv] of Object.entries(schema.properties)) {
                if (isReference(pv)) {
                    const ref = pv.$ref.match(refPattern);
                    if (ref && ref[1]) {
                        entity.properties.push({
                            name: pk,
                            nameSnake: toSnake(pk),
                            index,
                            isId: false,
                            isRequired: schema.required && schema.required.indexOf(pk.toLowerCase()) > 0,
                            type: 'int',
                            fk: toSnake(ref[1])
                        });
                    }
                } else {
                    entity.properties.push({
                        name: pk,
                        nameSnake: toSnake(pk),
                        isId: pk.toLowerCase() === 'id',
                        isRequired: schema.required && schema.required.indexOf(pk.toLowerCase()) > 0,
                        index,
                        type: typeMap[pv.format ? `${pv.type}:${pv.format}` : pv.type]
                    })
                }
                index++;
            }

            entities.push({ ...entity, lastIndex: index });
        }

        // Order entities according to the references
        let iter = 0;
        let sw = true;
        while (sw && iter++ < 10) {
            sw = false;
            for (let i = 0; i < entities.length; i++) {
                const e = entities[i];
                for (const prop of e.properties) {
                    if (prop.fk) {
                        const si = entities.findIndex(o => o.name === prop.fk);
                        if (si > i) {
                            sw = true;
                            const oe: Entity = entities[si];
                            entities[si] = entities[i];
                            entities[i] = oe;
                            break;
                        }
                    }
                }
            }
        }

        if (iter === 10) {
            console.warn('Circular FK detected');
        }



        await this.writeFile('.sqless/sqless-config.yaml', Handlebars.templates['sqless-config.yaml'], { apiPath: this.config.apiPath.replace(/^\.[\/\\]/, '') });
        await this.writeFile('.sqless/docker-compose.yaml', Handlebars.templates['docker-compose.yaml'], {});
        await this.writeFile('.sqless/postgres-init.sql', Handlebars.templates['postgres-init.sql'], {});
        await this.writeFile('.sqless/migrations/001_initial.sql', Handlebars.templates['001_initial.sql'], { entities });
        await this.writeFile('.sqless/migrations/001_initial_rollback.sql', Handlebars.templates['001_initial_rollback.sql'], { entities: entities.reverse() });

        for (const [p, ops] of Object.entries(api.paths)) {
            const entityMatch = p.match(pathPattern);
            if (entityMatch && entityMatch[1]) {
                const entity = entities.find(e => e.name === entityMatch[1]);
                if (entity) {
                    for (const op of Object.keys(ops)) {
                        let delegate;
                        switch (op.toLowerCase()) {
                            case 'post':
                                delegate = `.sqless/queries/add-${entity.name}.yaml`;
                                await this.writeFile(delegate, Handlebars.templates['add-entity.yaml'], entity);
                                break;
                            case 'delete':
                                delegate = `.sqless/queries/delete-${entity.name}.yaml`;
                                await this.writeFile(delegate, Handlebars.templates['delete-entity.yaml'], entity);
                                break;
                            case 'put':
                            case 'patch':
                                delegate = `.sqless/queries/update-${entity.name}.yaml`;
                                await this.writeFile(delegate, Handlebars.templates['update-entity.yaml'], entity);
                                break;
                        }
                        entity.operations.push({ method: op.toLowerCase(), delegate });
                    }
                }
            }
        }

        await this.writeFile('.sqless/sqless-config.yaml', Handlebars.templates['sqless-config.yaml'], { apiPath: this.config.apiPath.replace(/^\.[\/\\]/, ''), entities });


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
import path from 'path';
import fs from 'fs';
import * as yaml from 'js-yaml';
import { GeneratorConfig } from "../model/GeneratorConfig";
import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';
import Handlebars from 'handlebars';
import util from 'util';
import { generateKeyPair } from 'crypto';

global.Handlebars = Handlebars;

Handlebars.registerHelper("inc", (value) => Number(value) + 1);

import './templates/precompiled';

type PGType = 'serial' | 'varchar' | 'decimal' | 'int' | 'bigint' | 'boolean' | 'timestamptz';

const KEY_PATTERN = /\n|-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|-----BEGIN RSA PRIVATE KEY-----|-----END RSA PRIVATE KEY-----/g;

interface Property {
    name: string;
    nameSnake: string;
    type: PGType,
    isId: boolean;
    isRequired: boolean;
    fk?: string;
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
const batchPathPattern = /^\/([^\/]+)$/;
const idPathPattern = /^\/([^\/]+)\/\{id\}$/

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
            const entity: Entity = { name: k, nameSnake: toSnake(k), properties: [], operations: [] };
            const schema: OpenAPIV3.SchemaObject = v as OpenAPIV3.SchemaObject;
            for (const [pk, pv] of Object.entries(schema.properties)) {
                if (isReference(pv)) {
                    const ref = pv.$ref.match(refPattern);
                    if (ref && ref[1]) {
                        entity.properties.push({
                            name: pk,
                            nameSnake: toSnake(pk),
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
                        type: typeMap[pv.format ? `${pv.type}:${pv.format}` : pv.type]
                    })
                }
            }

            entities.push(entity);
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
            let entityMatch = p.match(batchPathPattern);
            let entityName: string;
            let isIdOp: boolean;
            if (entityMatch && entityMatch[1]) {
                entityName = entityMatch[1].toLowerCase();
                isIdOp = false;
            }
            if (!entityMatch) {
                entityMatch = p.match(idPathPattern);
                if (entityMatch && entityMatch[1]) {
                    entityName = entityMatch[1].toLowerCase();
                    isIdOp = true;
                }
            }
            if (!entityMatch) continue;
            const entity = entities.find(e => e.name.toLowerCase() === entityName);
            if (entity) {
                for (const op of Object.keys(ops)) {
                    let delegate;
                    switch (op.toLowerCase()) {
                        case 'get':
                            if (isIdOp) {
                                delegate = `.sqless/queries/get-single-${entityName}.yaml`;
                                await this.writeFile(delegate, Handlebars.templates['get-entity-single.yaml'], entity);
                            } else {
                                delegate = `.sqless/queries/get-list-${entityName}.yaml`;
                                await this.writeFile(delegate, Handlebars.templates['get-entity-list.yaml'], entity);
                            }
                            break;
                        case 'post':
                            if (!isIdOp) {
                                delegate = `.sqless/queries/add-${entityName}.yaml`;
                                await this.writeFile(delegate, Handlebars.templates['add-entity.yaml'], entity);
                            }
                            break;
                        case 'delete':
                            if (isIdOp) {
                                delegate = `.sqless/queries/delete-${entityName}.yaml`;
                                await this.writeFile(delegate, Handlebars.templates['delete-entity.yaml'], entity);
                            }
                            break;
                        case 'put':
                        case 'patch':
                            if (isIdOp) {
                                delegate = `.sqless/queries/update-${entityName}.yaml`;
                                await this.writeFile(delegate, Handlebars.templates['update-entity.yaml'], entity);
                            }
                            break;
                    }
                    entity.operations.push({ method: op.toLowerCase(), delegate });
                }
            }

        }

        await this.writeFile('.sqless/sqless-config.yaml', Handlebars.templates['sqless-config.yaml'], { apiPath: this.config.apiPath.replace(/^\.[\/\\]/, ''), entities });

        // Security

        if (api.components.securitySchemes && api.components.securitySchemes && Object.keys(api.components.securitySchemes)[0]) {
            const realmName = Object.keys(api.components.securitySchemes)[0];
            const { publicKey, privateKey } = await util.promisify(generateKeyPair)('rsa', {
                modulusLength: 4096,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs1',
                    format: 'pem'
                }
            });
            const scopes = (api.components.securitySchemes[realmName] as OpenAPIV3.OAuth2SecurityScheme).flows.implicit.scopes;
            const roles = Object.keys(scopes).map(k => ({ name: k, description: scopes[k] }));
            const server = api.servers && api.servers[0] ? api.servers[0].url : '';
            await this.writeFile('.sqless/realm-config.json', Handlebars.templates['realm-config.json'], {
                realmName,
                // publicKey,
                // privateKey,
                publicKey: publicKey.replace(KEY_PATTERN, ''),
                privateKey: privateKey.replace(KEY_PATTERN, ''),
                roles,
                server
            });

        }

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
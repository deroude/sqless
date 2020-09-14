import { BootstrapConfig } from '../model/BootstrapConfig';
import fs, { promises } from 'fs';
import path from 'path';
import { DEFAULT_CONFIG, Config } from '../model/Config';
import * as yaml from 'js-yaml';
import { PostgresQueryExecutor } from './PostgresQueryExecutor';
import { Pool } from 'pg';
import { SQLess } from './SQLess';
import { QueryExecutor } from '../model/QueryExecutor';
import { DelegateConfig, isConfig } from '../model/Delegate';
import { DelegateMethodExecutor } from '../model/Delegate';
import { QueryDelegateConfig } from '../model/QueryDelegateConfig';
import { PostgresDelegate } from './PostgresDelegate';
import { DefaultPostgresRestDelegate } from './DefaultPostgresRestDelegate';
import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';

export class Bootstrap {
    constructor(private argv: BootstrapConfig) { }

    async start(): Promise<void> {
        let config = DEFAULT_CONFIG;

        let configCwd: string = '';

        console.log(`Loading config from ${this.argv.configPath}`);
        if (this.argv.configPath && fs.existsSync(this.argv.configPath)) {
            configCwd = path.dirname(this.argv.configPath);
            try {
                config = yaml.safeLoad(fs.readFileSync(this.argv.configPath, 'utf-8')) as Config;
                console.log('Config file loaded');
            } catch (err) {
                console.error('Unable to load Config file');
                console.error(err);
                Promise.reject(err);
            }
        } else {
            console.warn(`Config file ${this.argv.configPath} not found, loading defaults`);
        }

        if (this.argv.apiPath) {
            config.api = this.argv.apiPath;
        }

        let api: OpenAPIV3.Document;

        if (config.api && typeof config.api === 'string') {
            const apiPath = path.resolve(configCwd, config.api);
            console.log(`Loading API from ${apiPath}`);
            if (fs.existsSync(apiPath)) {
                try {
                    api = yaml.safeLoad(fs.readFileSync(apiPath, 'utf-8')) as OpenAPIV3.Document;
                    console.log('API file loaded');
                } catch (err) {
                    console.error(`Unable to load API file [${apiPath}]`);
                    console.error(err);
                    Promise.reject(err);
                }
            }
        }

        if (!api) {
            console.error(`No API file available`);
            Promise.reject('No API file available');
        }

        config.api = api;

        let persistence: QueryExecutor;

        if (config.dbConnection.type === 'postgres') {
            console.log('Initializing Postgres');
            try {
                persistence = new PostgresQueryExecutor(new Pool(config.dbConnection));
            } catch (err) {
                console.error(err);
            }
        }

        if (!persistence) {
            console.error('No persistence available');
            return Promise.reject('No persistence available');
        }

        if (config.migrations) {
            console.log('Applying migrations...');
            try {
                await persistence.executeMigration(config.migrations.map(m => ({
                    id: m.id,
                    apply: fs.readFileSync(path.resolve(configCwd, m.applyPath), 'utf-8'),
                    rollback: fs.readFileSync(path.resolve(configCwd, m.rollbackPath), 'utf-8')
                })));
            } catch (err) {
                console.error('Unable to apply migrations');
                console.error(err);
                return Promise.reject(err);
            }
            console.log('Migrations finished.');
        }


        if (config.delegates) {
            console.log('Attaching API delegates...');
            Object.keys(config.delegates).forEach(dPath => {
                Object.keys(config.delegates[dPath]).forEach(dMethod => {
                    const delegateConfig = config.delegates[dPath][dMethod];
                    console.log(`- ${dMethod.toUpperCase()} ${dPath}`)
                    if (isConfig(delegateConfig)) {
                        switch (delegateConfig.type) {
                            case 'sql':
                                try {
                                    const sqlConfig: QueryDelegateConfig = yaml.safeLoad(
                                        fs.readFileSync(
                                            path.resolve(configCwd, delegateConfig.path), 'utf-8')
                                    ) as QueryDelegateConfig;
                                    config.delegates[dPath][dMethod] = new PostgresDelegate(sqlConfig);
                                } catch (err) {
                                    console.warn(`Unable to load delegate for ${dPath} | ${dMethod}`);
                                    console.error(err);
                                }
                                break;
                            default:
                                try {
                                    config.delegates[dPath][dMethod] = new DefaultPostgresRestDelegate(dPath, dMethod);
                                } catch (err) {
                                    console.warn(`Unable to construct default delegate for ${dPath} | ${dMethod}`);
                                    console.error(err);
                                }
                            // TODO add function delegates
                        }
                    }
                });
            });
            console.log('Done');
        }

        const server = new SQLess(persistence);

        server.start(this.argv.hostname, this.argv.port);

        await server.addAPI(null, config);
        console.log("API ready");
        return Promise.resolve();
    }
}
import { BootstrapConfig } from '../model/BootstrapConfig';
import fs from 'fs';
import path from 'path';
import { DEFAULT_CONFIG, Config } from '../model/Config';
import * as yaml from 'js-yaml';
import { PostgresQueryExecutor } from './PostgresQueryExecutor';
import { Pool } from 'pg';
import { SQLess } from './SQLess';
import { QueryDelegateConfig } from '../model/DelegateConfig';
import { PostgresDelegate } from './PostgresDelegate';
import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';
import { MigrationExecutor } from '../model/MigrationExecutor';
import { NotImplementedDelegate } from './NotImplementedDelegate';
import { QueryExecutor } from '../model/QueryExecutor';

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

        let persistence: MigrationExecutor & QueryExecutor;

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


        if (config.delegatePaths) {
            console.log('Attaching API delegates...');
            Object.keys(config.delegatePaths).forEach(dPath => {
                Object.keys(config.delegatePaths[dPath]).forEach(dMethod => {
                    const delegateConfig = config.delegatePaths[dPath][dMethod];
                    console.log(`- ${dMethod.toUpperCase()} ${dPath}`)
                    const sqlConfig: QueryDelegateConfig = yaml.safeLoad(
                        fs.readFileSync(
                            path.resolve(configCwd, delegateConfig), 'utf-8')
                    ) as QueryDelegateConfig;
                    if (config.delegateExecutors[dPath] === undefined) config.delegateExecutors[dPath] = {};
                    // TODO add mongo delegate
                    config.delegateExecutors[dPath][dMethod] = new PostgresDelegate(sqlConfig);
                });
            });

            // Fill non-delegated paths with defaults
            for (const [apiPath, item] of Object.entries(config.api.paths)) {
                for (const method of Object.keys(item)) {
                    if (config.delegateExecutors[apiPath] === undefined) config.delegateExecutors[apiPath] = {};
                    if (config.delegateExecutors[apiPath][method] === undefined) {
                        console.log(`- [default] ${method.toUpperCase()} ${apiPath}`)
                        try {
                            config.delegateExecutors[apiPath][method] = new NotImplementedDelegate();
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
            }
            console.log('Done');
        }

        const server = new SQLess(persistence);

        server.start(this.argv.hostname, this.argv.port);

        await server.addAPI(null, config);
        console.log("API ready");
        return Promise.resolve();
    }
}
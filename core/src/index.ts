import yargs from 'yargs';
import fs from 'fs';
import path from 'path';
import { DEFAULT_CONFIG, Config } from './model/Config';
import * as yaml from 'js-yaml';
import { OpenAPIObject } from 'openapi3-ts';
import { PostgresQueryExecutor } from './business/PostgresQueryExecutor';
import { Pool } from 'pg';
import { SQLess } from './business/SQLess';
import { QueryExecutor } from './model/QueryExecutor';
import { DelegateMethodExecutor } from './model/Delegate';
import { QueryDelegateConfig } from './model/QueryDelegateConfig';
import { PostgresDelegate } from './business/PostgresDelegate';

const argv = yargs
    .usage('Usage: $0 [options]')
    .alias('a', 'api')
    .nargs('a', 1)
    .describe('a', 'OpenAPI 3.0 API descriptor file (yaml)')
    .alias('c', 'config')
    .nargs('c', 1)
    .describe('c', 'Configuration file, defaults to ./sqless-config.yaml')
    .default('c', '.sqless/sqless-config.yaml')
    .alias('h', 'host')
    .nargs('h', 1)
    .describe('h', 'Hostname to bind the API server')
    .default('h', 'localhost')
    .alias('p', 'port')
    .nargs('p', 1)
    .describe('p', 'Port to bind the API server')
    .default('p', '9000')
    .help('?')
    .alias('?', 'help')
    .example('$0 --api /path/to/my/openapi.yaml --config /path/to/my/config.yaml', 'Starts the SQLess backend for the provided API and configuration')
    .example('$0 -a /path/to/my/openapi.yaml', 'Starts the SQLess backend for the provided API, using a local file names sqless-config.yaml, or the default configuration')
    .argv;

let config = DEFAULT_CONFIG;

let configCwd: string = '';

console.log(`Loading config from ${argv.config}`);
if (argv.config && fs.existsSync(argv.config)) {
    configCwd = path.dirname(argv.config);
    try {
        config = yaml.safeLoad(fs.readFileSync(argv.config, 'utf-8')) as Config;
        console.log('Config file loaded');
    } catch (err) {
        console.error('Unable to load Config file');
        console.error(err);
        process.exit(1);
    }
} else {
    console.warn(`Config file ${argv.config} not found, loading defaults`);
}

if (argv.api) {
    config.apiPath = argv.api;
}

let api: OpenAPIObject;

if (config.apiPath) {
    const apiPath = path.resolve(configCwd, config.apiPath);
    console.log(`Loading API from ${apiPath}`);
    if (fs.existsSync(apiPath)) {
        try {
            api = yaml.safeLoad(fs.readFileSync(apiPath, 'utf-8')) as OpenAPIObject;
            console.log('API file loaded');
        } catch (err) {
            console.error(`Unable to load API file [${apiPath}]`);
            console.error(err);
            process.exit(1);
        }
    }
}

if (!api) {
    console.error(`No API file available`);
    process.exit(1);
}

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
    process.exit(1);
}

if (config.migrations) {
    console.log('Applying migrations...');
    (async () => {
        try {
            persistence.executeMigration(config.migrations.map(m => ({
                id: m.id,
                apply: fs.readFileSync(path.resolve(configCwd, m.applyPath), 'utf-8'),
                rollback: fs.readFileSync(path.resolve(configCwd, m.rollbackPath), 'utf-8')
            })));
        } catch (err) {
            console.error('Unable to apply migrations');
            console.error(err);
            process.exit(1);
        }
    })();
    console.log('Migrations finished.');
}

const delegates: { [path: string]: { [method: string]: DelegateMethodExecutor } } = {};

if (config.delegates) {
    console.log('Attaching API delegates...');
    Object.keys(config.delegates).forEach(dPath => {
        delegates[dPath] = {};
        Object.keys(config.delegates[dPath]).forEach(dMethod => {
            const delegateConfig = config.delegates[dPath][dMethod];
            console.log(`- ${dMethod.toUpperCase()} ${dPath}`)
            switch (delegateConfig.type) {
                case 'sql':
                    try {
                        const sqlConfig: QueryDelegateConfig = yaml.safeLoad(
                            fs.readFileSync(
                                path.resolve(configCwd, delegateConfig.path), 'utf-8')
                        ) as QueryDelegateConfig;
                        delegates[dPath][dMethod] = new PostgresDelegate(sqlConfig);
                    } catch (err) {
                        console.warn(`Unable to load delegate for ${dPath} | ${dMethod}`);
                        console.error(err);
                    }
                    break;
                // TODO add function delegates
            }
        });
    });
    console.log('Done');
}

const server = new SQLess(persistence);

server.start(argv.host, argv.port);

server.addAPI(null, api, delegates);
console.log("API ready");

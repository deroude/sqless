import yargs from 'yargs';
import { Bootstrap } from './business/Bootstrap';
import { Generator } from './business/Generator';

const argv = yargs
    .command('start', 'Starts a SQLess environment', y =>
        y.alias('a', 'apiPath')
            .nargs('a', 1)
            .describe('a', 'OpenAPI 3.0 API descriptor file (yaml)')
            .alias('c', 'configPath')
            .nargs('c', 1)
            .describe('c', 'Configuration file, defaults to ./sqless-config.yaml')
            .default('c', '.sqless/sqless-config.yaml')
            .alias('h', 'hostname')
            .nargs('h', 1)
            .describe('h', 'Hostname to bind the API server')
            .default('h', 'localhost')
            .alias('p', 'port')
            .nargs('p', 1)
            .describe('p', 'Port to bind the API server')
            .default('p', '9000')
            .example('$0 --api /path/to/my/openapi.yaml --config /path/to/my/config.yaml', 'Starts the SQLess backend for the provided API and configuration')
            .example('$0 -a /path/to/my/openapi.yaml', 'Starts the SQLess backend for the provided API, using a local file names sqless-config.yaml, or the default configuration'),
        args => new Bootstrap({
            apiPath: args.apiPath,
            configPath: args.configPath,
            hostname: args.hostname,
            port: args.port
        }).start().catch(reason => process.exit(1))
    )
    .command('init', 'Initializes the SQLess environment in the current folder', y =>
        y.alias('a', 'apiPath')
            .nargs('a', 1)
            .describe('a', 'OpenAPI 3.0 API descriptor file (yaml)')
            .alias('d', 'dbType')
            .nargs('d', 1)
            .describe('d', 'Using Postgres or Mongo for persistence')
            .default('d', 'postgres')
            .alias('p', 'privateKeyPassPhrase')
            .nargs('p', 1)
            .describe('p', 'Pass phrase to use for the security private key')
            .default('p', 'changeme')
            .example('$0 --api /path/to/my/openapi.yaml', 'Generates SQLess configuration for the provided API with default Postgres persistence')
            .example('$0 -a /path/to/my/openapi.yaml --dbType mongo', 'Generates SQLess configuration for the provided API with Mongo for persistence'),
        args => new Generator({ apiPath: args.apiPath, dbType: args.dbType, privateKeyPassPhrase: args.privateKeyPassPhrase }).init().catch(reason => process.exit(1))
    )
    .help('?')
    .alias('?', 'help')
    .argv;



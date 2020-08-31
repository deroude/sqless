import { PostgresConfig } from "./PostgresConfig";
import { MongoConfig } from "./MongoConfig";
import { Migration } from "./Migration";
import { DelegateConfig } from "./Delegate";

export interface Config {
    version: string;
    dbConnection?: PostgresConfig | MongoConfig;
    migrations?: Migration[];
    apiPath?: string;
    delegates?: { [path: string]: { [method: string]: DelegateConfig } }
}

export const DEFAULT_CONFIG: Config = {
    version: '0.0.1',
    dbConnection: {
        type: 'postgres',
        database: 'postgres',
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres'
    }
}
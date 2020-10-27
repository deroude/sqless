import { PostgresConfig } from "./PostgresConfig";
import { MongoConfig } from "./MongoConfig";
import { Migration } from "./Migration";
import { DelegateMethodExecutor } from "./Delegate";
import { OpenAPIV3 } from "express-openapi-validator/dist/framework/types";

export interface Config {
    version: string;
    dbConnection?: PostgresConfig | MongoConfig;
    migrations?: Migration[];
    api?: string | OpenAPIV3.Document;
    delegatePaths?: { [path: string]: { [method: string]: string } }
    delegateExecutors?: { [path: string]: { [method: string]: DelegateMethodExecutor } }
}

export function isFullApi(api: string | OpenAPIV3.Document): api is OpenAPIV3.Document {
    return (api as OpenAPIV3.Document).openapi !== undefined;
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
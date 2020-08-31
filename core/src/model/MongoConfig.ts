export interface MongoConfig {
    type: 'mongo';
    host: string;
    port: number;
    username: string;
    password: string;
    authDB: string;
}
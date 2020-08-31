export interface PostgresConfig {
    type: 'postgres';
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}
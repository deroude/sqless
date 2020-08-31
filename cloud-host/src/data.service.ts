import { Pool } from 'pg';
import { SchemaObject, OpenAPIObject } from 'openapi3-ts';
import { initialize } from './initialize.sql';
import { XSQLMigration } from './domain';

export class DataService {

    private static instance: DataService;

    private poolCache: { [key: string]: Pool } = {};

    private constructor() { }

    static async getInstance(): Promise<DataService> {
        if (!DataService.instance) {
            DataService.instance = new DataService();
            DataService.instance.pg = new Pool({
                user: process.env.PG_USER || 'postgres',
                host: process.env.PG_HOST || 'localhost',
                database: process.env.PG_DB || 'postgres',
                password: process.env.PG_PASS || 'postgres',
                port: Number(process.env.PG_PORT) || 5432
            });
            DataService.instance.pg.connect();
            console.log('Running initialization sequence...');
            await DataService.instance.pg.query(initialize);
            console.log("Initialization sequence done.");
        }
        return Promise.resolve(DataService.instance);
    }

    pg: Pool;

    getPool(dbSchema: string, orElse?: () => Pool): Pool {
        if (!!this.poolCache[dbSchema]) {
            return this.poolCache[dbSchema];
        } else {
            if (!!orElse) {
                const pool = orElse();
                this.poolCache[dbSchema] = pool;
                return pool;
            }
        }
    }

    pgType(def: SchemaObject): string {
        if (def.type === 'integer' && def.format === 'int64') return 'bigint';
        if (def.type === 'integer') return 'int';
        return 'varchar';
    }

    async createDatabase(dbName: string, dbUser: string, dbSchema: string, password: string): Promise<void> {
        try {
            await this.pg.query(`CREATE DATABASE "${dbName}";`);
            await this.pg.query(`CREATE USER "${dbUser}" WITH PASSWORD '${password}';`);
            await this.pg.query(`GRANT ALL ON DATABASE "${dbName}" TO "${dbUser}";`);
            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }

    async dropRole(dbUser: string) {
        const q = await this.pg.query(`SELECT count(*) as ct FROM pg_roles WHERE rolname = '${dbUser}';`);
        if (q.rows[0].ct > 0) {
            await this.pg.query(`DROP OWNED BY "${dbUser}" CASCADE;`);
            await this.pg.query(`DROP ROLE IF EXISTS "${dbUser}";`);
        }
    }

    async createSchema(dbSchema: string, user: string, pool: Pool): Promise<void> {
        try {
            await pool.query(`CREATE SCHEMA "${dbSchema}" AUTHORIZATION "${user}";`);
            return Promise.resolve();
        } catch (err) { return Promise.reject(err); }
    }

    async createOrUpdateSchema(dbSchema: string, account: string, migration?: (p: Pool) => Promise<void>): Promise<void> {
        try {
            let user: string;
            let password: string;

            const accs = await this.pg.query(`SELECT id,password FROM sqless.accounts WHERE email = $1`, [account]);
            if (accs.rowCount > 0) {
                password = accs.rows[0].password;
                user = accs.rows[0].id;
            } else {
                await this.dropRole(user);
                await this.dropDb(account);
                const nacc = await this.pg.query(`INSERT INTO sqless.accounts (email) VALUES ($1) RETURNING id,password`, [account]);
                password = nacc.rows[0].password;
                user = nacc.rows[0].id;
                await this.createDatabase(account, user, dbSchema, password);
            }

            const pool = this.getPool(dbSchema, () => {
                const npool = new Pool({
                    user,
                    host: process.env.PG_HOST || 'localhost',
                    database: account,
                    password,
                    port: Number(process.env.PG_PORT) || 5432,
                    max: 2
                });
                npool.connect();
                return npool;
            });
            await pool.query(`SET search_path = '${dbSchema}';`)
            const apis = await this.pg.query(`SELECT id FROM sqless.apis WHERE "schema" = $1`, [dbSchema]);
            if (apis.rowCount <= 0) {
                await this.pg.query(`INSERT INTO sqless.apis (account,schema) VALUES ($1,$2)`, [user, dbSchema]);
                await this.createSchema(dbSchema, user, pool);
            }
            if (!!migration) {
                await migration(pool);
            }
            return Promise.resolve();
        } catch (err) { return Promise.reject(err); }
    }

    async dropDb(db: string): Promise<void> {
        try {
            await this.pg.query(`UPDATE pg_database SET datallowconn = 'false' WHERE datname = '${db}';`);
            await this.pg.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}';`);
            await this.pg.query(`DROP DATABASE IF EXISTS "${db}";`);
            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }

    async dropSchema(dbSchema: string): Promise<void> {
        try {
            const q = await this.pg.query(`SELECT ac.id as id,ac.email as account,ac.password as password FROM sqless.apis ap INNER JOIN sqless.accounts ac ON ap.account=ac.id WHERE ap."schema" = '${dbSchema}';`);
            if (q.rowCount > 0) {
                const user = q.rows[0].id;
                const password = q.rows[0].password;
                const account = q.rows[0].account;
                const pool: Pool = this.getPool(dbSchema, () => {
                    const npool = new Pool({
                        user,
                        host: process.env.PG_HOST || 'localhost',
                        database: account,
                        password,
                        port: Number(process.env.PG_PORT) || 5432,
                        max: 2
                    });
                    npool.connect();
                    return npool;
                });
                await pool.query(`DROP SCHEMA IF EXISTS ${dbSchema} CASCADE;`);
                await this.pg.query(`DELETE FROM sqless.apis WHERE "schema" = $1`, [dbSchema]);
                return Promise.resolve();
            } else {
                return Promise.reject("Schema no longer present");
            }
        } catch (err) {
            return Promise.reject(err);
        }
    }

    async createTables(pool: Pool, api: OpenAPIObject, dbSchema: string): Promise<void> {

        const migrations: XSQLMigration[] = api.components['x-sql-migrations'];
        if (!!migrations) {
            for (const m of migrations) {
                console.log(`Migrating ${dbSchema}: ${m.name}`);
                try {
                    await pool.query(m.migrate);
                } catch (err) {
                    console.error(err);
                    try {
                        await pool.query(m.rollback);
                    } catch (rollErr) {
                        console.error(rollErr);
                    }
                    return Promise.reject(err);
                }
            }
        } else {
            for (const [entity, tdef] of Object.entries(api.components.schemas)) {
                const cols: string[] = [];
                for (const [column, cdef] of Object.entries((tdef as SchemaObject).properties)) {
                    if (column === 'id') {
                        cols.push(`${column} serial NOT NULL PRIMARY KEY`);
                    } else {
                        cols.push(`${column} ${this.pgType(cdef)}${(tdef as SchemaObject).required?.includes(column) ? ' NOT NULL' : ''}`);
                    }
                }
                try {
                    await pool.query(`CREATE TABLE ${dbSchema}.${entity} (${cols.join(',')})`);
                } catch (err) {
                    console.error(err);
                    return Promise.reject(err);
                }
            }
        }
        return Promise.resolve();
    }

    get direct(): Pool {
        return this.pg;
    }

}
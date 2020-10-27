import { QueryExecutor } from '../model/QueryExecutor';
import { MigrationExecutor } from '../model/MigrationExecutor';

import { Pool } from 'pg';

// TODO use template
const INIT = `
CREATE SCHEMA IF NOT EXISTS sqless;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA sqless;
CREATE TABLE IF NOT EXISTS sqless.accounts (
	id uuid NOT NULL DEFAULT sqless.uuid_generate_v1() PRIMARY KEY,
	email varchar NOT NULL,
	kind varchar NOT NULL DEFAULT 'FREE',
	"password" varchar NOT NULL DEFAULT sqless.uuid_generate_v4()
);
CREATE TABLE IF NOT EXISTS sqless.apis (
	id uuid NOT NULL DEFAULT sqless.uuid_generate_v1() PRIMARY KEY,
	account uuid NULL REFERENCES sqless.accounts(id),
	hash varchar NULL,
	"schema" varchar NOT NULL
);
CREATE TABLE IF NOT EXISTS sqless.migrations (
	id uuid NOT NULL DEFAULT sqless.uuid_generate_v1() PRIMARY KEY,
	account uuid NULL REFERENCES sqless.accounts(id),
    migration_id varchar NOT NULL,
    apply_timestamp timestamptz default now(),
    status varchar NOT NULL
);
`;

export class PostgresQueryExecutor implements QueryExecutor, MigrationExecutor {

    ready = false;

    constructor(private db: Pool, private tenant = 'local') { }

    private async connect(): Promise<void> {
        if (this.ready) return Promise.resolve();
        try {
            await this.db.connect();
            await this.db.query(INIT, []);
            this.ready = true;
            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }

    async executeQuery(query: string, args: any[]): Promise<any> {
        try {
            await this.connect();
            const q = await this.db.query(query, args);
            return Promise.resolve(q.rows);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    async executeMigration(migrationSet: { id: string, apply: string, rollback: string }[]): Promise<void> {
        try {
            await this.connect()
            if (this.tenant === 'local')
                return this.executeLocalMigration(migrationSet);
            else {
                return this.executeCloudMigration(migrationSet);
            }
        } catch (err) {
            return Promise.reject(err);
        }
    }

    private async executeLocalMigration(migrationSet: { id: string, apply: string, rollback: string }[]): Promise<void> {
        for (let i = 0; i < migrationSet.length; i++) {
            const m = migrationSet[i];
            const q = await this.db.query('SELECT id, status FROM sqless.migrations WHERE migration_id=$1', [m.id]);
            if (q.rowCount > 0) {
                if (q.rows[0].status === 'SUCCESS') continue;
                else {
                    try {
                        await this.db.query(m.apply, []);
                        await this.db.query('UPDATE sqless.migrations SET status=\'SUCCESS\', apply_timestamp=now() WHERE id = $1', [q.rows[0].id]);
                    } catch (err) {
                        try {
                            await this.db.query('UPDATE sqless.migrations SET status=\'FAILED\', apply_timestamp=now() WHERE id = $1', [q.rows[0].id]);
                            await this.executeRollbackMigration(migrationSet.slice(0, i).reverse());
                        } catch (rbErr) {
                            console.error(rbErr);
                        }
                        return Promise.reject(err);
                    }
                }
            } else {
                try {
                    await this.db.query(m.apply, []);
                    await this.db.query('INSERT INTO sqless.migrations (status,migration_id) VALUES(\'SUCCESS\', $1)', [m.id]);
                } catch (err) {
                    try {
                        await this.executeRollbackMigration(migrationSet.slice(0, i).reverse());
                    } catch (rbErr) {
                        console.error(rbErr);
                    }
                    return Promise.reject(err);
                }
            }
        }
        return Promise.resolve();
    }

    private async executeCloudMigration(migrationSet: { id: string, apply: string, rollback: string }[]): Promise<void> {
        for (let i = 0; i < migrationSet.length; i++) {
            const m = migrationSet[i];
            const q = await this.db.query('SELECT m.id as id, m.status as status,a.id as account FROM sqless.migrations m JOIN sqless.accounts a ON m.account = a.id AND a.email=$1 WHERE m.migration_id=$2', [this.tenant, m.id]);
            if (q.rowCount > 0) {
                if (q.rows[0].status === 'SUCCESS') continue;
                else {
                    try {
                        await this.db.query(m.apply, []);
                        await this.db.query('UPDATE sqless.migrations SET status=\'SUCCESS\', apply_timestamp=now() WHERE id = $1', [q.rows[0].id]);
                    } catch (err) {
                        try {
                            await this.db.query('UPDATE sqless.migrations SET status=\'FAILED\', apply_timestamp=now() WHERE id = $1', [q.rows[0].id]);
                            await this.executeRollbackMigration(migrationSet.slice(0, i).reverse());
                        } catch (rbErr) {
                            console.error(rbErr);
                        }
                        return Promise.reject(err);
                    }
                }
            } else {
                try {
                    await this.db.query(m.apply, []);
                    await this.db.query('INSERT INTO sqless.migrations (account,status,migration_id) VALUES($1, \'SUCCESS\', $2)', [q.rows[0].account, q.rows[0].id]);
                } catch (err) {
                    try {
                        await this.executeRollbackMigration(migrationSet.slice(0, i).reverse());
                    } catch (rbErr) {
                        console.error(rbErr);
                    }
                    return Promise.reject(err);
                }
            }
        }
        return Promise.resolve();
    }

    private async executeRollbackMigration(migrationSet: { id: string, apply: string, rollback: string }[]): Promise<void> {
        try {
            for (const rb of migrationSet) {
                await this.db.query(rb.rollback, []);
            }
            Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }

}
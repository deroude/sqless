export const initialize = `revoke all on database postgres from PUBLIC;
revoke all on schema public from PUBLIC;
revoke all on schema information_schema from PUBLIC;
revoke all on schema pg_catalog from PUBLIC;
revoke all on all tables in schema public from PUBLIC;
revoke all on all tables in schema information_schema from PUBLIC;
revoke all on all tables in schema pg_catalog from PUBLIC;
CREATE SCHEMA IF NOT EXISTS sqless;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA sqless;
DROP TABLE IF EXISTS sqless.apis;
DROP TABLE IF EXISTS sqless.accounts;
CREATE TABLE IF NOT EXISTS sqless.accounts (
	id uuid NOT NULL DEFAULT sqless.uuid_generate_v1() PRIMARY KEY,
	email varchar NOT NULL,
	kind varchar NOT NULL DEFAULT 'FREE',
	"password" varchar NOT NULL DEFAULT sqless.uuid_generate_v4()
);
CREATE TABLE IF NOT EXISTS sqless.apis (
	id uuid NOT NULL DEFAULT sqless.uuid_generate_v1() PRIMARY KEY,
	account uuid NOT NULL REFERENCES sqless.accounts(id),
	hash varchar NULL,
	"schema" varchar NOT NULL
);`

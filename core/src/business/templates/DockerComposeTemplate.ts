import { Template } from "./Template"
import { Renderer } from "./Renderer";

export default {
    path: '.sqless/sqless-config.yaml',
    content: new Renderer(`
version: '2.0'
services:
    db:
    image: postgres
    ports:
    - "5432:5432"
    environment:
        POSTGRES_PASSWORD: postgres
    volumes:
        - ./postgres-init.sql:/docker-entrypoint-initdb.d/01-init.sql
    keycloak:
    image: jboss/keycloak
    ports:
    - "8180:8080"
    depends_on:
    - db
    environment:
        DB_VENDOR: postgres
        DB_DATABASE: keycloak
        DB_ADDR: db
        DB_PORT: 5432
        DB_USER: keycloak
        DB_PASSWORD: keycloak
`)
} as Template;

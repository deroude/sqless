import { Template } from "./Template"
import { Renderer } from "./Renderer";

export default {
    path: '.sqless/sqless-config.yaml',
    content: new Renderer(`
version: 0.0.1
dbConnection:
    type: postgres
    database: postgres
    host: localhost
    port: 5432
    user: postgres
    password: postgres
apiPath: {{ apiPath }}
`)
} as Template;
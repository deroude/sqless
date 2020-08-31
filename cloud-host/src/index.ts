import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import swaggerUi from 'swagger-ui-express';

import { OpenAPIObject, PathItemObject, ParameterObject, SchemaObject } from 'openapi3-ts';

import { DataService } from './data.service';

import { FirestoreService } from './firestore.service';
import { XSQLOperation } from "./domain";
import * as _ from "lodash";

// initialize configuration
dotenv.config();


const buildStatementParams = (context: any, paramSpec: string[], pathItem: PathItemObject): any[] => {
    const re: any[] = [];
    paramSpec.forEach(p => {
        const pName = p.substring(p.lastIndexOf('.') + 1);
        const pType: string = pathItem && pathItem.parameters && ((pathItem.parameters
            .find(apiP => (apiP as ParameterObject).name === pName) as ParameterObject)
            ?.schema as SchemaObject)?.type;
        if ((!!pType) && pType === 'array') {
            re.push(_.get(context, p).split(','));
        } else {
            re.push(_.get(context, p));
        }
    })
    return re;
}

const executeXSQLOps = async (ops: XSQLOperation[], context: any, dbSchema: string, item: PathItemObject) => {
    let res: any;
    for (const op of ops) {
        const sql = op.template;
        if (!!op.foreach) {
            const arr = _.get(context, op.foreach.of);
            if (_.isArray(arr)) {
                for (const el of arr) {
                    const fContext: any = context;
                    fContext[op.foreach.var] = el;
                    const pool = (await DataService.getInstance()).getPool(dbSchema);
                    await pool.query(`SET search_path = '${dbSchema}';`)
                    const q = await pool.query(sql, buildStatementParams(fContext, op.params, item));
                    if (!!op.return) res = q.rows;
                }
            } else {
                console.error(`Unable to process iteration on ${op}`);
            }
        } else {
            const pool = (await DataService.getInstance()).getPool(dbSchema);
            await pool.query(`SET search_path = '${dbSchema}';`)
            const q = await pool.query(sql, buildStatementParams(context, op.params, item));
            if (!!op.return) res = q.rows;
        }
        if (!!op.assign) {
            context[op.assign.var] = res[0][op.assign.column];
        }
    }
    return res;
}

const insertHandler = (api: OpenAPIObject, basePath: string, dbSchema: string) => {
    api.servers = [{ url: `/tenants/${basePath}` }]
    for (const [apiPath, item] of Object.entries(api.paths)) {
        const formattedPath = apiPath.replace(/\{(.+)\}/g, ':$1');
        if (!!item.get) {
            app.get(`/tenants/${basePath}${formattedPath}`, async (aReq, aRes) => {
                try {
                    const context: any = { ...aReq, schema: dbSchema };
                    const ops: XSQLOperation[] = item.get['x-sql'];
                    let res: any;
                    if (!!ops) {
                        res = await executeXSQLOps(ops, context, dbSchema, item.get);
                    } else {
                        const schema = item.get.responses['200'].content['application/json'].schema;
                        if (!!schema.$ref) {
                            res = schema.$ref;
                        } else {
                            const pool = (await DataService.getInstance()).getPool(dbSchema);
                            const q = await pool.query(`SELECT * FROM ${dbSchema}.${schema.items.$ref.substring(21)}`);
                            res = q.rows;
                        }
                    }
                    aRes.send(res);
                } catch (err) {
                    aRes.status(500).send(err);
                }
            });
        }
        if (!!item.post) {
            app.post(`/tenants/${basePath}${formattedPath}`, async (aReq, aRes) => {
                try {
                    const context: any = { ...aReq, schema: dbSchema };
                    const ops: XSQLOperation[] = item.post['x-sql'];
                    let res: any;
                    if (!!ops) {
                        res = await executeXSQLOps(ops, context, dbSchema, item.post);
                    } else {
                        const table = item.post.requestBody.content['application/json'].schema.$ref.substring(21);
                        const cols: string[] = [];
                        const vals: any[] = [];
                        for (const [col, val] of Object.entries(aReq.body)) {
                            if (col !== 'id') {
                                cols.push(col);
                                vals.push(`'${val}'`);
                            }
                        }
                        const q = `INSERT INTO ${dbSchema}.${table} (${cols.join(',')}) VALUES (${vals.join(',')})`;
                        console.log(q);
                        const pool = (await DataService.getInstance()).getPool(dbSchema);
                        const r = await (pool.query(q));
                        res = r.rows;
                    }
                    aRes.send(res);
                } catch (err) {
                    aRes.status(500).send(err);
                }
            });
        }
        if (!!item.put) {
            app.put(`/tenants/${basePath}${formattedPath}`, async (aReq, aRes) => {
                try {
                    const context: any = { ...aReq, schema: dbSchema };
                    const ops: XSQLOperation[] = item.put['x-sql'];
                    let res: any;
                    if (!!ops) {
                        res = await executeXSQLOps(ops, context, dbSchema, item.put);
                    } else {
                        res = `PUT ${apiPath}`;
                    }
                    aRes.send(res);
                } catch (err) {
                    aRes.status(500).send(err);
                }
            });
        }
        if (!!item.delete) {
            app.delete(`/tenants/${basePath}${formattedPath}`, async (aReq, aRes) => {
                try {
                    const context: any = { ...aReq, schema: dbSchema };
                    const ops: XSQLOperation[] = item.delete['x-sql'];
                    let res: any;
                    if (!!ops) {
                        res = await executeXSQLOps(ops, context, dbSchema, item.delete);
                    } else {
                        res = `DELETE ${apiPath}`;
                    }
                    aRes.send(res);
                } catch (err) {
                    aRes.status(500).send(err);
                }
            });
        }
        if (!!item.patch) {
            app.patch(`/tenants/${basePath}${formattedPath}`, async (aReq, aRes) => {
                try {
                    const context: any = { ...aReq, schema: dbSchema };
                    const ops: XSQLOperation[] = item.patch['x-sql'];
                    let res: any;
                    if (!!ops) {
                        res = await executeXSQLOps(ops, context, dbSchema, item.patch);
                    } else {
                        res = `PATCH ${apiPath}`;
                    }
                    aRes.send(res);
                } catch (err) {
                    aRes.status(500).send(err);
                }
            });
        }
    }
    app.use(`/tenants/${basePath}/api-docs`, swaggerUi.serve, swaggerUi.setup(api))
}

const deleteHandler = (api: OpenAPIObject, basePath: string, dbSchema: string) => {
    const pathsToDelete: string[] = [];
    for (const [apiPath, item] of Object.entries(api.paths)) {
        pathsToDelete.push(`/tenants/${basePath}${apiPath}`);
    }
    app._router.stack = app._router.stack.filter((s: any) => !s.route || pathsToDelete.indexOf(s.route.path) === -1);
}

FirestoreService.getInstance().then(fdb => fdb.pollApis(insertHandler, insertHandler, deleteHandler));


// port is now available to the Node.js runtime
// as if it were an environment variable
const port = process.env.SERVER_PORT || 8000;

const app = express();

app.use(bodyParser.json())


// start the express server
app.listen(port, () => {
    // tslint:disable-next-line:no-console
    console.log(`server started at http://localhost:${port}`);
});
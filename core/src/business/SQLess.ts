import express, { Express, IRouterMatcher } from 'express';
import bodyParser from "body-parser";
import swaggerUi from 'swagger-ui-express';
import { OpenAPIObject } from 'openapi3-ts';
import { DelegateMethodExecutor } from '../model/Delegate';
import { QueryExecutor } from '../model/QueryExecutor';
import { OpenApiValidator } from 'express-openapi-validator';
import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';

export class SQLess {

    app: Express;
    constructor(private persistence: QueryExecutor) { }

    start(host: string, port: number): void {
        console.log('Starting Express server');
        this.app = express();

        this.app.use(bodyParser.json())


        // start the express server
        this.app.listen(port, host, () => {
            // tslint:disable-next-line:no-console
            console.log(`server started at http://${host}:${port}`);
        });
    }

    async addAPI(tenant: string, api: OpenAPIV3.Document, delegates: { [path: string]: { [method: string]: DelegateMethodExecutor } }): Promise<void> {
        console.log(`Adding API for ${tenant || 'local environment'} ... `);
        let basePath = '';
        if (tenant) {
            basePath = `/tenants/${tenant}`;
        }
        api.servers = [{ url: `${basePath}` }]
        this.app.use(`${basePath}/api-docs`, swaggerUi.serve, swaggerUi.setup(api));
        for (const [apiPath, item] of Object.entries(api.paths)) {
            const formattedPath = apiPath.replace(/\{(.+)\}/g, ':$1');
            for (const method of Object.keys(item)) {
                await new OpenApiValidator({
                    apiSpec: api
                }).install(this.app);
                const f = this.expressRequest(method, `${basePath}${formattedPath}`, async (aReq, aRes) => {
                    try {
                        const context: any = { ...aReq };
                        if (delegates[apiPath] && delegates[apiPath][method]) {
                            const delegate: DelegateMethodExecutor = delegates[apiPath][method];
                            aRes.send(await delegate.execute(context, this.persistence));
                        } else {
                            aRes.status(501).send('Method not yet implemented');
                        }
                    } catch (err) {
                        console.error(err);
                        aRes.status(500).send(err);
                    }
                });
            }
        }
        return Promise.resolve();
    }

    // TODO write a better impl
    private expressRequest(method: string, path: string, handler: (req: any, res: any) => Promise<void>): void {
        // return express.prototype[method].bind(this.app)
        switch (method.toLowerCase()) {
            case 'get':
                this.app.get(path, handler);
            case 'post':
                this.app.post(path, handler);
            case 'delete':
                this.app.delete(path, handler);
            case 'put':
                this.app.put(path, handler);
            case 'patch':
                this.app.patch(path, handler);
        }
    }
}
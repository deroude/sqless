import express, { Express } from 'express';
import bodyParser from "body-parser";
import swaggerUi from 'swagger-ui-express';
import { QueryExecutor } from '../model/QueryExecutor';
import * as  OpenApiValidator from 'express-openapi-validator';
import { Config, isFullApi } from '../model/Config';

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

    async addAPI(tenant: string, config: Config): Promise<void> {
        console.log(`Adding API for ${tenant || 'local environment'} ... `);
        let basePath = '';
        if (tenant) {
            basePath = `/tenants/${tenant}`;
        }
        if (isFullApi(config.api)) {
            config.api.servers = [{ url: `${basePath}` }];
            this.app.use(`${basePath}/api-docs`, swaggerUi.serve, swaggerUi.setup(config.api));
            this.app.use(OpenApiValidator.middleware({
                apiSpec: config.api
            }));
            this.app.use(async (err: any, req: any, res: any, next: any) => {
                // format error
                res.status(err.status || 500).json({
                    message: err.message,
                    errors: err.errors,
                });
            });
            for (const [apiPath, item] of Object.entries(config.api.paths)) {
                const formattedPath = apiPath.replace(/\{(.+)\}/g, ':$1');
                for (const method of Object.keys(item)) {
                    const f = this.expressRequest(method, `${basePath}${formattedPath}`, async (aReq, aRes) => {
                        try {
                            const context: any = { ...aReq };
                            if (config.delegateExecutors[apiPath] && config.delegateExecutors[apiPath][method]) {
                                const delegate = config.delegateExecutors[apiPath][method];
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
        }
        return Promise.resolve();
    }

    // TODO write a better impl
    private expressRequest(method: string, path: string, handler: (req: any, res: any) => Promise<void>): void {
        // return express.prototype[method].bind(this.app)
        switch (method.toLowerCase()) {
            case 'get':
                this.app.get(path, handler);
                break;
            case 'post':
                this.app.post(path, handler);
                break;
            case 'delete':
                this.app.delete(path, handler);
                break;
            case 'put':
                this.app.put(path, handler);
                break;
            case 'patch':
                this.app.patch(path, handler);
                break;
        }
    }
}
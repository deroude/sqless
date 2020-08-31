import * as key from './sqless-key.json';
import * as firebase from 'firebase-admin';
import crypto from 'crypto';
import { OpenAPIObject } from 'openapi3-ts';
import { DataService } from './data.service';

export class FirestoreService {

    private static instance: FirestoreService;

    private constructor() { };

    static async getInstance(): Promise<FirestoreService> {
        if (!FirestoreService.instance) {
            FirestoreService.instance = new FirestoreService();
            firebase.initializeApp({ credential: firebase.credential.cert(key) });
            FirestoreService.instance.db = firebase.firestore();
            FirestoreService.instance.pg = await DataService.getInstance();
        }
        return FirestoreService.instance;
    }

    db: firebase.firestore.Firestore;

    pg: DataService;

    hash(item: string) {
        return crypto.createHash('sha1').update(item).digest('hex');
    }

    pollApis(
        onInsert: (api: OpenAPIObject, basePath: string, dbSchema: string) => void,
        onUpdate: (api: OpenAPIObject, basePath: string, dbSchema: string) => void,
        onDelete: (api: OpenAPIObject, basePath: string, dbSchema: string) => void): void {

        this.db.collectionGroup('api').onSnapshot(async snapshot => {
            snapshot.docChanges().forEach(async change => {
                const parent = change.doc.ref.parent.parent.id;
                const h = this.hash(change.doc.data().content);
                const apiK = `${parent}/${change.doc.id}`;
                const api: OpenAPIObject = JSON.parse(change.doc.data().content) as OpenAPIObject;
                const dbSchema = `free_${change.doc.id.toLowerCase()}`
                if (
                    change.doc.data().state === 'PENDING' && (
                        change.type === 'added' || change.type === 'modified'
                    )
                ) {
                    try {
                        await this.pg.createOrUpdateSchema(dbSchema, parent, p => this.pg.createTables(p, api, dbSchema));
                        console.log(`tracking item ${parent}/${change.doc.id}`);
                        onInsert(api, parent, dbSchema);
                        await this.db.doc(change.doc.ref.path).update({ state: 'COMPLETE' });
                    } catch (err) {
                        console.error(err);
                        await this.db.doc(change.doc.ref.path).update({ state: 'FAILED' });
                    }
                }
                if (change.type === 'removed') {
                    try {
                        await this.pg.dropSchema(dbSchema);
                        console.log(`removed item ${parent}/${change.doc.id}`);
                        onDelete(api, parent, dbSchema);
                    } catch (err) { console.log(err) }
                }
            })
        })
    }
}
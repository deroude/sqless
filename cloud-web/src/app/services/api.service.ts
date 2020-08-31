import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { OpenAPIObject } from 'openapi3-ts';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';

export interface ApiContent {
  content: string;
  state?: string;
  baseUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private auth: AuthService, private firestore: AngularFirestore) { }

  saveApi(obj: OpenAPIObject): Observable<ApiContent> {
    return this.auth.whoAmI$.pipe(
      filter(me => !!me),
      switchMap(me => this.firestore.collection(`accounts/${me.email}/api`).get().pipe(
        switchMap(snap => {
          if (!snap.empty) {
            const batch = this.firestore.firestore.batch();
            snap.forEach(doc => batch.delete(doc.ref));
            batch.commit();
          }
          const id = this.firestore.createId();
          this.firestore.collection(`accounts/${me.email}/api`).doc(id).set({ content: JSON.stringify(obj), state: 'PENDING', baseUrl: `https://sqless.net/tenants/${me.email}` });
          return this.firestore.doc<ApiContent>(`accounts/${me.email}/api/${id}`).valueChanges();
        }))
      )
    );
  }

}

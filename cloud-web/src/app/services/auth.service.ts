import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
import { auth, User } from 'firebase/app';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { ProgressService } from './progress.service';
import { Account } from '../domain/account';
import * as firebase from 'firebase/app';
import 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public error$: Subject<string> = new BehaviorSubject<string>(null);
  public gitToken$: Subject<string> = new BehaviorSubject<string>(localStorage.getItem('githubToken'));

  constructor(private firebaseAuth: AngularFireAuth, private firestore: AngularFirestore, private progress: ProgressService) {
    this.firebaseAuth.getRedirectResult().then(result => {
      if (result.credential) {
        // This gives you a GitHub Access Token. You can use it to access the GitHub API.
        const token = (result.credential as any).accessToken;
        localStorage.setItem('githubToken', token);
        this.gitToken$.next(token);
        this.firestore.collection('accounts').doc(result.user.email).get().subscribe(doc => {
          if (!doc.exists) {
            this.firestore.collection('accounts')
              .doc<Account>(result.user.email)
              .set({ accountType: 'FREE', dateJoined: firebase.firestore.Timestamp.fromDate(new Date()) });
          }
        });
      }
    }).catch(error => {
      this.error$.next(error.message);
    });
  }

  login(): void {
    const provider = new auth.GithubAuthProvider();
    provider.addScope('repo');
    this.firebaseAuth.signInWithRedirect(provider);
  }

  logout(): void {
    this.firebaseAuth.signOut();
    localStorage.removeItem('githubToken');
  }

  get whoAmI$(): Observable<User> {
    return this.firebaseAuth.user;
  }

}

import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { Observable, of } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { filter, tap, switchMap } from 'rxjs/operators';
import { ProgressService } from './progress.service';

export interface Repo {
  id: number;
  name: string;
  full_name: string;
}

export interface RepoFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: RepoFile[];
}

@Injectable({
  providedIn: 'root'
})
export class GithubService {


  constructor(private authService: AuthService, private progress: ProgressService) { }

  public get repos(): Observable<Repo[]> {
    return this.authService.gitToken$.pipe(
      filter(t => t !== null),
      switchMap(t => {
        this.progress.start();
        return fromFetch('https://api.github.com/user/repos', { headers: { Authorization: `Bearer ${t}` } })
          .pipe(
            tap(() => this.progress.stop()),
            switchMap(response => response.json()));
      }
      )
    );
  }

  public getRepoFiles(repo: string, path: string): Observable<RepoFile[]> {
    return this.authService.gitToken$.pipe(
      filter(t => t !== null),
      switchMap(t => {
        this.progress.start();
        return fromFetch(`https://api.github.com/repos/${repo}/contents${path}`, { headers: { Authorization: `Bearer ${t}` } })
          .pipe(
            tap(() => this.progress.stop()),
            switchMap(response => response.json()));
      }
      )
    );
  }

  public loadFile(repo: string, path: string): Observable<string> {
    return this.authService.gitToken$.pipe(
      filter(t => t !== null),
      switchMap(t => {
        this.progress.start();
        return fromFetch(`https://raw.githubusercontent.com/${repo}/master/${path}`)
          .pipe(
            tap(() => this.progress.stop()),
            switchMap(response => response.text()));
      }
      )
    );
  }

}

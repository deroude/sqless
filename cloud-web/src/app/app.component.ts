import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Observable } from 'rxjs';
import { User } from 'firebase';
import { GithubService, Repo, RepoFile } from './services/github.service';
import { ProgressService } from './services/progress.service';
import * as yaml from 'js-yaml';
import { OpenAPIObject, SchemaObject } from 'openapi3-ts';
import { ApiService } from './services/api.service';
import { map, filter } from 'rxjs/operators';


@Component({
  selector: 'sqless-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  user$: Observable<User>;
  loading$: Observable<boolean>;
  repos: Repo[] = [];
  selectedRepo: Repo;
  selectedFile: RepoFile;

  completed = false;
  baseUrl = '';

  editorOptions = { theme: 'vs-light', language: 'yaml' };
  code = `openapi: 3.0.1\n  info:\n    title: Swagger Petstore`;

  constructor(
    private auth: AuthService,
    private github: GithubService,
    private progress: ProgressService,
    private apiService: ApiService) {
    this.user$ = this.auth.whoAmI$;
    this.github.repos.subscribe(rs => this.repos = rs);
    this.loading$ = this.progress.loading$;
  }

  aceConfig = {};
  // code = '';

  login(): void {
    this.auth.login();
  }

  logout(): void {
    this.auth.logout();
  }

  loadSpec(): void {
    if (this.selectedFile) {
      this.github.loadFile(this.selectedRepo.full_name, this.selectedFile.path).subscribe(yml => {
        this.code = yml;
      });
    }
  }

  get codeValid(): boolean {
    if (!!this.code.trim()) {
      try {
        const doc: OpenAPIObject = yaml.safeLoad(this.code);
        return true;
      } catch (err) {
        console.log(err);
      }
    }
    return false;
  }

  save(): void {
    const doc: OpenAPIObject = yaml.safeLoad(this.code);
    this.apiService.saveApi(doc).subscribe(d => {
      this.completed = d.state === 'COMPLETE';
      this.baseUrl = d.baseUrl;
    });
  }

  get nextActive(): boolean {
    return !!this.selectedFile || this.codeValid;
  }

  get swaggerUrl(): string {
    return `${this.baseUrl}/api-docs`;
  }

}

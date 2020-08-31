import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { AngularFireModule } from '@angular/fire';

import { AppRoutingModule } from './app-routing.module';
import { AppMaterialModule } from './app-material.module';
import { MonacoEditorModule } from 'ngx-monaco-editor';

import { AuthService } from './services/auth.service';
import { GithubService } from './services/github.service';
import { ProgressService } from './services/progress.service';
import { ApiService } from './services/api.service';

import { AppComponent } from './app.component';

import { environment } from '../environments/environment';
import { GithubBrowserComponent } from './components/github-browser/github-browser.component';
import { FormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    AppComponent,
    GithubBrowserComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    AngularFireModule.initializeApp(environment.firebase),
    AppMaterialModule,
    MonacoEditorModule.forRoot()
  ],
  providers: [AuthService, GithubService, ProgressService, ApiService],
  bootstrap: [AppComponent]
})
export class AppModule { }

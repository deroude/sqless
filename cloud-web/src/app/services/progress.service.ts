import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProgressService {

  private loadingState$: Subject<boolean> = new BehaviorSubject<boolean>(false);

  constructor() { }

  get loading$(): Observable<boolean> {
    return this.loadingState$;
  }

  public start(): void {
    setTimeout(() => this.loadingState$.next(true), 0);
  }

  public stop(): void {
    setTimeout(() => this.loadingState$.next(false), 0);
  }
}

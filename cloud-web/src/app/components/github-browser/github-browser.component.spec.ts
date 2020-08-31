import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GithubBrowserComponent } from './github-browser.component';

describe('GithubBrowserComponent', () => {
  let component: GithubBrowserComponent;
  let fixture: ComponentFixture<GithubBrowserComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GithubBrowserComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GithubBrowserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

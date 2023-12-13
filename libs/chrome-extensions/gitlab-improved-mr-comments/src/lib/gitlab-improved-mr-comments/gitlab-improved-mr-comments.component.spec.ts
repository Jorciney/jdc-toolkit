import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GitlabImprovedMrCommentsComponent } from './gitlab-improved-mr-comments.component';

describe('GitlabImprovedMrCommentsComponent', () => {
  let component: GitlabImprovedMrCommentsComponent;
  let fixture: ComponentFixture<GitlabImprovedMrCommentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GitlabImprovedMrCommentsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GitlabImprovedMrCommentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

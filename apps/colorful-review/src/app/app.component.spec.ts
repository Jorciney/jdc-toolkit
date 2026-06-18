import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { conventionalCommentsLegend } from '../conventional-comments';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('renders the legend title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Conventional Comments'
    );
  });

  it('renders one badge per legend entry', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const badges = compiled.querySelectorAll('.legend__badge');
    expect(badges.length).toBe(conventionalCommentsLegend.length);
  });
});

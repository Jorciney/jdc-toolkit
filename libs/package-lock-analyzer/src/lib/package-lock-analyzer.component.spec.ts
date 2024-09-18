import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PackageLockAnalyzerComponent } from './package-lock-analyzer.component';

describe('PackageLockAnalyzerComponent', () => {
  let component: PackageLockAnalyzerComponent;
  let fixture: ComponentFixture<PackageLockAnalyzerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PackageLockAnalyzerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PackageLockAnalyzerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

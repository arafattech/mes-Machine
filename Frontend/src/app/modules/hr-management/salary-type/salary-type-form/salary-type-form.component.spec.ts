import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalaryTypeFormComponent } from './salary-type-form.component';

describe('SalaryTypeFormComponent', () => {
  let component: SalaryTypeFormComponent;
  let fixture: ComponentFixture<SalaryTypeFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalaryTypeFormComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SalaryTypeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

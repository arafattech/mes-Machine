import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalaryTypeListComponent } from './salary-type-list.component';

describe('SalaryTypeListComponent', () => {
  let component: SalaryTypeListComponent;
  let fixture: ComponentFixture<SalaryTypeListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalaryTypeListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SalaryTypeListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

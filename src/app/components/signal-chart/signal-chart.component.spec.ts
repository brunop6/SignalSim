import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignalChartComponent } from './signal-chart.component';

describe('SignalChartComponent', () => {
  let component: SignalChartComponent;
  let fixture: ComponentFixture<SignalChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignalChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignalChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

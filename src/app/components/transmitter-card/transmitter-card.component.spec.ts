import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransmitterCardComponent } from './transmitter-card.component';

describe('TransmitterCardComponent', () => {
  let component: TransmitterCardComponent;
  let fixture: ComponentFixture<TransmitterCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransmitterCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransmitterCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

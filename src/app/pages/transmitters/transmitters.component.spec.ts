import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransmittersComponent } from './transmitters.component';

describe('TransmittersComponent', () => {
  let component: TransmittersComponent;
  let fixture: ComponentFixture<TransmittersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransmittersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransmittersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

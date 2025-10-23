import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

import { TransmitterConfig } from '../../shared/interfaces/transmitter-config';
import { FrequencyPipe } from '../../shared/pipes/frequency.pipe';
@Component({
  selector: 'app-transmitter-card',
  imports: [FrequencyPipe],
  templateUrl: './transmitter-card.component.html',
  styleUrl: './transmitter-card.component.scss'
})
export class TransmitterCardComponent {
  @Input() transmitter!: TransmitterConfig & { id: string };

  constructor(private router: Router) {}

  open(): void {
    this.router.navigate(['/transmitter', this.transmitter.id]);
  }
}

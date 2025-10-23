import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

import { TransmitterConfig } from '../../shared/interfaces/transmitter-config';
@Component({
  selector: 'app-transmitter-card',
  imports: [],
  templateUrl: './transmitter-card.component.html',
  styleUrl: './transmitter-card.component.scss'
})
export class TransmitterCardComponent {
  @Input() transmitter!: TransmitterConfig;

  constructor(private router: Router) {}

  open(): void {
    this.router.navigate(['/transmitter', this.transmitter.signalId]);
  }
}

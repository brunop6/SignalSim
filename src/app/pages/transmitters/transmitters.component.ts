import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { FirestoreService } from '../../shared/services/firestore.service';

import { TransmitterConfig } from '../../shared/interfaces/transmitter-config';

import { Modulations } from '../../shared/enums/modulations';
import { SignalTypes } from '../../shared/enums/signal-types.enum';

import { TransmitterCardComponent } from '../../components/transmitter-card/transmitter-card.component';

@Component({
  selector: 'app-transmitters',
  imports: [TransmitterCardComponent],
  templateUrl: './transmitters.component.html',
  styleUrl: './transmitters.component.scss'
})
export class TransmittersComponent {
  transmitters: Array<TransmitterConfig & { id: string }> = [];

  private firestore = inject(FirestoreService);
  private router = inject(Router);

  constructor() {
    this.loadTransmitters();
  }

  private async loadTransmitters(): Promise<void> {
    try {
      this.transmitters = await this.firestore.getAllTransmitters();
    } catch (error) {
      console.error('Error loading transmitters:', error);
    }
  }

  async createTx(): Promise<void> {
    try {
      const tx: TransmitterConfig = {
        signalId: '',
        config: {
          duration: 200, // ms
          samplingFrequency: 5000, // Hz
          signals: [
            {
              type: SignalTypes.SINE,
              amplitude: 1,
              frequency: 10,
              phase: 0
            }
          ],
          modulation: {
            carrierFrequency: 1000,
            modulationIndex: 0.5,
            modulationMode: Modulations.AM_DSB
          },
          filter: {
            lowCutoff: 0,
            highCutoff: 2000,
            order: 101
          }
        }
      };

      const newTxId = await this.firestore.saveTransmitter(tx);

      this.router.navigate(['/transmitter', newTxId]);
    } catch (error) {
      console.error('Error creating transmitter:', error);
    }
  }

  createChannel(): void {
    // Placeholder para futura navegação/criação de canal
    console.log('Criar Canal clicado');
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

}

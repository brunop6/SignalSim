import { Injectable } from '@angular/core';

// Interfaces
import { Signal } from '../interfaces/signal.interface';
import { SignalOutput } from '../interfaces/signal-output';

// Enums
import { SignalTypes } from '../enums/signal-types.enum';

@Injectable({
  providedIn: 'root'
})
export class TransmitterService {

  constructor() { }

  multiplexChannel(signals: Signal[], duration: number, fs: number): SignalOutput {
    fs = Math.max(1e-6, fs);
    const totalSamples = Math.max(1, Math.round(duration * fs));
    const output: SignalOutput = { data: [] };

    // Inicializa eixo do tempo
    for (let i = 0; i < totalSamples; i++) {
      const t = i / fs;
      output.data.push({ x: t, y: 0 });
    }

    // Acumula contribuição de cada sinal
    for (const signal of signals) {
      const f = Math.max(0, signal.frequency);

      for (let i = 0; i < totalSamples; i++) {
        const t = output.data[i].x;
        
        switch (signal.type) {
          case SignalTypes.SINE:
            output.data[i].y += signal.amplitude * Math.sin(2 * Math.PI * f * t + signal.phase);
            break;
          case SignalTypes.COSINE:
            output.data[i].y += signal.amplitude * Math.cos(2 * Math.PI * f * t + signal.phase);
            break;
          case SignalTypes.SQUARE:
            output.data[i].y += signal.amplitude * (Math.sin(2 * Math.PI * f * t + signal.phase) >= 0 ? 1 : -1);
            break;
          case SignalTypes.TRIANGLE:
            output.data[i].y += signal.amplitude * (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t + signal.phase));
            break;
          case SignalTypes.SAWTOOTH:
            output.data[i].y += signal.amplitude * (2 * (f * t - Math.floor(f * t + 0.5)));
            break;
        }
      }
    }

    return output;
  }
}

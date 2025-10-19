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
  
  /**
   * Gera um sinal analógico por duração com frequência de amostragem especificada (fs).
   * @param signal Configuração do sinal (tipo, amplitude, frequência do sinal f0, fase)
   * @param duration Duração do sinal em segundos
   * @param fs Frequência de amostragem (fs) em Hz
   * @returns SignalOutput(data: number[], frequency: fs)
   */
  generateSignal(signal: Signal, duration: number, fs: number): SignalOutput {
    const f = Math.max(0, signal.frequency);
    fs = Math.max(1e-6, fs); // evita divisão por zero
    const totalSamples = Math.max(1, Math.round(duration * fs));

    const output: SignalOutput = {
      data: []
    };

    for (let i = 0; i < totalSamples; i++) {
      const t = i / fs; // tempo em segundos
      const omega0 = 2 * Math.PI * f;

      switch (signal.type) {
        case SignalTypes.SINE:
            output.data.push({ x: t, y: Number((signal.amplitude * Math.sin(omega0 * t + signal.phase)).toFixed(6)) });
          break;
        case SignalTypes.COSINE:
          output.data.push({ x: t, y: Number((signal.amplitude * Math.cos(omega0 * t + signal.phase)).toFixed(6)) });
          break;
        case SignalTypes.SQUARE:
          output.data.push({ x: t, y: Number((signal.amplitude * (Math.sin(omega0 * t + signal.phase) >= 0 ? 1 : -1)).toFixed(6)) });
          break;
        case SignalTypes.TRIANGLE:
          output.data.push({ x: t, y: Number((signal.amplitude * (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t + signal.phase))).toFixed(6)) });
          break;
        case SignalTypes.SAWTOOTH:
            output.data.push({ x: t, y: Number((signal.amplitude * (2 * ((f * t + signal.phase / (2 * Math.PI)) - Math.floor((f * t + signal.phase / (2 * Math.PI)) + 0.5)))).toFixed(6)) });
          break;
      }
    }

    return output;
  }
}

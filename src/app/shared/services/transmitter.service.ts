import { Injectable } from '@angular/core';

// Interfaces
import { Signal } from '../interfaces/signal.interface';
import { SignalOutput } from '../interfaces/signal-output';

// Enums
import { SignalTypes } from '../enums/signal-types.enum';
import { Modulations } from '../enums/modulations';

@Injectable({
  providedIn: 'root'
})
export class TransmitterService {

  constructor() { }

  /**
   * Multiplexa vários sinais em um único sinal de saída.
   * @param signals Lista de sinais a serem multiplexados.
   * @param duration Duração total do sinal de saída (em segundos).
   * @param fs Frequência de amostragem (em Hz).
   * @returns Sinal multiplexado.
   */
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

  /**
   * Modula um sinal banda-base m(t) por uma portadora cos(2πfc t) usando esquemas AM.
   * @param message Sinal banda-base (já somado, em y) no tempo (x)
   * @param fc Frequência da portadora (Hz)
   * @param modulationIndex Índice de modulação (m), típico 0..1
   * @param mode Tipo de modulação AM (DSB, DSB-SC, SSB)
   * @returns Sinal modulado
   */
  modulateAM(message: SignalOutput, fc: number, modulationIndex: number, mode: Modulations): SignalOutput {
    if (!message?.data?.length) return { data: [] };

    const out: SignalOutput = { data: new Array(message.data.length) } as SignalOutput;

    const omega = 2 * Math.PI * fc;

    switch (mode) {
      case Modulations.AM_DSB: {
        // s(t) = [1 + m·m(t)] · cos(2πfc t)
        for (let i = 0; i < message.data.length; i++) {
          const { x: t, y: mt } = message.data[i];

          out.data[i] = { x: t, y: (1 + modulationIndex * mt) * Math.cos(omega * t) };
        }
        break;
      }
      case Modulations.AM_DSB_SC: {
        // s(t) = m·m(t) · cos(2πfc t)  (suprimida portadora)
        for (let i = 0; i < message.data.length; i++) {
          const { x: t, y: mt } = message.data[i];

          out.data[i] = { x: t, y: modulationIndex * mt * Math.cos(omega * t) };
        }
        break;
      }
      default:
        return { data: [] };
    }

    return out;
  }
}

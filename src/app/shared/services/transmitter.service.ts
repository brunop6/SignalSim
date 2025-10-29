import { Injectable, inject } from '@angular/core';

// Interfaces
import { Signal } from '../interfaces/signal.interface';
import { SignalData } from '../interfaces/signal-data';

// Enums
import { SignalTypes } from '../enums/signal-types.enum';
import { Modulations } from '../enums/modulations';

// Services
import { ModulationService } from './modulation.service';

@Injectable({
  providedIn: 'root'
})
export class TransmitterService {

  private modulationService = inject(ModulationService);

  constructor() { }

  /**
   * Cria um sinal a partir de uma lista de sinais, duração e frequência de amostragem.
   * @param signals Lista de sinais a serem combinados.
   * @param duration Duração total do sinal (em segundos).
   * @param fs Frequência de amostragem (em Hz).
   * @returns SignalData (x, y).
   */ 
  createSignal(signals: Signal[], duration: number, fs: number): SignalData {
    // Assegurando frequência de amostragem e nº de amostras positivas
    fs = Math.max(1e-6, fs);
    const totalSamples = Math.max(1, Math.round(duration * fs));

    // Inicializa eixo do tempo e amplitude
    const x = new Float64Array(totalSamples);
    const y = new Float64Array(totalSamples);

    // Preenche eixo do tempo
    for (let i = 0; i < totalSamples; i++) {
      x[i] = i / fs;
    }

    // Acumula contribuição de cada sinal
    for (const signal of signals) {
      const f = Math.max(0, signal.frequency);

      for (let i = 0; i < totalSamples; i++) {
        const t = x[i];

        switch (signal.type) {
          case SignalTypes.SINE:
            y[i] += signal.amplitude * Math.sin(2 * Math.PI * f * t + signal.phase);
            break;
          case SignalTypes.SQUARE:
            y[i] += signal.amplitude * (Math.sin(2 * Math.PI * f * t + signal.phase) >= 0 ? 1 : -1);
            break;
          case SignalTypes.TRIANGLE:
            y[i] += signal.amplitude * (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t + signal.phase));
            break;
          case SignalTypes.SAWTOOTH:
            y[i] += signal.amplitude * (2 * (f * t - Math.floor(f * t + 0.5)));
            break;
        }
      }
    }

    return { x, y };
  }

  /**
   * Modula um sinal para diferentes esquemas (AM, FM, PM).
   * @param message Sinal a ser modulado.
   * @param fc Frequência da portadora.
   * @param fs Frequência de amostragem.
   * @param modulationConst Constante de modulação.
   * @param mode Modo de modulação.
   * @returns SignalData com sinal modulado.
   */
  modulateSignal(message: SignalData, fc: number, fs: number, modulationConst: number, mode: Modulations): SignalData {
    if (!message.x.length) {
      return { x: new Float64Array(0), y: new Float64Array(0) };
    }

    let y: Float64Array;

    switch (mode) {
      case Modulations.AM_DSB:
        y = this.modulationService.modulateAM_DSB(message, fc, modulationConst);
        break;

      case Modulations.AM_DSB_SC:
        y = this.modulationService.modulateAM_DSB_SC(message, fc, modulationConst);
        break;

      case Modulations.AM_SSB:
        y = this.modulationService.modulateAM_SSB_USB(message, fc, modulationConst);
        break;

      case Modulations.PM:
        const kp = modulationConst;
        y = this.modulationService.modulatePM(message, fc, kp);
        break;

      case Modulations.FM:
        const kf = modulationConst;
        y = this.modulationService.modulateFM(message, fc, fs, kf);
        break;

      default:
        return { x: new Float64Array(0), y: new Float64Array(0) };
    }

    // Reuse x-axis from input message (no copy)
    return { x: message.x, y };
  }

}

import { Injectable, inject } from '@angular/core';

import { ModulationService } from './modulation.service';

import { SignalData } from '../interfaces/signal-data';
import { Modulations } from '../enums/modulations';

@Injectable({
  providedIn: 'root'
})
export class ReceiverService {
  private modulationService = inject(ModulationService);

  constructor() { }

  /**
   * Demodula um sinal de acordo com o esquema especificado.
   * 
   * @param modulated Sinal modulado.
   * @param fc Frequência da portadora.
   * @param fs Frequência de amostragem.
   * @param demodulationConst Constante de demodulação (ma para AM, kp para PM, kf para FM).
   * @param mode Modo de modulação/demodulação.
   * @returns SignalData com sinal demodulado.
   */
  demodulateSignal(modulated: SignalData, fc: number, fs: number, demodulationConst: number, mode: Modulations): SignalData {
    if (!modulated.x.length) {
      return { x: new Float64Array(0), y: new Float64Array(0) };
    }

    let y: Float64Array;

    switch (mode) {
      case Modulations.AM_DSB:
        y = this.modulationService.demodulateAM_DSB(modulated, fc, demodulationConst);
        break;

      case Modulations.AM_DSB_SC:
        y = this.modulationService.demodulateAM_DSB_SC(modulated, fc, demodulationConst);
        break;

      case Modulations.AM_SSB:
        y = this.modulationService.demodulateAM_SSB_USB(modulated, fc, demodulationConst);
        break;

      case Modulations.PM:
        y = this.modulationService.demodulatePM(modulated, fc, fs, demodulationConst);
        break;

      case Modulations.FM:
        y = this.modulationService.demodulateFM(modulated, fc, fs, demodulationConst);
        break;

      default:
        return { x: new Float64Array(0), y: new Float64Array(0) };
    }

    // Reuse x-axis from input signal
    return { x: modulated.x, y };
  }

}

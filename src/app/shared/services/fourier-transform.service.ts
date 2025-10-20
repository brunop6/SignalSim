import { Injectable } from '@angular/core';
import { SignalOutput } from '../interfaces/signal-output';

@Injectable({
  providedIn: 'root'
})
export class FourierTransformService {

  constructor() { }

  /**
   * Calcula a magnitude da DTFT de um vetor de coeficientes para uma frequência específica.
   * DTFT: H(f) = sum h[n] * exp(-j*2*pi*f*n/fs)
   * @param h Coeficientes do filtro
   * @param f Frequência em Hz
   * @param fs Frequência de amostragem em Hz
   * @param center Índice central do filtro (para ajuste de fase linear)
   * @returns Magnitude da DTFT em f
   */
  computeDTFT(h: Float64Array | number[], f: number, fs: number, center: number): number {
    let Re = 0, Im = 0;
    
    for (let n = 0; n < h.length; n++) {
      const theta = -2 * Math.PI * f * (n - center) / fs;
      Re += h[n] * Math.cos(theta);
      Im += h[n] * Math.sin(theta);
    }
    
    return Math.sqrt(Re * Re + Im * Im);
  }

  /**
   * Calcula a Transformada Discreta de Fourier no Tempo (DTFT) de um vetor de coeficientes.
   * Retorna o módulo da resposta em frequência para uma grade de frequências de 0 até fs/2.
   * @param h Coeficientes do filtro (Float64Array ou number[])
   * @param fs Frequência de amostragem (Hz)
   * @param nFreqs Número de pontos de frequência a calcular (padrão: 256)
   * @returns SignalOutput com x=frequência (Hz) e y=magnitude
   */
  computeFrequencyResponse(h: Float64Array | number[], fs: number, nFreqs = 256): SignalOutput {
    const N = h.length;
    const M = (N - 1) / 2; // centro (assumindo filtro simétrico)
    const data: {x: number, y: number}[] = [];

    for (let i = 0; i < nFreqs; i++) {
      const f = i * (fs / 2) / (nFreqs - 1);
      const mag = this.computeDTFT(h, f, fs, M);
      data.push({ x: f, y: mag });
    }

    return { data };
  }
}

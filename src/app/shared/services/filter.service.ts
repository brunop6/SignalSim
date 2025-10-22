import { Injectable } from '@angular/core';
import { SignalData } from '../interfaces/signal-data';

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  constructor() { }

  /**
   * Aplica um filtro FIR passa-faixa em um sinal no tempo.
   * @param signal Sinal de entrada
   * @param fLow Limite inferior da faixa de passagem
   * @param fHigh Limite superior da faixa de passagem
   * @param fs Frequência de amostragem
   * @param order Ordem do filtro (deve ser ímpar)
   * @returns Sinal filtrado
   */
  bandPass(signal: SignalData, fLow: number, fHigh: number, fs: number, order = 101): SignalData {
    if (!signal.x.length) {
      return { x: new Float64Array(0), y: new Float64Array(0) };
    }

    // Sanitize params
    fs = Math.max(1e-6, fs);

    // Ajusta ordem para ímpar (filtragem linear fase simétrica)
    if (order % 2 === 0) order += 1;
    order = Math.max(3, order);

    // Limites de frequência
    const nyq = fs / 2;
    fLow = Math.max(0, Math.min(fLow, nyq - 1e-9));
    fHigh = Math.max(0, Math.min(fHigh, nyq - 1e-9));

    if (fLow >= fHigh) {
      // Intervalo inválido, retorna cópia do sinal original
      return { x: signal.x, y: new Float64Array(signal.y) };
    }

    const h = this.designBandPassFir(order, fs, fLow, fHigh);
  const y = this.convolveSame(signal.y, h);

    // Reuse x-axis from input (no copy)
    return { x: signal.x, y };
  }

  /**
   * Projeta um FIR passa-faixa via (LP fHigh - LP fLow) com janela de Hamming
   * @param order Ordem do filtro (deve ser ímpar)
   * @param fs Frequência de amostragem
   * @param fLow Limite inferior da faixa de passagem
   * @param fHigh Limite superior da faixa de passagem
   * @returns Coeficientes do filtro FIR passa-faixa
   */
  designBandPassFir(order: number, fs: number, fLow: number, fHigh: number): Float64Array {
    const N = order;
    const M = (N - 1) / 2; // centro
    const fc1 = fLow / fs;  // normalizado (ciclos/amostra)
    const fc2 = fHigh / fs; // normalizado (ciclos/amostra)

    const h = new Float64Array(N);
    const w = new Float64Array(N);

    // Janela de Hamming
    for (let n = 0; n < N; n++) {
      w[n] = 0.54 - 0.46 * Math.cos(2 * Math.PI * n / (N - 1));
    }

    // h_bp = h_lp(fc2) - h_lp(fc1)
    for (let n = 0; n < N; n++) {
      const k = n - M;
      const h_lp2 = 2 * fc2 * this.sinc(2 * fc2 * k);
      const h_lp1 = 2 * fc1 * this.sinc(2 * fc1 * k);
      h[n] = (h_lp2 - h_lp1) * w[n];
    }

    // Normalização de ganho em frequência (aprox. unity no meio da banda)
    // Calcula ganho em f0 ~ (fLow+fHigh)/2 via DTFT discreta de h
    const f0 = (fLow + fHigh) / 2;
    if (f0 > 0) {
      const omega0 = 2 * Math.PI * (f0 / fs);
      let Re = 0, Im = 0;
      for (let n = 0; n < N; n++) {
        const theta = -omega0 * (n - M);
        Re += h[n] * Math.cos(theta);
        Im += h[n] * Math.sin(theta);
      }
      const mag = Math.hypot(Re, Im);
      if (mag > 0) {
        for (let n = 0; n < N; n++) h[n] /= mag;
      }
    }

    return h;
  }

  /**
   * Função sinc: sinc(x) = sin(pi x) / (pi x), com sinc(0)=1
   * @param x Valor de entrada
   * @returns Valor da função sinc
   */
  private sinc(x: number): number {
    if (Math.abs(x) < 1e-12) return 1;
    const pix = Math.PI * x;
    return Math.sin(pix) / pix;
  }

  /**
   * Convolução modo "same": saída com mesmo tamanho que o sinal de entrada
   * @param x Sinal de entrada
   * @param h Resposta ao impulso do filtro
   * @returns Sinal convoluído
   */
  private convolveSame(x: Float64Array, h: Float64Array): Float64Array {
    const N = x.length;
    const M = h.length;
    const out = new Float64Array(N);
    const half = Math.floor(M / 2);

    for (let n = 0; n < N; n++) {
      let acc = 0;
      for (let k = 0; k < M; k++) {
        const idx = n + k - half;
        if (idx >= 0 && idx < N) acc += x[idx] * h[k];
      }
      out[n] = acc;
    }
    return out;
  }
}

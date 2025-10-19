import { Injectable } from '@angular/core';
import { SignalOutput } from '../interfaces/signal-output';

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  constructor() { }

  /**
   * Aplica um filtro FIR passa-faixa em um sinal no tempo.
   * - Se fs não for informado, será estimado a partir do eixo do tempo (x)
   * - O filtro é projetado via janela de Hamming (windowed-sinc)
   * - A saída preserva o mesmo comprimento do sinal de entrada (convolução "same")
   */
  bandPass(signal: SignalOutput, fLow: number, fHigh: number, fs?: number, order = 101): SignalOutput {
    if (!signal?.data?.length) return { data: [] };

    // Sanitize params
    const nSamples = signal.data.length;
    fs = fs ?? this.estimateSamplingRate(signal);
    fs = Math.max(1e-6, fs);

    // Ajusta ordem para ímpar (filtragem linear fase simétrica)
    if (order % 2 === 0) order += 1;
    order = Math.max(3, order);

    // Limites de frequência
    const nyq = fs / 2;
    fLow = Math.max(0, Math.min(fLow, nyq - 1e-9));
    fHigh = Math.max(0, Math.min(fHigh, nyq - 1e-9));

    if (fLow >= fHigh) {
      // Nada a fazer: intervalo inválido, retorna cópia do sinal
      return { data: signal.data.map(p => ({ x: p.x, y: p.y })) };
    }

    // Monta vetor do sinal
    const x = new Float64Array(nSamples);
    for (let i = 0; i < nSamples; i++) x[i] = signal.data[i].y;

    const h = this.designBandPassFir(order, fs, fLow, fHigh);
    const y = this.convolveSame(x, h);

    // Retorna no mesmo formato (mantém eixo do tempo original)
    const out: SignalOutput = { data: new Array(nSamples) } as SignalOutput;
    for (let i = 0; i < nSamples; i++) {
      out.data[i] = { x: signal.data[i].x, y: y[i] };
    }
    return out;
  }

  // ===== Helpers =====

  /** Estima fs pela média das diferenças consecutivas do eixo do tempo */
  private estimateSamplingRate(signal: SignalOutput): number {
    if (!signal.data || signal.data.length < 2) return 1;
    let sumDt = 0;
    let count = 0;
    for (let i = 1; i < signal.data.length; i++) {
      const dt = signal.data[i].x - signal.data[i - 1].x;
      if (isFinite(dt) && dt > 0) {
        sumDt += dt;
        count++;
      }
    }
    const avgDt = count > 0 ? sumDt / count : 1;
    return 1 / Math.max(avgDt, 1e-12);
  }

  /**
   * Projeta um FIR passa-faixa via (LP fHigh - LP fLow) com janela de Hamming
   * - order deve ser ímpar
   */
  private designBandPassFir(order: number, fs: number, fLow: number, fHigh: number): Float64Array {
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

  /** sinc(x) = sin(pi x) / (pi x), com sinc(0)=1 */
  private sinc(x: number): number {
    if (Math.abs(x) < 1e-12) return 1;
    const pix = Math.PI * x;
    return Math.sin(pix) / pix;
  }

  /** Convolução modo "same": saída com mesmo tamanho que o sinal de entrada */
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

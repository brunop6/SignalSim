import { Injectable } from '@angular/core';
import { SignalData } from '../interfaces/signal-data';

@Injectable({
  providedIn: 'root'
})
export class FourierTransformService {

  constructor() { }

  private generateTransmitterId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Calcula a magnitude da DTFT de um vetor de coeficientes para uma frequência específica.
   * DTFT: H(f) = sum h[n] * exp(-j*2*pi*f*n/fs)
   * @param h Coeficientes do filtro
   * @param f Frequência em Hz
   * @param fs Frequência de amostragem em Hz
   * @param center Índice central do filtro (para ajuste de fase linear)
   * @returns Magnitude da DTFT em f
   */
  dtft(h: Float64Array | number[], f: number, fs: number, center: number): number {
    let Re = 0, Im = 0;

    for (let n = 0; n < h.length; n++) {
      const theta = -2 * Math.PI * f * (n - center) / fs;
      Re += h[n] * Math.cos(theta);
      Im += h[n] * Math.sin(theta);
    }

    return Math.sqrt(Re * Re + Im * Im);
  }

  /**
   * FFT (Fast Fourier Transform) - Algoritmo de Cooley-Tukey
   * @param x Array de valores reais
   * @returns Array de valores complexos
   */
  fft(x: number[]): Array<{ real: number; imag: number }> {
    const N = x.length;

    // Caso base
    if (N <= 1) {
      return [{ real: x[0] || 0, imag: 0 }];
    }

    // Divide em pares e ímpares
    const even: number[] = [];
    const odd: number[] = [];
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) even.push(x[i]);
      else odd.push(x[i]);
    }

    // Recursão
    const evenFFT = this.fft(even);
    const oddFFT = this.fft(odd);

    // Combinar
    const result: Array<{ real: number; imag: number }> = new Array(N);
    for (let k = 0; k < N / 2; k++) {
      const angle = -2 * Math.PI * k / N;
      const twiddle = { real: Math.cos(angle), imag: Math.sin(angle) };

      // Multiplicação complexa: twiddle * oddFFT[k]
      const product = {
        real: twiddle.real * oddFFT[k].real - twiddle.imag * oddFFT[k].imag,
        imag: twiddle.real * oddFFT[k].imag + twiddle.imag * oddFFT[k].real
      };

      result[k] = {
        real: evenFFT[k].real + product.real,
        imag: evenFFT[k].imag + product.imag
      };

      result[k + N / 2] = {
        real: evenFFT[k].real - product.real,
        imag: evenFFT[k].imag - product.imag
      };
    }

    return result;
  }

  /**
   * IFFT (Inverse Fast Fourier Transform)
   * @param X Array de valores complexos
   * @returns Array de valores reais
   */
  ifft(X: Array<{ real: number; imag: number }>): number[] {
    const N = X.length;

    // Conjugar
    const conj = X.map(c => ({ real: c.real, imag: -c.imag }));

    // FFT do conjugado
    const fftConj = this.fftComplex(conj);

    // Conjugar e normalizar
    return fftConj.map(c => c.real / N);
  }

  /**
   * FFT para entrada complexa
   * @param x Array de valores complexos
   * @returns Array de valores complexos
   */
  fftComplex(x: Array<{ real: number; imag: number }>): Array<{ real: number; imag: number }> {
    const N = x.length;

    if (N <= 1) return x;

    const even: Array<{ real: number; imag: number }> = [];
    const odd: Array<{ real: number; imag: number }> = [];
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) even.push(x[i]);
      else odd.push(x[i]);
    }

    const evenFFT = this.fftComplex(even);
    const oddFFT = this.fftComplex(odd);

    const result: Array<{ real: number; imag: number }> = new Array(N);
    for (let k = 0; k < N / 2; k++) {
      const angle = -2 * Math.PI * k / N;
      const twiddle = { real: Math.cos(angle), imag: Math.sin(angle) };

      const product = {
        real: twiddle.real * oddFFT[k].real - twiddle.imag * oddFFT[k].imag,
        imag: twiddle.real * oddFFT[k].imag + twiddle.imag * oddFFT[k].real
      };

      result[k] = {
        real: evenFFT[k].real + product.real,
        imag: evenFFT[k].imag + product.imag
      };

      result[k + N / 2] = {
        real: evenFFT[k].real - product.real,
        imag: evenFFT[k].imag - product.imag
      };
    }

    return result;
  }

  /**
   * Calcula a Transformada Discreta de Fourier no Tempo (DTFT) de um vetor de coeficientes.
   * Retorna o módulo da resposta em frequência para uma grade de frequências de 0 até fs/2.
   * @param h Coeficientes do filtro (Float64Array ou number[])
   * @param fs Frequência de amostragem (Hz)
   * @param nFreqs Número de pontos de frequência a calcular (padrão: 256)
   * @returns SignalData com x=frequência (Hz) e y=magnitude
   */
  computeFrequencyResponse(h: Float64Array, fs: number, nFreqs = 256): SignalData {
    const N = h.length;
    const M = (N - 1) / 2; // centro (assumindo filtro simétrico)
    
    const x = new Float64Array(nFreqs);
    const y = new Float64Array(nFreqs);

    for (let i = 0; i < nFreqs; i++) {
      const f = i * (fs / 2) / (nFreqs - 1);
      x[i] = f;
      y[i] = this.dtft(h, f, fs, M);
    }

    return { x, y }; // Return SignalData
  }

  /**
   * Calcula o espectro de magnitude de um sinal usando FFT.
   * Retorna apenas as frequências positivas (0 até fs/2).
   * @param signal SignalData de entrada
   * @param fs Frequência de amostragem (Hz)
   * @returns SignalData com x=frequência (Hz) e y=magnitude normalizada
   */
  computeSpectrum(signal: SignalData, fs: number): SignalData {
    if (!signal.x.length) {
      return { x: new Float64Array(0), y: new Float64Array(0) };
    }

      const N = signal.y.length;
    
    // Fazer padding para próxima potência de 2
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
    const padded = new Float64Array(nextPow2);
    padded.set(signal.y);
    
    // Aplicar FFT (convert to number[] for FFT input)
    const fftResult = this.fft(Array.from(padded));
    const fftLen = fftResult.length;
    
    // Calcular magnitudes e frequências (apenas metade positiva)
    const halfLen = Math.floor(fftLen / 2) + 1;
    const x = new Float64Array(halfLen);
    const y = new Float64Array(halfLen);
    
    for (let k = 0; k < halfLen; k++) {
      x[k] = k * fs / fftLen;
      const magnitude = Math.sqrt(fftResult[k].real ** 2 + fftResult[k].imag ** 2) / N;
      
      // Dobrar a magnitude para frequências positivas (exceto DC e Nyquist)
      y[k] = (k > 0 && k < fftLen / 2) ? 2 * magnitude : magnitude;
    }
        
    return { x, y }; // Return SignalData
  }
}

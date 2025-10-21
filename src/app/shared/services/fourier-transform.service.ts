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
   * @returns SignalOutput com x=frequência (Hz) e y=magnitude
   */
  computeFrequencyResponse(h: Float64Array | number[], fs: number, nFreqs = 256): SignalOutput {
    const N = h.length;
    const M = (N - 1) / 2; // centro (assumindo filtro simétrico)
    const data: { x: number, y: number }[] = [];

    for (let i = 0; i < nFreqs; i++) {
      const f = i * (fs / 2) / (nFreqs - 1);
      const mag = this.dtft(h, f, fs, M);
      data.push({ x: f, y: mag });
    }

    return { data };
  }

  /**
   * Calcula o espectro de magnitude de um sinal usando FFT.
   * Retorna apenas as frequências positivas (0 até fs/2).
   * @param signal Sinal de entrada (SignalOutput)
   * @param fs Frequência de amostragem (Hz)
   * @returns SignalOutput com x=frequência (Hz) e y=magnitude normalizada
   */
  computeSpectrum(signal: SignalOutput, fs: number): SignalOutput {
    if (!signal?.data?.length) {
      return { data: [] };
    }

    const N = signal.data.length;
    
    // Extrair valores do sinal
    let x = signal.data.map(p => p.y);
    
    // Fazer padding para próxima potência de 2
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
    while (x.length < nextPow2) {
      x.push(0);
    }
    
    // Aplicar FFT
    const fftResult = this.fft(x);
    const fftLen = fftResult.length;
    
    // Calcular magnitudes e frequências (apenas metade positiva)
    const data: { x: number, y: number }[] = [];
    const halfLen = Math.floor(fftLen / 2) + 1;
    
    for (let k = 0; k < halfLen; k++) {
      const freq = k * fs / fftLen;
      const magnitude = Math.sqrt(fftResult[k].real ** 2 + fftResult[k].imag ** 2) / N;
      
      // Dobrar a magnitude para frequências positivas (exceto DC e Nyquist)
      const adjustedMag = (k > 0 && k < fftLen / 2) ? 2 * magnitude : magnitude;
      
      data.push({ x: freq, y: adjustedMag });
    }
    
    return { data };
  }
}

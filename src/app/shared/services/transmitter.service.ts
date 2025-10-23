import { Injectable, inject } from '@angular/core';

// Interfaces
import { Signal } from '../interfaces/signal.interface';
import { SignalData } from '../interfaces/signal-data';

// Enums
import { SignalTypes } from '../enums/signal-types.enum';
import { Modulations } from '../enums/modulations';

// Services
import { FourierTransformService } from './fourier-transform.service';

@Injectable({
  providedIn: 'root'
})
export class TransmitterService {

  private fTService = inject(FourierTransformService);

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
   * Modula um sinal AM-DSB.
   * 
   * s(t) = (1 + ma * m(t)) * cos(2πfc * t)
   * @param message Sinal a ser modulado.
   * @param fc Frequência da portadora.
   * @param ma Índice de modulação.
   * @returns Sinal modulado (no eixo y).
   */
  modulateAM_DSB(message: SignalData, fc: number, ma: number): Float64Array {
    const N = message.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    for (let i = 0; i < N; i++) {
      const t = message.x[i];
      const mt = message.y[i];

      out[i] = (1 + ma * mt) * Math.cos(omegaC * t);
    }
    return out;
  }

  /**
   * Modula um sinal AM-DSB-SC.
   * 
   * s(t) = ma * m(t) * cos(2πfc * t)
   * @param message Sinal a ser modulado.
   * @param fc Frequência da portadora.
   * @param ma Índice de modulação.
   * @returns Sinal modulado (no eixo y).
   */
  modulateAM_DSB_SC(message: SignalData, fc: number, ma: number): Float64Array {
    const N = message.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    for (let i = 0; i < N; i++) {
      const t = message.x[i];
      const mt = message.y[i];

      out[i] = ma * mt * Math.cos(omegaC * t);
    }

    return out;
  }

  /**
   * Modula um sinal PM.
   * 
   * s(t) = cos(2πfc t + kp·m(t))
   * @param m Sinal a ser modulado.
   * @param fc Frequência da portadora.
   * @param kp Constante de modulação PM.
   * @returns Sinal modulado (no eixo y).
   */
  modulatePM(m: SignalData, fc: number, kp: number): Float64Array {
    const N = m.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    for (let i = 0; i < N; i++) {
      const t = m.x[i];
      const mt = m.y[i];

      out[i] = Math.cos(omegaC * t + kp * mt);
    }
    return out;
  }

  /**
   * Modula um sinal FM.
   * 
   * s(t) = cos(2πfc t + kf·cumsum(m(t))/fs)
   * @param m Sinal a ser modulado.
   * @param fc Frequência da portadora.
   * @param fs Frequência de amostragem.
   * @param kf Constante de modulação FM.
   * @returns Sinal modulado (no eixo y).
   */
  modulateFM(m: SignalData, fc: number, fs: number, kf: number): Float64Array {
    const N = m.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    let sum = 0; // cumsum(m(t))
    for (let i = 0; i < N; i++) {
      const t = m.x[i];
      const mt = m.y[i];

      sum += mt;

      const phase = omegaC * t + kf * sum / fs;
      out[i] = Math.cos(phase);
    }

    return out;
  }

  /**
   * Modula um sinal AM-SSB-USB (Single Sideband - Upper Sideband) usando o método de Hilbert.
   * 
   * s(t) = m(t) * cos(2πfc*t) - mh(t) * sin(2πfc*t)
   * onde mh(t) é a transformada de Hilbert de m(t)
   * 
   * @param message Sinal a ser modulado
   * @param fc Frequência da portadora
   * @param ma Índice de modulação
   * @returns Sinal modulado SSB-USB (no eixo y)
   */
  modulateAM_SSB_USB(message: SignalData, fc: number, ma: number): Float64Array {
    const N = message.x.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    // Calcular a transformada de Hilbert
    const hilbert = this.hilbertTransform(message);

    // Gerar SSB-USB: s(t) = ma * [m(t) * cos(ωc*t) - mh(t) * sin(ωc*t)]
    for (let i = 0; i < N; i++) {
      const t = message.x[i];
      const mt = message.y[i];
      const mht = hilbert[i];

      out[i] = ma * (mt * Math.cos(omegaC * t) - mht * Math.sin(omegaC * t));
    }

    return out;
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
        y = this.modulateAM_DSB(message, fc, modulationConst);
        break;

      case Modulations.AM_DSB_SC:
        y = this.modulateAM_DSB_SC(message, fc, modulationConst);
        break;

      case Modulations.AM_SSB:
        y = this.modulateAM_SSB_USB(message, fc, modulationConst);
        break;

      case Modulations.PM:
        const kp = modulationConst;
        y = this.modulatePM(message, fc, kp);
        break;

      case Modulations.FM:
        const kf = modulationConst;
        y = this.modulateFM(message, fc, fs, kf);
        break;

      default:
        return { x: new Float64Array(0), y: new Float64Array(0) };
    }

    // Reuse x-axis from input message (no copy)
    return { x: message.x, y };
  }

  /**
 * Calcula a transformada de Hilbert de um sinal usando FFT.
 * A transformada de Hilbert desloca a fase de todas as componentes de frequência em -90°.
 * 
 * @param signal Sinal de entrada
 * @returns Float64Array com sinal transformado (componente em quadratura)
 */
  private hilbertTransform(signal: SignalData): Float64Array {
    const N = signal.y.length;
    const out = new Float64Array(N);

    // Fazer padding para próxima potência de 2
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
    const padded = new Float64Array(nextPow2);
    padded.set(signal.y);

    // Aplicar FFT (convert Float64Array to number[] for FFT input)
    const fft = this.fTService.fft(Array.from(padded));
    const fftLen = fft.length;

    // Criar o filtro de Hilbert no domínio da frequência
    // H(f) = -j para f > 0, +j para f < 0, 0 para f = 0
    for (let k = 0; k < fftLen; k++) {
      if (k === 0 || k === fftLen / 2) {
        // DC e Nyquist: multiplicar por 0
        fft[k].real = 0;
        fft[k].imag = 0;
      } else if (k < fftLen / 2) {
        // Frequências positivas: multiplicar por -j (rotação de -90°)
        const temp = fft[k].real;
        fft[k].real = fft[k].imag;
        fft[k].imag = -temp;
      } else {
        // Frequências negativas: multiplicar por +j (rotação de +90°)
        const temp = fft[k].real;
        fft[k].real = -fft[k].imag;
        fft[k].imag = temp;
      }
    }

    // Aplicar IFFT
    const result = this.fTService.ifft(fft);

    // Construir saída (apenas os N primeiros elementos, descartando o padding)
    for (let i = 0; i < N; i++) {
      out[i] = result[i];
    }

    return out;
  }
}

import { Injectable } from '@angular/core';

// Interfaces
import { Signal } from '../interfaces/signal.interface';
import { SignalOutput } from '../interfaces/signal-output';

// Enums
import { SignalTypes } from '../enums/signal-types.enum';
import { Modulations } from '../enums/modulations';

// Services
import { FilterService } from './filter.service';
import { FourierTransformService } from './fourier-transform.service';

@Injectable({
  providedIn: 'root'
})
export class TransmitterService {

  constructor(
    private filterService: FilterService,
    private fTService: FourierTransformService
  ) { }

  /**
   * Cria um sinal a partir de uma lista de sinais, duração e frequência de amostragem.
   * @param signals Lista de sinais a serem combinados.
   * @param duration Duração total do sinal (em segundos).
   * @param fs Frequência de amostragem (em Hz).
   * @returns Sinal combinado.
   */
  createSignal(signals: Signal[], duration: number, fs: number): SignalOutput {
    // Assegurando frequência de amostragem e nº de amostras positivas
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
   * Modula um sinal AM-DSB.
   * 
   * s(t) = (1 + ma * m(t)) * cos(2πfc * t)
   * @param message Sinal a ser modulado.
   * @param fc Frequência da portadora.
   * @param ma Índice de modulação.
   * @returns Sinal modulado.
   */
  modulateAM_DSB(message: SignalOutput, fc: number, ma: number): SignalOutput {
    const N = message.data.length;
    const out: SignalOutput = { data: new Array(N) } as SignalOutput;
    const omegaC = 2 * Math.PI * fc;

    for (let i = 0; i < N; i++) {
      const { x: t, y: mt } = message.data[i];
      out.data[i] = { x: t, y: (1 + ma * mt) * Math.cos(omegaC * t) };
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
   * @returns Sinal modulado.
   */
  modulateAM_DSB_SC(message: SignalOutput, fc: number, ma: number): SignalOutput {
    const N = message.data.length;
    const out: SignalOutput = { data: new Array(N) } as SignalOutput;
    const omegaC = 2 * Math.PI * fc;

    for (let i = 0; i < N; i++) {
      const { x: t, y: mt } = message.data[i];
      out.data[i] = { x: t, y: ma * mt * Math.cos(omegaC * t) };
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
   * @returns Sinal modulado.
   */
  modulatePM(m: SignalOutput, fc: number, kp: number): SignalOutput {
    const N = m.data.length;
    const out: SignalOutput = { data: new Array(N) } as SignalOutput;
    const omegaC = 2 * Math.PI * fc;
    
    for (let i = 0; i < N; i++) {
      const { x: t, y: mt } = m.data[i];

      out.data[i] = { x: t, y: Math.cos(omegaC * t + kp * mt) };
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
   * @returns Sinal modulado.
   */
  modulateFM(m: SignalOutput, fc: number, fs: number, kf: number): SignalOutput {
    const N = m.data.length;
    const out: SignalOutput = { data: new Array(N) } as SignalOutput;
    const omegaC = 2 * Math.PI * fc;

    let sum = 0; // cumsum(m(t))
    for (let i = 0; i < N; i++) {
      const { x: t, y: mt } = m.data[i];
      sum += mt;

      const phase = omegaC * t + kf * sum / fs;
      out.data[i] = { x: t, y: Math.cos(phase) };
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
   * @returns Sinal modulado SSB-USB
   */
  modulateAM_SSB_USB(message: SignalOutput, fc: number, ma: number): SignalOutput {
    const N = message.data.length;
    const out: SignalOutput = { data: new Array(N) };
    const omegaC = 2 * Math.PI * fc;
    
    // Calcular a transformada de Hilbert
    const hilbert = this.hilbertTransform(message);
    
    // Gerar SSB-USB: s(t) = ma * [m(t) * cos(ωc*t) - mh(t) * sin(ωc*t)]
    for (let i = 0; i < N; i++) {
      const { x: t } = message.data[i];
      const mt = message.data[i].y;
      const mht = hilbert.data[i].y;
      
      out.data[i] = {
        x: t,
        y: ma * (mt * Math.cos(omegaC * t) - mht * Math.sin(omegaC * t))
      };
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
   * @returns Sinal modulado.
   */
  modulateSignal(message: SignalOutput, fc: number, fs: number, modulationConst: number, mode: Modulations): SignalOutput {
    if (!message?.data?.length) return { data: [] };

    let out: SignalOutput;

    switch (mode) {
      case Modulations.AM_DSB:
        out = this.modulateAM_DSB(message, fc, modulationConst);
        break;

      case Modulations.AM_DSB_SC:
        out = this.modulateAM_DSB_SC(message, fc, modulationConst);
        break;

      case Modulations.AM_SSB:
        out = this.modulateAM_SSB_USB(message, fc, modulationConst);
        break;

      case Modulations.PM:
        const kp = modulationConst;

        out = this.modulatePM(message, fc, kp);
        break;

      case Modulations.FM:
        const kf = modulationConst;

        out = this.modulateFM(message, fc, fs, kf);
        break;

      default:
        return { data: [] };
    }

    return out;
  }

    /**
   * Calcula a transformada de Hilbert de um sinal usando FFT.
   * A transformada de Hilbert desloca a fase de todas as componentes de frequência em -90°.
   * 
   * @param signal Sinal de entrada
   * @returns Sinal transformado (componente em quadratura)
   */
  private hilbertTransform(signal: SignalOutput): SignalOutput {
    const N = signal.data.length;
    const out: SignalOutput = { data: new Array(N) };
    
    // Extrair apenas os valores y do sinal
    let x = signal.data.map(p => p.y);
    
    // Fazer padding para próxima potência de 2
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
    while (x.length < nextPow2) {
      x.push(0);
    }
    
    // Aplicar FFT
    const fft = this.fTService.fft(x);
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
      out.data[i] = { x: signal.data[i].x, y: result[i] };
    }
    
    return out;
  }
}

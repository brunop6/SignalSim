import { Injectable, inject } from '@angular/core';

// Interfaces
import { SignalData } from '../interfaces/signal-data';

// Enums
import { Modulations } from '../enums/modulations';

// Services
import { FourierTransformService } from './fourier-transform.service';

@Injectable({
  providedIn: 'root'
})
export class ModulationService {

  private fTService = inject(FourierTransformService);

  constructor() { }

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

  // ==================== DEMODULAÇÃO ====================

  /**
   * Demodula um sinal AM-DSB usando detector de envelope.
   * 
   * m(t) = |s(t)| - 1
   * @param modulated Sinal modulado.
   * @param fc Frequência da portadora (não usado neste método, mas mantido para consistência).
   * @param ma Índice de modulação.
   * @returns Sinal demodulado (no eixo y).
   */
  demodulateAM_DSB(modulated: SignalData, fc: number, ma: number): Float64Array {
    const N = modulated.y.length;
    const out = new Float64Array(N);

    // Detector de envelope simples: calcular envelope e remover offset
    const envelope = this.envelopeDetector(modulated);
    
    for (let i = 0; i < N; i++) {
      // Remover componente DC e normalizar pelo índice de modulação
      out[i] = (envelope[i] - 1) / ma;
    }

    return out;
  }

  /**
   * Demodula um sinal AM-DSB-SC usando detecção coerente (multiplicação pela portadora).
   * 
   * m(t) = s(t) * cos(2πfc*t) * 2 (após filtragem passa-baixa)
   * @param modulated Sinal modulado.
   * @param fc Frequência da portadora.
   * @param ma Índice de modulação.
   * @returns Sinal demodulado (no eixo y).
   */
  demodulateAM_DSB_SC(modulated: SignalData, fc: number, ma: number): Float64Array {
    const N = modulated.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    // Detecção coerente: multiplicar pelo cosseno da portadora
    for (let i = 0; i < N; i++) {
      const t = modulated.x[i];
      // Multiplicar por 2 para compensar a perda de amplitude
      out[i] = (2 * modulated.y[i] * Math.cos(omegaC * t)) / ma;
    }

    // Nota: O resultado precisa ser filtrado com passa-baixa para remover 
    // a componente em 2fc. Isso deve ser feito externamente com FilterService.
    return out;
  }

  /**
   * Demodula um sinal AM-SSB-USB usando detecção coerente.
   * 
   * @param modulated Sinal modulado SSB-USB
   * @param fc Frequência da portadora
   * @param ma Índice de modulação
   * @returns Sinal demodulado (no eixo y)
   */
  demodulateAM_SSB_USB(modulated: SignalData, fc: number, ma: number): Float64Array {
    const N = modulated.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    // Detecção coerente para SSB
    for (let i = 0; i < N; i++) {
      const t = modulated.x[i];
      // Multiplicar por 2 para compensar
      out[i] = (2 * modulated.y[i] * Math.cos(omegaC * t)) / ma;
    }

    // Nota: filtrar com passa-baixa externamente
    return out;
  }

  /**
   * Demodula um sinal PM usando discriminador de fase.
   * 
   * m(t) = [fase instantânea - 2πfc*t] / kp
   * @param modulated Sinal modulado PM.
   * @param fc Frequência da portadora.
   * @param fs Frequência de amostragem.
   * @param kp Constante de modulação PM.
   * @returns Sinal demodulado (no eixo y).
   */
  demodulatePM(modulated: SignalData, fc: number, fs: number, kp: number): Float64Array {
    const N = modulated.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    // Calcular fase instantânea usando arctan da transformada de Hilbert
    const hilbert = this.hilbertTransform(modulated);

    for (let i = 0; i < N; i++) {
      const t = modulated.x[i];
      // Fase instantânea
      const phase = Math.atan2(hilbert[i], modulated.y[i]);
      // Remover fase da portadora e normalizar
      out[i] = (phase - omegaC * t) / kp;
    }

    return out;
  }

  /**
   * Demodula um sinal FM usando discriminador de frequência.
   * 
   * m(t) = [d(fase)/dt - 2πfc] * fs / kf
   * @param modulated Sinal modulado FM.
   * @param fc Frequência da portadora.
   * @param fs Frequência de amostragem.
   * @param kf Constante de modulação FM.
   * @returns Sinal demodulado (no eixo y).
   */
  demodulateFM(modulated: SignalData, fc: number, fs: number, kf: number): Float64Array {
    const N = modulated.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    // Calcular fase instantânea
    const hilbert = this.hilbertTransform(modulated);
    const phase = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      phase[i] = Math.atan2(hilbert[i], modulated.y[i]);
    }

    // Derivada da fase = frequência instantânea
    // Usar diferenças finitas
    for (let i = 1; i < N - 1; i++) {
      // Derivada central
      const dPhase = (phase[i + 1] - phase[i - 1]) / 2;
      // Normalizar e remover portadora
      out[i] = (dPhase * fs / (2 * Math.PI) - fc) * fs / kf;
    }

    // Primeira e última amostra (diferenças forward/backward)
    out[0] = (phase[1] - phase[0]) * fs / (2 * Math.PI * kf);
    out[N - 1] = (phase[N - 1] - phase[N - 2]) * fs / (2 * Math.PI * kf);

    return out;
  }

  /**
   * Função auxiliar: Detector de envelope usando transformada de Hilbert.
   * 
   * envelope(t) = sqrt(s²(t) + sh²(t))
   * onde sh(t) é a transformada de Hilbert de s(t)
   * 
   * @param signal Sinal de entrada
   * @returns Float64Array com envelope do sinal
   */
  private envelopeDetector(signal: SignalData): Float64Array {
    const N = signal.y.length;
    const out = new Float64Array(N);
    
    // Calcular transformada de Hilbert
    const hilbert = this.hilbertTransform(signal);

    // Calcular envelope: sqrt(s² + sh²)
    for (let i = 0; i < N; i++) {
      out[i] = Math.sqrt(signal.y[i] * signal.y[i] + hilbert[i] * hilbert[i]);
    }

    return out;
  }
}

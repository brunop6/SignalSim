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
  modulateAM_DSB(message: SignalData, fc: number, ma: number, Ac: number = 1): Float64Array {
    const N = message.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    for (let i = 0; i < N; i++) {
      const t = message.x[i];
      const mt = message.y[i];

      out[i] = Ac * (1 + ma * mt) * Math.cos(omegaC * t);
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
  modulateAM_DSB_SC(message: SignalData, fc: number, ma: number, Ac: number = 1): Float64Array {
    const N = message.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    for (let i = 0; i < N; i++) {
      const t = message.x[i];
      const mt = message.y[i];

      out[i] = Ac * ma * mt * Math.cos(omegaC * t);
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
  modulatePM(m: SignalData, fc: number, kp: number, Ac: number = 1): Float64Array {
    const N = m.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;

    for (let i = 0; i < N; i++) {
      const t = m.x[i];
      const mt = m.y[i];

      out[i] = Ac * Math.cos(omegaC * t + kp * mt);
    }
    return out;
  }

  /**
   * Modula um sinal FM.
   * 
   * s(t) = Ac * cos(2πfc·t + 2π·kf·∫m(t)dt)
   * @param m Sinal a ser modulado.
   * @param fc Frequência da portadora.
   * @param fs Frequência de amostragem.
   * @param kf Constante de modulação FM (índice de modulação).
   * @returns Sinal modulado (no eixo y).
   */
  modulateFM(m: SignalData, fc: number, fs: number, kf: number, Ac: number = 1): Float64Array {
    const N = m.y.length;
    const out = new Float64Array(N);
    const omegaC = 2 * Math.PI * fc;
    const omega_kf = 2 * Math.PI * kf;

    // Integral do sinal: cumsum(m(t)) / fs
    let integral = 0;
    for (let i = 0; i < N; i++) {
      const t = m.x[i];
      const mt = m.y[i];

      integral += mt / fs;

      const phase = omegaC * t + omega_kf * integral;
      out[i] = Ac * Math.cos(phase);
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
   * @param Ac Amplitude da portadora                               
   * @returns Sinal modulado SSB-USB (no eixo y)
   */
  modulateAM_SSB_USB(message: SignalData, fc: number, ma: number, Ac: number = 1): Float64Array {
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

      out[i] = Ac * ma * (mt * Math.cos(omegaC * t) - mht * Math.sin(omegaC * t));
      //out[i] = Ac * ma * ((mt-mht) * Math.cos(omegaC * t));
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
   * Demodula um sinal PM seguindo o método do discriminador de fase.
   * Extrai a fase instantânea usando transformada de Hilbert e remove a componente da portadora.
   * 
   * @param modulated Sinal modulado PM.
   * @param fc Frequência da portadora.
   * @param fs Frequência de amostragem.
   * @param kp Constante de modulação PM.
   * @returns Sinal demodulado (no eixo y).
   */
  demodulatePM(modulated: SignalData, fc: number, fs: number, kp: number): Float64Array {
    const N = modulated.y.length;
    
    // 1. Extração da fase instantânea usando transformada de Hilbert
    const hilbert = this.hilbertTransform(modulated);
    const instantaneousPhase = new Float64Array(N);
    
    for (let i = 0; i < N; i++) {
      instantaneousPhase[i] = Math.atan2(hilbert[i], modulated.y[i]);
    }
    
    // Unwrap da fase (remover descontinuidades de 2π)
    this.unwrapPhase(instantaneousPhase);
    
    // 2. Remoção da componente da portadora
    const omegaC = 2 * Math.PI * fc;
    const demodulated = new Float64Array(N);
    
    for (let i = 0; i < N; i++) {
      const t = modulated.x[i];
      demodulated[i] = (instantaneousPhase[i] - omegaC * t) / kp;
    }
    
    // 3. Remover componente DC
    const mean = demodulated.reduce((sum: number, val: number) => sum + val, 0) / N;
    const out = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      out[i] = demodulated[i] - mean;
    }
    
    return out;
  }

  /**
   * Demodula um sinal FM usando discriminador de frequência.
   * Calcula a frequência instantânea através da derivada da fase.
   * 
   * @param modulated Sinal modulado FM.
   * @param fc Frequência da portadora.
   * @param fs Frequência de amostragem.
   * @param kf Constante de modulação FM (índice de modulação).
   * @returns Sinal demodulado (no eixo y).
   */
  demodulateFM(modulated: SignalData, fc: number, fs: number, kf: number): Float64Array {
    const N = modulated.y.length;
    
    // 1. Extrair fase instantânea usando transformada de Hilbert
    const hilbert = this.hilbertTransform(modulated);
    const instantaneousPhase = new Float64Array(N);
    
    for (let i = 0; i < N; i++) {
      instantaneousPhase[i] = Math.atan2(hilbert[i], modulated.y[i]);
    }
    
    // 2. Unwrap da fase (remover descontinuidades de 2π)
    this.unwrapPhase(instantaneousPhase);
    
    // 3. Calcular frequência instantânea (derivada da fase)
    const instantaneousFreq = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      if (i === 0) {
        instantaneousFreq[i] = (instantaneousPhase[1] - instantaneousPhase[0]) * fs / (2 * Math.PI);
      } else if (i === N - 1) {
        instantaneousFreq[i] = (instantaneousPhase[i] - instantaneousPhase[i - 1]) * fs / (2 * Math.PI);
      } else {
        // Diferença central
        instantaneousFreq[i] = (instantaneousPhase[i + 1] - instantaneousPhase[i - 1]) * fs / (4 * Math.PI);
      }
    }
    
    // 4. Remover frequência da portadora e escalar pelo índice de modulação
    // Na modulação: phase = 2π·fc·t + 2π·kf·∫m(t)dt
    // Derivada da fase: dφ/dt = 2π·fc + 2π·kf·m(t)
    // Frequência instantânea: f_inst = dφ/dt/(2π) = fc + kf·m(t)
    // Portanto: m(t) = (f_inst - fc) / kf
    const demodulated = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      demodulated[i] = (instantaneousFreq[i] - fc) / kf;
    }
    
    // 5. Remover componente DC
    const mean = demodulated.reduce((sum: number, val: number) => sum + val, 0) / N;
    const out = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      out[i] = demodulated[i] - mean;
    }
    
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

  /**
   * Unwrap de fase: remove descontinuidades de 2π.
   * Modifica o array in-place.
   * 
   * @param phase Array de fase a ser unwrapped
   */
  private unwrapPhase(phase: Float64Array): void {
    const threshold = Math.PI;
    for (let i = 1; i < phase.length; i++) {
      const diff = phase[i] - phase[i - 1];
      if (diff > threshold) {
        // Descontinuidade positiva, subtrair 2π de todos os seguintes
        for (let j = i; j < phase.length; j++) {
          phase[j] -= 2 * Math.PI;
        }
      } else if (diff < -threshold) {
        // Descontinuidade negativa, adicionar 2π a todos os seguintes
        for (let j = i; j < phase.length; j++) {
          phase[j] += 2 * Math.PI;
        }
      }
    }
  }

  /**
   * Implementação de filtro passa-baixas Butterworth com filtfilt.
   * Aplica o filtro nos dois sentidos (forward e backward) para fase zero.
   * 
   * @param signal Sinal de entrada
   * @param fs Frequência de amostragem
   * @param cutoffFreq Frequência de corte
   * @param order Ordem do filtro
   * @returns Sinal filtrado
   */
  private butterworthLowPass(signal: Float64Array, fs: number, cutoffFreq: number, order: number): Float64Array {
    const N = signal.length;
    const nyquist = fs / 2;
    const normalizedCutoff = Math.min(cutoffFreq / nyquist, 0.99);
    
    // Proteção contra frequências inválidas
    if (normalizedCutoff <= 0 || normalizedCutoff >= 1) {
      return new Float64Array(signal);
    }
    
    // Design do filtro Butterworth de ordem 5
    // Usando transformação bilinear: w = tan(π * fc / fs)
    const wc = Math.tan(Math.PI * normalizedCutoff);
    
    // Para ordem 5, usamos um filtro IIR simplificado
    // Coeficientes aproximados para Butterworth de 1ª ordem
    const a0 = 1 + wc;
    const b0 = wc / a0;
    const b1 = wc / a0;
    const a1 = (wc - 1) / a0;
    
    // Aplicar filtro forward-backward (filtfilt)
    let y = new Float64Array(signal);
    
    // Forward pass
    const z1Forward = new Float64Array(order);
    for (let n = 0; n < N; n++) {
      const x = y[n];
      for (let i = 0; i < order; i++) {
        const yn = b0 * x + z1Forward[i];
        z1Forward[i] = b1 * x - a1 * yn;
        y[n] = yn;
      }
    }
    
    // Backward pass (reverso)
    const z1Backward = new Float64Array(order);
    for (let n = N - 1; n >= 0; n--) {
      const x = y[n];
      for (let i = 0; i < order; i++) {
        const yn = b0 * x + z1Backward[i];
        z1Backward[i] = b1 * x - a1 * yn;
        y[n] = yn;
      }
    }
    
    return y;
  }
}

import { Injectable, inject } from '@angular/core';
import { SignalData } from '../interfaces/signal-data';
import { SignalOutput } from '../interfaces/signal-output';
import { SignalValidationInfo, ChannelConfig } from '../interfaces/channel';
import { FilterService } from './filter.service';
import { FourierTransformService } from './fourier-transform.service';

@Injectable({
  providedIn: 'root'
})
export class ChannelService {
  private filterService = inject(FilterService);
  private fourierService = inject(FourierTransformService);

  constructor() { }

  /**
   * Valida os sinais selecionados para multiplexação
   * @param signals Array de sinais dos transmissores selecionados
   * @returns Informações de validação dos sinais
   */
  validateSignals(signals: SignalOutput[]): SignalValidationInfo[] {
    return signals.map(signal => {
      const numSamples = signal.data.x.length;
      const duration = numSamples > 0 ? signal.data.x[numSamples - 1] - signal.data.x[0] : 0;
      const samplingFrequency = numSamples > 1 
        ? Math.round(1 / (signal.data.x[1] - signal.data.x[0])) 
        : 0;

      return {
        transmitterId: signal.transmitterId || '',
        samplingFrequency,
        duration,
        numSamples,
        hasSignal: numSamples > 0
      };
    });
  }

  /**
   * Verifica se todos os sinais têm a mesma taxa de amostragem
   * @param validationInfos Informações de validação dos sinais
   * @returns Objeto com status de validação e frequência máxima
   */
  checkSamplingFrequencyConsistency(validationInfos: SignalValidationInfo[]): { 
    isConsistent: boolean; 
    maxFs: number;
    inconsistentTransmitters: string[];
  } {
    const frequencies = validationInfos
      .filter(info => info.hasSignal)
      .map(info => info.samplingFrequency);

    if (frequencies.length === 0) {
      return { isConsistent: true, maxFs: 0, inconsistentTransmitters: [] };
    }

    const maxFs = Math.max(...frequencies);
    const tolerance = 0.01; // 1% tolerance for floating point comparison
    
    const inconsistentTransmitters = validationInfos
      .filter(info => info.hasSignal && Math.abs(info.samplingFrequency - maxFs) / maxFs > tolerance)
      .map(info => info.transmitterId);

    return {
      isConsistent: inconsistentTransmitters.length === 0,
      maxFs,
      inconsistentTransmitters
    };
  }

  /**
   * Multiplexa os sinais somando-os no domínio do tempo
   * @param signals Array de sinais dos transmissores
   * @param targetDuration Duração alvo em segundos (número de amostras)
   * @param samplingFrequency Taxa de amostragem do canal
   * @returns SignalData com sinal multiplexado
   */
  multiplexSignals(signals: SignalOutput[], targetDuration: number, samplingFrequency: number): SignalData {
    const targetSamples = Math.round(targetDuration * samplingFrequency);
    
    if (targetSamples <= 0 || signals.length === 0) {
      return { x: new Float64Array(0), y: new Float64Array(0) };
    }

    // Inicializa arrays de saída
    const x = new Float64Array(targetSamples);
    const y = new Float64Array(targetSamples);

    // Preenche eixo do tempo
    for (let i = 0; i < targetSamples; i++) {
      x[i] = i / samplingFrequency;
    }

    // Soma os sinais
    for (const signal of signals) {
      if (!signal.data.x.length) continue;

      const signalLength = signal.data.y.length;
      
      // Adiciona os valores do sinal até o mínimo entre o tamanho do sinal e o tamanho alvo
      for (let i = 0; i < Math.min(signalLength, targetSamples); i++) {
        y[i] += signal.data.y[i];
      }
      // Valores além do tamanho do sinal são preenchidos com 0 (já inicializados)
    }

    return { x, y };
  }

  /**
   * Aplica filtro passa-faixa ao sinal multiplexado
   * @param signal Sinal a ser filtrado
   * @param lowCutoff Frequência de corte inferior (Hz)
   * @param highCutoff Frequência de corte superior (Hz)
   * @param order Ordem do filtro
   * @param fs Frequência de amostragem (Hz)
   * @returns SignalData com sinal filtrado
   */
  applyFilter(
    signal: SignalData, 
    lowCutoff: number, 
    highCutoff: number, 
    order: number, 
    fs: number
  ): SignalData {
    return this.filterService.bandPass(
      signal,
      lowCutoff,
      highCutoff,
      fs,
      order
    );
  }

  /**
   * Calcula a frequência de resposta do filtro
   * @param lowCutoff Frequência de corte inferior (Hz)
   * @param highCutoff Frequência de corte superior (Hz)
   * @param order Ordem do filtro
   * @param fs Frequência de amostragem (Hz)
   * @param maxFreq Frequência máxima para exibição (Hz)
   * @returns SignalData com resposta em frequência
   */
  getFilterFrequencyResponse(
    lowCutoff: number,
    highCutoff: number,
    order: number,
    fs: number,
    maxFreq: number
  ): SignalData {
    const h = this.filterService.designBandPassFir(order, fs, lowCutoff, highCutoff);
    return this.fourierService.computeFrequencyResponse(h, fs, 256);
  }
}

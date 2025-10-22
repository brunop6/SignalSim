import { SignalTypes } from '../enums/signal-types.enum';
import { Modulations } from '../enums/modulations';

/**
 * Interface para configuração de um sinal individual
 */
export interface SignalConfig {
  type: SignalTypes;
  amplitude: number;
  frequency: number;
  phase: number;
}

export interface ModulationConfig {
  carrierFrequency: number; // Hz
  modulationIndex: number;
  modulationMode: Modulations;
  spectrumMax?: number; // Hz
}

export interface FilterConfig {
  lowCutoff: number; // Hz
  highCutoff: number; // Hz
  order: number;
  freqRespMax?: number; // Hz
}

/**
 * Interface para configuração completa do transmissor
 * Utilizada para persistência no Firestore
 */
export interface TransmitterConfig {
  signalId: string;
  config: {
    signals: SignalConfig[];
    duration: number; // ms
    samplingFrequency: number; // Hz
    filter: FilterConfig;
    modulation: ModulationConfig;
  };
}

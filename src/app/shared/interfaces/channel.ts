import { FilterConfig } from './transmitter-config';

/**
 * Interface para a saída de dados do canal multiplexado
 */
export interface ChannelOutput {
  channelId: string;
  data: {
    x: number[];
    y: number[];
  };
}

/**
 * Interface para configuração do canal
 */
export interface ChannelConfig {
  /** IDs dos transmissores que serão multiplexados */
  transmitterIds: string[];
  /** Duração do canal em segundos */
  duration: number;
  /** Frequência de amostragem do canal (Hz) */
  samplingFrequency: number;
  /** Configuração do filtro opcional */
  filter?: FilterConfig;
  /** Indica se o filtro está habilitado */
  filterEnabled: boolean;
}

/**
 * Interface para informações de validação dos sinais
 */
export interface SignalValidationInfo {
  transmitterId: string;
  samplingFrequency: number;
  duration: number;
  numSamples: number;
  hasSignal: boolean;
}

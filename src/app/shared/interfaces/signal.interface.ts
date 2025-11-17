import { SignalTypes } from '../enums/signal-types.enum';

export interface Signal {
  type: SignalTypes;
  amplitude: number;
  frequency: number;
  phase: number;
  /**
   * Deslocamento DC (offset) a ser somado ao sinal.
   * Valor em unidades da amplitude do sinal (mesma escala do eixo y).
   */
  offset?: number;
}

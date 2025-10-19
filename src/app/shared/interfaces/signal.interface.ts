import { SignalTypes } from '../enums/signal-types.enum';

export interface Signal {
  type: SignalTypes;
  amplitude: number;
  frequency: number;
  phase: number;
}

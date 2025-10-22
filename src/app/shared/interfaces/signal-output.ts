import { SignalData } from './signal-data';
export interface SignalOutput {
  transmitterId?: string;
  channelId?: string;
  data: {
    x: number[];
    y: number[];
  };
}

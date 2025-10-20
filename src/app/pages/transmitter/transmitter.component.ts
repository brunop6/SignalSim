import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormArray } from '@angular/forms';
import { SignalChartComponent } from '../../components/signal-chart/signal-chart.component';
import { TransmitterService } from '../../shared/services/transmitter.service';
import { FilterService } from '../../shared/services/filter.service';
import { FourierTransformService } from '../../shared/services/fourier-transform.service';
import { Signal } from '../../shared/interfaces/signal.interface';
import { SignalOutput } from '../../shared/interfaces/signal-output';
import { SignalTypes } from '../../shared/enums/signal-types.enum';
import { Modulations } from '../../shared/enums/modulations';

@Component({
  selector: 'app-transmitter',
  imports: [CommonModule, ReactiveFormsModule, SignalChartComponent],
  templateUrl: './transmitter.component.html',
  styleUrl: './transmitter.component.scss'
})
export class TransmitterComponent {
  freqResponse?: SignalOutput;
  showQrCode = false;
  transmitterUrl = '';
  signalTypes = Object.values(SignalTypes);
  modulationModes = Object.values(Modulations);
  form!: FormGroup;

  baseband?: SignalOutput;
  output?: SignalOutput; // modulated
  filtered?: SignalOutput; // filtered modulated

  filterEnabled = false;

  constructor(
    private fb: FormBuilder,
    private tx: TransmitterService,
    private filter: FilterService,
    private fourier: FourierTransformService
  ) {
    this.transmitterUrl = window.location.origin + '/receiver?tx=' + this.generateTransmitterId();
    
    this.form = this.fb.group({
      duration: [200, [Validators.required, Validators.min(0)]], // ms
      samplingFrequency: [5000, [Validators.required, Validators.min(1)]], // Hz
      signals: this.fb.array([this.createSignalGroup()]),
      carrierFrequency: [1000, [Validators.required, Validators.min(1)]],
      modulationIndex: [0.5, [Validators.required, Validators.min(0), Validators.max(1)]],
      modulationMode: [Modulations.AM_DSB, Validators.required],
      filterLow: [0, [Validators.min(0)]],
      filterHigh: [2000, [Validators.min(0)]],
      filterOrder: [101, [Validators.min(3)]]
    });
  }

  // Helpers para UI
  get fs(): number {
    return Number(this.form?.get('samplingFrequency')?.value) || 0;
  }

  get nyquistViolated(): boolean {
    const maxF = this.maxFrequency;
    return maxF > 0 && this.fs < 2 * maxF;
  }

  get expectedSamples(): number {
    const duration = Number(this.form?.get('duration')?.value) || 0;
    const fs = this.fs / 1000; // converter ms para s
    return Math.max(0, Math.round(duration * fs));
  }

  get signalsForm(): FormArray<FormGroup> {
    return this.form.get('signals') as FormArray<FormGroup>;
  }

  get maxFrequency(): number {
    return this.signalsForm.controls.reduce((max, g) => {
      const f = Number(g.get('frequency')?.value) || 0;
      return Math.max(max, f);
    }, 0);
  }

  get requiredFsForModulation(): number {
    // fs >= 2 * (fc + fmax)
    const fc = Number(this.form.get('carrierFrequency')?.value) || 0;
    return 2 * (fc + this.maxFrequency);
  }

  get filterLow(): number {
    return Number(this.form.get('filterLow')?.value) || 0;
  }

  get filterHigh(): number {
    return Number(this.form.get('filterHigh')?.value) || 0;
  }

  get filterOrder(): number {
    return Math.max(3, Number(this.form.get('filterOrder')?.value) || 101);
  }

  get filterNyquistViolated(): boolean {
    return this.filterHigh >= this.fs / 2 - 1e-9;
  }

  createSignalGroup(): FormGroup {
    return this.fb.group({
      type: [SignalTypes.SINE, Validators.required],
      amplitude: [1, [Validators.required, Validators.min(0)]],
      frequency: [10, [Validators.required, Validators.min(0)]],
      phase: [0]
    });
  }

  addSignal(): void {
    this.signalsForm.push(this.createSignalGroup());
  }

  removeSignal(index: number): void {
    if (this.signalsForm.length > 1) {
      this.signalsForm.removeAt(index);
    }
  }

  filterOnOff(): void {
    this.filterEnabled = !this.filterEnabled;
    console.log('Filter enabled:', this.filterEnabled);
  }

  generate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.generateBaseband();

    // Aplica filtro passa-faixa na banda-base, se habilitado
    if (this.filterEnabled && this.baseband?.data?.length) {
      this.filtered = this.filter.bandPass(this.baseband, this.filterLow, this.filterHigh, this.fs, this.filterOrder);
    } else {
      this.filtered = undefined;
    }
    // Atualiza resposta em frequência do filtro
    this.updateFreqResponse();

    // Se um modo de modulação estiver selecionado, gera sinal modulado
    const fc = Number(this.form.get('carrierFrequency')?.value) || 0;
    const mi = Number(this.form.get('modulationIndex')?.value) || 0;
    const mode = this.form.get('modulationMode')?.value as Modulations;
    // Modula a banda-base filtrada se houver, senão a original
    const baseForMod = this.filtered ?? this.baseband;
    if (baseForMod) {
      this.output = this.tx.modulateAM(baseForMod, fc, mi, mode);
    }
  }

  private generateBaseband(): void {
    const { duration, samplingFrequency } = this.form.getRawValue();
    const dur = Number(duration) / 1000; // ms -> s
    const fs = Number(samplingFrequency);
    const signals: Signal[] = this.signalsForm.controls.map(g => ({
      type: g.get('type')?.value as SignalTypes,
      amplitude: Number(g.get('amplitude')?.value),
      frequency: Number(g.get('frequency')?.value),
      phase: Number(g.get('phase')?.value) * Math.PI / 180 // Converte graus para radianos
    }));
    // Gera banda-base e guarda
    this.baseband = this.tx.multiplexChannel(signals, dur, fs);
  }

  private generateTransmitterId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  // 1.1) Gerar Sinal (banda-base)
  generateSignal(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.generateBaseband();
    // Limpa filtrado e modulado
    this.filtered = undefined;
    this.output = undefined;
    this.freqResponse = undefined;
  }

  // 2) Gerar Filtro e aplicar na banda-base
  generateFilter(): void {
    if (!this.baseband || !this.baseband.data?.length || !this.filterEnabled) {
      this.filtered = undefined;
      this.freqResponse = undefined;
      return;
    }
    const fs = this.fs;
    this.filtered = this.filter.bandPass(this.baseband, this.filterLow, this.filterHigh, fs, this.filterOrder);
    this.updateFreqResponse();
    // Limpa modulado
    this.output = undefined;
  }

  // 3) Aplicar modulação
  generateModulation(): void {
    // Modula a banda-base filtrada se houver, senão a original
    const baseForMod = this.filtered ?? this.baseband;
    if (!baseForMod) {
      this.output = undefined;
      return;
    }
    const fc = Number(this.form.get('carrierFrequency')?.value) || 0;
    const mi = Number(this.form.get('modulationIndex')?.value) || 0;
    const mode = this.form.get('modulationMode')?.value as Modulations;
    this.output = this.tx.modulateAM(baseForMod, fc, mi, mode);
  }

  // Atualiza resposta em frequência do filtro FIR
  updateFreqResponse(): void {
    if (!this.filterEnabled || this.fs <= 0) {
      this.freqResponse = undefined;
      return;
    }
    const N = this.filterOrder;
    const fs = this.fs;
    const fLow = this.filterLow;
    const fHigh = this.filterHigh;
    
    // Obtém coeficientes FIR do FilterService
    const h: Float64Array = this.filter.designBandPassFir(N, fs, fLow, fHigh);
    
    // Calcula resposta em frequência usando FourierTransformService
    this.freqResponse = this.fourier.computeFrequencyResponse(h, fs, 256);
  }
}


import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormArray } from '@angular/forms';
import { SignalChartComponent } from '../../components/signal-chart/signal-chart.component';
import { TransmitterService } from '../../shared/services/transmitter.service';
import { FilterService } from '../../shared/services/filter.service';
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
    // Obtem coeficientes FIR
    // @ts-ignore: acesso ao método privado
    const h: Float64Array = (this.filter as any).designBandPassFir(N, fs, fLow, fHigh);
    // Frequências de 0 até fs/2
    const nFreqs = 256;
    const data: {x:number, y:number}[] = [];
    for (let i = 0; i < nFreqs; i++) {
      const f = i * (fs/2) / (nFreqs-1);
      // DTFT: H(f) = sum h[n] * exp(-j*2*pi*f*n/fs)
      let Re = 0, Im = 0;
      for (let n = 0; n < h.length; n++) {
        const theta = -2 * Math.PI * f * (n - (N-1)/2) / fs;
        Re += h[n] * Math.cos(theta);
        Im += h[n] * Math.sin(theta);
      }
      const mag = Math.sqrt(Re*Re + Im*Im);
      data.push({ x: f, y: mag });
    }
    this.freqResponse = { data };
  }
  signalTypes = Object.values(SignalTypes);
  modulationModes = Object.values(Modulations);
  form!: FormGroup;

  baseband?: SignalOutput;
  output?: SignalOutput; // modulated
  filtered?: SignalOutput; // filtered modulated

  constructor(
    private fb: FormBuilder,
    private tx: TransmitterService,
    private filter: FilterService
  ) {
    this.form = this.fb.group({
      duration: [200, [Validators.required, Validators.min(0)]], // ms
      samplingFrequency: [5000, [Validators.required, Validators.min(1)]], // Hz
      signals: this.fb.array([this.createSignalGroup()]),
      carrierFrequency: [1000, [Validators.required, Validators.min(1)]],
      modulationIndex: [0.5, [Validators.required, Validators.min(0), Validators.max(1)]],
      modulationMode: [Modulations.AM_DSB, Validators.required],
      // Filtro passa-faixa (aplicado no sinal modulado)
      filterEnabled: [false],
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

  get filterEnabled(): boolean {
    return !!this.form.get('filterEnabled')?.value;
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

  generate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { duration, samplingFrequency } = this.form.getRawValue();
    const dur = Number(duration) / 1000; // ms -> s
    const fs = Number(samplingFrequency);

    const signals: Signal[] = this.signalsForm.controls.map(g => ({
      type: g.get('type')?.value as SignalTypes,
      amplitude: Number(g.get('amplitude')?.value),
      frequency: Number(g.get('frequency')?.value),
      phase: Number(g.get('phase')?.value)
    }));

    // Gera banda-base e guarda
    this.baseband = this.tx.multiplexChannel(signals, dur, fs);

    // Aplica filtro passa-faixa na banda-base, se habilitado
    if (this.filterEnabled && this.baseband?.data?.length) {
      this.filtered = this.filter.bandPass(this.baseband, this.filterLow, this.filterHigh, fs, this.filterOrder);
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
    this.output = this.tx.modulateAM(baseForMod, fc, mi, mode);
  }
}

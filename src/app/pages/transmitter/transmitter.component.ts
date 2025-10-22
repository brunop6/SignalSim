import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormArray } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { SignalChartComponent } from '../../components/signal-chart/signal-chart.component';

// Services
import { TransmitterService } from '../../shared/services/transmitter.service';
import { FilterService } from '../../shared/services/filter.service';
import { FourierTransformService } from '../../shared/services/fourier-transform.service';
import { FirestoreService } from '../../shared/services/firestore.service';

// Interfaces
import { Signal } from '../../shared/interfaces/signal.interface';
import { SignalData } from '../../shared/interfaces/signal-data';
import { SignalOutput } from '../../shared/interfaces/signal-output';

// Enums
import { SignalTypes } from '../../shared/enums/signal-types.enum';
import { Modulations } from '../../shared/enums/modulations';
import { TransmitterConfig } from '../../shared/interfaces/transmitter-config';

@Component({
  selector: 'app-transmitter',
  imports: [CommonModule, ReactiveFormsModule, SignalChartComponent],
  templateUrl: './transmitter.component.html',
  styleUrl: './transmitter.component.scss'
})
export class TransmitterComponent implements OnInit {
  form!: FormGroup;
  showQrCode = false;
  transmitterUrl = '';
  transmitterId = '';
  transmitterConfig: TransmitterConfig | null = null;

  signalTypes = Object.values(SignalTypes);
  modulationModes = Object.values(Modulations);
  
  freqResponse?: SignalData;
  baseband?: SignalData;
  filtered?: SignalData; // filtered baseband
  output?: SignalData; // modulated
  spectrum?: SignalData; // spectrum of modulated signal

  filterEnabled = false;

  constructor(
    private fb: FormBuilder,
    private tx: TransmitterService,
    private filter: FilterService,
    private fourier: FourierTransformService,
    private firestore: FirestoreService,
    private route: ActivatedRoute
  ) {
    this.transmitterId = this.route.snapshot.paramMap.get('id') || '';
    this.transmitterUrl = window.location.origin + '/receiver?tx=' + this.transmitterId;
    
    this.form = this.fb.group({
      duration: [200, [Validators.required, Validators.min(0)]], // ms
      samplingFrequency: [5000, [Validators.required, Validators.min(1)]], // Hz
      signals: this.fb.array([this.createSignalGroup()]),
      carrierFrequency: [1000, [Validators.required, Validators.min(1)]],
      modulationIndex: [0.5, [Validators.required, Validators.min(0), Validators.max(1)]],
      modulationMode: [Modulations.AM_DSB, Validators.required],
      filterLow: [0, [Validators.min(0)]],
      filterHigh: [2000, [Validators.min(0)]],
      filterOrder: [101, [Validators.min(3)]],
      // Max frequency for plots (default fs/2)
      freqRespMax: [null],
      spectrumMax: [null]
    });

  }

  async ngOnInit(): Promise<void> {
    // Se houver um ID de transmissor na rota, tenta carregar a configuração salva
    if (this.transmitterId) {
      try {
        const cfg = await this.firestore.getTransmitterById(this.transmitterId);
        if (cfg) {
          this.transmitterConfig = cfg;
          this.populateFormFromConfig(cfg);
        }
      } catch (err) {
        console.error('Erro ao buscar configuração do transmissor:', err);
      }
    }
  }

  private populateFormFromConfig(cfg: TransmitterConfig): void {
    const c = cfg.config;

    // Reconstrói o form array de sinais
    const signalsFA = this.signalsForm;
    signalsFA.clear();
    for (const s of c.signals) {
      signalsFA.push(this.fb.group({
        type: [s.type, Validators.required],
        amplitude: [s.amplitude, [Validators.required, Validators.min(0)]],
        frequency: [s.frequency, [Validators.required, Validators.min(0)]],
        phase: [s.phase]
      }));
    }

    // Patch nos demais campos do formulário
    this.form.patchValue({
      duration: c.duration,
      samplingFrequency: c.samplingFrequency,
      carrierFrequency: c.modulation?.carrierFrequency ?? this.form.get('carrierFrequency')?.value,
      modulationIndex: c.modulation?.modulationIndex ?? this.form.get('modulationIndex')?.value,
      modulationMode: c.modulation?.modulationMode ?? this.form.get('modulationMode')?.value,
      filterLow: c.filter?.lowCutoff ?? this.form.get('filterLow')?.value,
      filterHigh: c.filter?.highCutoff ?? this.form.get('filterHigh')?.value,
      filterOrder: c.filter?.order ?? this.form.get('filterOrder')?.value,
      freqRespMax: c.filter?.freqRespMax ?? null,
      spectrumMax: c.modulation?.spectrumMax ?? null
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

  // X-axis max controls for plots
  get requestedFreqRespMax(): number {
    const v = this.form.get('freqRespMax')?.value;
    return v == null || v === '' ? this.fs / 2 : Number(v);
  }

  get requestedSpectrumMax(): number {
    const v = this.form.get('spectrumMax')?.value;
    return v == null || v === '' ? this.fs / 2 : Number(v);
  }
  
  get clampedFreqRespMax(): number {
    return Math.min(this.requestedFreqRespMax, this.fs / 2);
  }
  
  get clampedSpectrumMax(): number {
    return Math.min(this.requestedSpectrumMax, this.fs / 2);
  }
  
  get freqRespMaxExceeded(): boolean {
    return this.requestedFreqRespMax > this.fs / 2 + 1e-9;
  }
  
  get spectrumMaxExceeded(): boolean {
    return this.requestedSpectrumMax > this.fs / 2 + 1e-9;
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
  // Gera banda-base e guarda (retorna SignalData)
  this.baseband = this.tx.createSignal(signals, dur, fs);
  }

  // 1.1) Gerar Sinal (banda-base)
  generateSignal(): void {
    this.generateBaseband();
    // Limpa filtrado e modulado
    this.filtered = undefined;
    this.output = undefined;
    this.spectrum = undefined;
    this.freqResponse = undefined;
  }

  // 2) Gerar Filtro e aplicar na banda-base
  generateFilter(): void {
    if (!this.baseband || !this.baseband.x.length || !this.filterEnabled) {
      this.filtered = undefined;
      this.freqResponse = undefined;
      return;
    }
    const fs = this.fs;
    this.filtered = this.filter.bandPass(this.baseband, this.filterLow, this.filterHigh, fs, this.filterOrder);
    this.updateFreqResponse();
    // Limpa modulado e espectro
    this.output = undefined;
    this.spectrum = undefined;
  }

  // 3) Aplicar modulação
  async generateModulation(): Promise<void> {
    // Modula a banda-base filtrada se houver, senão a original
    const baseForMod = this.filtered ?? this.baseband;
    if (!baseForMod) {
      this.output = undefined;
      this.spectrum = undefined;
      return;
    }
    const fc = Number(this.form.get('carrierFrequency')?.value) || 0;
    const fs = Number(this.form.get('samplingFrequency')?.value) || 0;
    const mi = Number(this.form.get('modulationIndex')?.value) || 0;
    const mode = this.form.get('modulationMode')?.value as Modulations;
    this.output = this.tx.modulateSignal(baseForMod, fc, fs, mi, mode);
    
    // Calcular espectro do sinal modulado
    if (this.output) {
      this.spectrum = this.fourier.computeSpectrum(this.output, fs);
    }

    const signalOutput: SignalOutput = {
      transmitterId: this.transmitterId,
      data: {
        x: Array.from(this.output.x),
        y: Array.from(this.output.y)
      },
    };

    this.firestore.saveTransmitter({
      signalId: this.transmitterId,
      config: {
        duration: Number(this.form.get('duration')?.value) || 0,
        samplingFrequency: fs,
        signals: this.signalsForm.controls.map(g => ({
          type: g.get('type')?.value as SignalTypes,
          amplitude: Number(g.get('amplitude')?.value),
          frequency: Number(g.get('frequency')?.value),
          phase: Number(g.get('phase')?.value)
        })),
        modulation: {
          carrierFrequency: fc,
          modulationIndex: mi,
          modulationMode: mode,
          spectrumMax: this.requestedSpectrumMax
        },
        filter: {
          lowCutoff: this.filterLow,
          highCutoff: this.filterHigh,
          order: this.filterOrder,
          freqRespMax: this.requestedFreqRespMax
        }
      }
    }, this.transmitterId).then(() => {
      console.log('Transmitter config saved to Firestore');
    }).catch(error => {
      console.error('Error saving transmitter config to Firestore:', error);
    });

    this.firestore.saveSignalOutput(signalOutput).then(() => {
      console.log('Signal output saved to Firestore');
    }).catch(error => {
      console.error('Error saving signal output to Firestore:', error);
    });
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
    this.freqResponse = this.fourier.computeFrequencyResponse(h, fs, fs/2);
  }
}

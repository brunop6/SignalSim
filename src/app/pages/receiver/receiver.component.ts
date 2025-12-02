
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { SignalChartComponent } from '../../components/signal-chart/signal-chart.component';

import { FirestoreService } from '../../shared/services/firestore.service';
import { ReceiverService } from '../../shared/services/receiver.service';
import { FilterService } from '../../shared/services/filter.service';
import { FourierTransformService } from '../../shared/services/fourier-transform.service';

import { SignalOutput } from '../../shared/interfaces/signal-output';
import { SignalData } from '../../shared/interfaces/signal-data';
import { Modulations } from '../../shared/enums/modulations';

@Component({
  selector: 'app-receiver',
  imports: [CommonModule, ReactiveFormsModule, SignalChartComponent],
  templateUrl: './receiver.component.html',
  styleUrl: './receiver.component.scss'
})
export class ReceiverComponent implements OnInit, OnDestroy {
  id = '';
  signalOutput: SignalOutput | null = null;
  originalSignalData: SignalData | null = null;
  signalData: SignalData | null = null;
  preFiltered: SignalData | null = null;
  preFreqResponse: SignalData | null = null;
  filtered: SignalData | null = null;
  freqResponse: SignalData | null = null;
  demodulated: SignalData | null = null;
  loading = true;
  error = '';

  preFilterEnabled = false;
  filterEnabled = false;
  durationForm!: FormGroup;
  demodForm!: FormGroup;
  preFilterForm!: FormGroup;
  filterForm!: FormGroup;
  modulationModes = Object.values(Modulations);

  private route = inject(ActivatedRoute);
  private firestore = inject(FirestoreService);
  private rx = inject(ReceiverService);
  private filter = inject(FilterService);
  private fourier = inject(FourierTransformService);
  private fb = inject(FormBuilder);
  private routeSub?: any;
  private signalSub?: any;

  ngOnInit(): void {
    // Formulário de duração
    this.durationForm = this.fb.group({
      duration: [null, [Validators.min(0)]]
    });

    // Formulário de filtro pré-demodulação
    this.preFilterForm = this.fb.group({
      filterLow: [0, [Validators.min(0)]],
      filterHigh: [2000, [Validators.min(0)]],
      filterOrder: [101, [Validators.min(3)]],
      freqRespMax: [null]
    });

    // Formulário de filtro pós-demodulação
    this.filterForm = this.fb.group({
      filterLow: [0, [Validators.min(0)]],
      filterHigh: [2000, [Validators.min(0)]],
      filterOrder: [101, [Validators.min(3)]],
      freqRespMax: [null]
    });

    // Formulário de demodulação
    this.demodForm = this.fb.group({
      mode: [Modulations.AM_DSB, Validators.required],
      fc: [1000, [Validators.required, Validators.min(0)]],
      fs: [5000, [Validators.required, Validators.min(1)]],
      demodConst: [0.5, [Validators.required, Validators.min(0)]]
    });

    // Obtém o ID do transmissor ou canal da query string (?tx=ID ou ?channel=ID)
    this.routeSub = this.route.queryParams.subscribe((params) => {
      const txId = params['tx'];
      const channelId = params['channel'];
      
      if (txId) {
        this.id = txId;
        this.subscribeToSignal();
      } else if (channelId) {
        this.id = channelId;
        this.subscribeToChannel();
      } else {
        this.error = 'ID do transmissor ou canal não fornecido na URL';
        this.loading = false;
      }
    });
  }

  private subscribeToSignal(): void {
    if (!this.id) return;

    // Cancela assinatura anterior, se houver
    if (this.signalSub) {
      this.signalSub.unsubscribe();
      this.signalSub = undefined;
    }

    this.loading = true;
    this.error = '';
    
    this.signalSub = this.firestore.subscribeToSignal(this.id).subscribe((signalData) => {
      if (signalData) {
        this.signalOutput = signalData as SignalOutput;
        this.originalSignalData = {
          x: new Float64Array(this.signalOutput.data.x),
          y: new Float64Array(this.signalOutput.data.y)
        };
        this.inferSamplingRate();
        this.processSignalWithDuration();
      } else {
        this.signalOutput = null;
        this.signalData = null;
        this.filtered = null;
        this.demodulated = null;
        this.error = 'Nenhum dado de sinal encontrado para este transmissor';
      }
      this.loading = false;
    });
  }

  private subscribeToChannel(): void {
    if (!this.id) return;

    // Cancela assinatura anterior, se houver
    if (this.signalSub) {
      this.signalSub.unsubscribe();
      this.signalSub = undefined;
    }

    this.loading = true;
    this.error = '';
    
    this.signalSub = this.firestore.subscribeToChannel(this.id).subscribe((channelData) => {
      if (channelData && channelData['data']) {
        this.signalOutput = {
          channelId: this.id,
          data: channelData['data']
        };
        this.originalSignalData = {
          x: new Float64Array(this.signalOutput.data.x),
          y: new Float64Array(this.signalOutput.data.y)
        };
        this.inferSamplingRate();
        this.processSignalWithDuration();
      } else {
        this.signalOutput = null;
        this.signalData = null;
        this.filtered = null;
        this.demodulated = null;
        this.error = 'Nenhum dado encontrado para este canal';
      }
      this.loading = false;
    });
  }

  // Helpers para UI
  get fs(): number {
    return Number(this.demodForm?.get('fs')?.value) || 0;
  }

  get duration(): number | null {
    const val = this.durationForm?.get('duration')?.value;
    return val === null || val === '' ? null : Number(val);
  }

  get maxDuration(): number {
    if (!this.originalSignalData) return 0;
    const N = this.originalSignalData.x.length;
    return N > 0 ? this.originalSignalData.x[N - 1] : 0;
  }

  // Pré-filtro
  get preFilterLow(): number {
    return Number(this.preFilterForm?.get('filterLow')?.value) || 0;
  }

  get preFilterHigh(): number {
    return Number(this.preFilterForm?.get('filterHigh')?.value) || 0;
  }

  get preFilterOrder(): number {
    return Math.max(3, Number(this.preFilterForm?.get('filterOrder')?.value) || 101);
  }

  get preFilterNyquistViolated(): boolean {
    return this.preFilterHigh >= this.fs / 2 - 1e-9;
  }

  get preRequestedFreqRespMax(): number {
    const v = this.preFilterForm?.get('freqRespMax')?.value;
    return v == null || v === '' ? this.fs / 2 : Number(v);
  }

  get preClampedFreqRespMax(): number {
    return Math.min(this.preRequestedFreqRespMax, this.fs / 2);
  }

  get preFreqRespMaxExceeded(): boolean {
    return this.preRequestedFreqRespMax > this.fs / 2 + 1e-9;
  }

  // Pós-filtro
  get filterLow(): number {
    return Number(this.filterForm?.get('filterLow')?.value) || 0;
  }

  get filterHigh(): number {
    return Number(this.filterForm?.get('filterHigh')?.value) || 0;
  }

  get filterOrder(): number {
    return Math.max(3, Number(this.filterForm?.get('filterOrder')?.value) || 101);
  }

  get filterNyquistViolated(): boolean {
    return this.filterHigh >= this.fs / 2 - 1e-9;
  }

  get requestedFreqRespMax(): number {
    const v = this.filterForm?.get('freqRespMax')?.value;
    return v == null || v === '' ? this.fs / 2 : Number(v);
  }

  get clampedFreqRespMax(): number {
    return Math.min(this.requestedFreqRespMax, this.fs / 2);
  }

  get freqRespMaxExceeded(): boolean {
    return this.requestedFreqRespMax > this.fs / 2 + 1e-9;
  }

  preFilterOnOff(): void {
    this.preFilterEnabled = !this.preFilterEnabled;
    this.updatePreFilter();
    this.updateDemodulation();
  }

  applyPreFilter(): void {
    this.updatePreFilter();
  }

  applyFilter(): void {
    this.updateFilter();
  }

  applyDuration(): void {
    this.processSignalWithDuration();
  }

  applyDemodulation(): void {
    this.updateDemodulation();
  }

  inferSamplingRate(): void {
    if (!this.originalSignalData || this.originalSignalData.x.length < 2) return;

    // Calcula a diferença temporal entre o primeiro e segundo ponto
    const dt = this.originalSignalData.x[1] - this.originalSignalData.x[0];
    
    if (dt > 0) {
      // Taxa de amostragem é o inverso do período de amostragem
      const inferredFs = Math.round(1 / dt);
      
      // Atualiza o formulário com a taxa de amostragem inferida
      this.demodForm.patchValue({ fs: inferredFs });
    }
  }

  processSignalWithDuration(): void {
    if (!this.originalSignalData) return;

    const requestedDuration = this.duration;
    
    // Se não há duração especificada, usa o sinal completo
    if (requestedDuration === null || requestedDuration <= 0) {
      this.signalData = {
        x: this.originalSignalData.x,
        y: this.originalSignalData.y
      };
      this.updatePreFilter();
      this.updateDemodulation();
      return;
    }

    // Encontra o índice correspondente à duração solicitada
    const maxIdx = this.originalSignalData.x.findIndex(t => t >= requestedDuration);
    
    if (maxIdx <= 0) {
      // Duração maior que o sinal, usa tudo
      this.signalData = {
        x: this.originalSignalData.x,
        y: this.originalSignalData.y
      };
    } else {
      // Corta o sinal na duração especificada
      this.signalData = {
        x: this.originalSignalData.x.slice(0, maxIdx),
        y: this.originalSignalData.y.slice(0, maxIdx)
      };
    }

    this.updatePreFilter();
    this.updateDemodulation();
  }

  filterOnOff(): void {
    this.filterEnabled = !this.filterEnabled;
    this.updateFilter();
  }

  updatePreFilter(): void {
    if (!this.signalData || !this.signalData.x.length || !this.preFilterEnabled || this.fs <= 0) {
      this.preFiltered = null;
      this.preFreqResponse = null;
      this.updateDemodulation();
      return;
    }
    
    const fs = this.fs;
    this.preFiltered = this.filter.bandPass(this.signalData, this.preFilterLow, this.preFilterHigh, fs, this.preFilterOrder);
    this.updatePreFreqResponse();
    this.updateDemodulation();
  }

  updatePreFreqResponse(): void {
    if (!this.preFilterEnabled || this.fs <= 0) {
      this.preFreqResponse = null;
      return;
    }
    const N = this.preFilterOrder;
    const fs = this.fs;
    const fLow = this.preFilterLow;
    const fHigh = this.preFilterHigh;

    // Obtém coeficientes FIR do FilterService
    const h: Float64Array = this.filter.designBandPassFir(N, fs, fLow, fHigh);

    // Calcula resposta em frequência usando FourierTransformService
    this.preFreqResponse = this.fourier.computeFrequencyResponse(h, fs, fs / 5);
  }

  updateFilter(): void {
    if (!this.demodulated || !this.demodulated.x.length || !this.filterEnabled || this.fs <= 0) {
      this.filtered = null;
      this.freqResponse = null;
      return;
    }
    
    const fs = this.fs;
    this.filtered = this.filter.bandPass(this.demodulated, this.filterLow, this.filterHigh, fs, this.filterOrder);
    this.updateFreqResponse();
  }

  updateFreqResponse(): void {
    if (!this.filterEnabled || this.fs <= 0) {
      this.freqResponse = null;
      return;
    }
    const N = this.filterOrder;
    const fs = this.fs;
    const fLow = this.filterLow;
    const fHigh = this.filterHigh;

    // Obtém coeficientes FIR do FilterService
    const h: Float64Array = this.filter.designBandPassFir(N, fs, fLow, fHigh);

    // Calcula resposta em frequência usando FourierTransformService
    this.freqResponse = this.fourier.computeFrequencyResponse(h, fs, fs / 5);
  }

  updateDemodulation(): void {
    if (!this.signalData) {
      this.demodulated = null;
      this.filtered = null;
      return;
    }
    
    // Usa sinal pré-filtrado se o filtro pré-demodulação estiver ativado
    const inputSignal = this.preFilterEnabled && this.preFiltered ? this.preFiltered : this.signalData;
    
    const { mode, fc, fs, demodConst } = this.demodForm.value;
    this.demodulated = this.rx.demodulateSignal(inputSignal, fc, fs, demodConst, mode);
    
    // Aplica filtro após demodulação, se habilitado
    this.updateFilter();
  }

  ngOnDestroy(): void {
    if (this.routeSub?.unsubscribe) {
      this.routeSub.unsubscribe();
    }
    if (this.signalSub?.unsubscribe) {
      this.signalSub.unsubscribe();
    }
  }
}

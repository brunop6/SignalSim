
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
  signalData: SignalData | null = null;
  filtered: SignalData | null = null;
  freqResponse: SignalData | null = null;
  demodulated: SignalData | null = null;
  loading = true;
  error = '';

  filterEnabled = false;
  demodForm!: FormGroup;
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
    // Formulário de filtro
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

    // Atualiza filtro ao alterar parâmetros
    this.filterForm.valueChanges.subscribe(() => this.updateFilter());

    // Atualiza demodulação ao alterar parâmetros
    this.demodForm.valueChanges.subscribe(() => this.updateDemodulation());

    // Obtém o ID do transmissor da query string (?tx=ID)
    this.routeSub = this.route.queryParams.subscribe((params) => {
      if (params['tx']) {
        this.id = params['tx'];
      } else if (params['ch']) {
        this.id = params['ch'] || '';
      }
      if (!this.id) {
        this.error = 'ID do receptor não fornecido na URL';
        this.loading = false;
        return;
      }
      // Cancela assinatura anterior do firestore, se houver
      if (this.signalSub) {
        this.signalSub.unsubscribe();
        this.signalSub = undefined;
      }
      // Inicia nova assinatura no stream do sinal
      this.loading = true;
      this.error = '';
      this.signalSub = this.firestore.subscribeToSignal(this.id).subscribe((signalData) => {
        if (signalData) {
          this.signalOutput = signalData as SignalOutput;
          this.signalData = {
            x: new Float64Array(this.signalOutput.data.x),
            y: new Float64Array(this.signalOutput.data.y)
          };
          this.updateFilter();
          this.updateDemodulation();
        } else {
          this.signalOutput = null;
          this.signalData = null;
          this.filtered = null;
          this.demodulated = null;
          this.error = 'Nenhum dado de sinal encontrado para este ID';
        }
        this.loading = false;
      });
    });
  }

  // Helpers para UI
  get fs(): number {
    return Number(this.demodForm?.get('fs')?.value) || 0;
  }

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

  filterOnOff(): void {
    this.filterEnabled = !this.filterEnabled;
    this.updateFilter();
    this.updateDemodulation();
  }

  updateFilter(): void {
    if (!this.signalData || !this.signalData.x.length || !this.filterEnabled || this.fs <= 0) {
      this.filtered = null;
      this.freqResponse = null;
      this.updateDemodulation();
      return;
    }
    
    const fs = this.fs;
    this.filtered = this.filter.bandPass(this.signalData, this.filterLow, this.filterHigh, fs, this.filterOrder);
    this.updateFreqResponse();
    this.updateDemodulation();
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
      return;
    }
    // Demodula o sinal filtrado se o filtro estiver habilitado, senão o original
    const signalToDemodulate = (this.filterEnabled && this.filtered) ? this.filtered : this.signalData;
    
    const { mode, fc, fs, demodConst } = this.demodForm.value;
    this.demodulated = this.rx.demodulateSignal(signalToDemodulate, fc, fs, demodConst, mode);
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

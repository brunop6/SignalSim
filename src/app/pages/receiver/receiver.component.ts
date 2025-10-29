
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { SignalChartComponent } from '../../components/signal-chart/signal-chart.component';

import { FirestoreService } from '../../shared/services/firestore.service';
import { ReceiverService } from '../../shared/services/receiver.service';

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
  demodulated: SignalData | null = null;
  loading = true;
  error = '';

  demodForm!: FormGroup;
  modulationModes = Object.values(Modulations);

  private route = inject(ActivatedRoute);
  private firestore = inject(FirestoreService);
  private rx = inject(ReceiverService);
  private fb = inject(FormBuilder);
  private routeSub?: any;
  private signalSub?: any;

  ngOnInit(): void {
    // Formulário de demodulação
    this.demodForm = this.fb.group({
      mode: [Modulations.AM_DSB, Validators.required],
      fc: [1000, [Validators.required, Validators.min(0)]],
      fs: [5000, [Validators.required, Validators.min(1)]],
      demodConst: [0.5, [Validators.required, Validators.min(0)]]
    });

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
          this.updateDemodulation();
        } else {
          this.signalOutput = null;
          this.signalData = null;
          this.demodulated = null;
          this.error = 'Nenhum dado de sinal encontrado para este ID';
        }
        this.loading = false;
      });
    });
  }

  updateDemodulation(): void {
    if (!this.signalData) {
      this.demodulated = null;
      return;
    }
    const { mode, fc, fs, demodConst } = this.demodForm.value;
    this.demodulated = this.rx.demodulateSignal(this.signalData, fc, fs, demodConst, mode);
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

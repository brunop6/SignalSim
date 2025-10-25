import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { SignalChartComponent } from '../../components/signal-chart/signal-chart.component';
import { FirestoreService } from '../../shared/services/firestore.service';
import { SignalOutput } from '../../shared/interfaces/signal-output';
import { SignalData } from '../../shared/interfaces/signal-data';

@Component({
  selector: 'app-receiver',
  imports: [CommonModule, SignalChartComponent],
  templateUrl: './receiver.component.html',
  styleUrl: './receiver.component.scss'
})
export class ReceiverComponent implements OnInit {
  id = '';
  signalOutput: SignalOutput | null = null;
  signalData: SignalData | null = null;
  loading = true;
  error = '';

  private route = inject(ActivatedRoute);
  private firestore = inject(FirestoreService);
  private routeSub?: any;
  private signalSub?: any;

  async ngOnInit(): Promise<void> {
    // Obtém o ID do transmissor da query string (?tx=ID)
    this.routeSub = this.route.queryParams.subscribe((params) => {
      // Verifica se há parametro tx ou ch
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
        } else {
          this.signalOutput = null;
          this.signalData = null;
          this.error = 'Nenhum dado de sinal encontrado para este ID';
        }
        this.loading = false;
      });
    });
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

import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import QRCode from 'qrcode';

import { SignalChartComponent } from '../../../components/signal-chart/signal-chart.component';

// Services
import { ChannelService } from '../../../shared/services/channel.service';
import { FourierTransformService } from '../../../shared/services/fourier-transform.service';
import { FirestoreService } from '../../../shared/services/firestore.service';

// Interfaces
import { SignalData } from '../../../shared/interfaces/signal-data';
import { SignalOutput } from '../../../shared/interfaces/signal-output';
import { ChannelConfig, ChannelOutput, SignalValidationInfo } from '../../../shared/interfaces/channel';
import { TransmitterConfig } from '../../../shared/interfaces/transmitter-config';

@Component({
  selector: 'app-channel',
  imports: [CommonModule, ReactiveFormsModule, SignalChartComponent],
  templateUrl: './channel.component.html',
  styleUrl: './channel.component.scss'
})
export class ChannelComponent implements OnInit {
  form!: FormGroup;
  channelId = '';
  channelUrl = '';
  qrCodeDataUrl = '';
  showQrCode = false;

  availableTransmitters: Array<TransmitterConfig & { id: string }> = [];
  selectedTransmitters: Array<{ id: string; selected: boolean; signal?: SignalOutput; config?: TransmitterConfig }> = [];
  validationInfos: SignalValidationInfo[] = [];
  validationMessage = '';
  canMultiplex = false;

  multiplexedSignal?: SignalData;
  filteredSignal?: SignalData;
  spectrum?: SignalData;
  freqResponse?: SignalData;

  filterEnabled = false;

  private fb = inject(FormBuilder);
  private channelService = inject(ChannelService);
  private fourier = inject(FourierTransformService);
  private firestore = inject(FirestoreService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  constructor() {
    const routeId = this.route.snapshot.paramMap.get('id') || '';
    // Ignora 'new' como ID válido
    this.channelId = routeId === 'new' ? '' : routeId;
    this.channelUrl = `${window.location.origin}/receiver?channel=${encodeURIComponent(this.channelId)}`;

    this.form = this.fb.group({
      duration: [1, [Validators.required, Validators.min(0)]], // seconds
      samplingFrequency: [5000, [Validators.required, Validators.min(1)]], // Hz
      filterLow: [0, [Validators.min(0)]],
      filterHigh: [2000, [Validators.min(0)]],
      filterOrder: [101, [Validators.min(3)]],
      freqRespMax: [null],
      spectrumMax: [null]
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      // Carrega todos os transmissores disponíveis
      this.availableTransmitters = await this.firestore.getAllTransmitters();
      
      // Inicializa lista de seleção
      this.selectedTransmitters = this.availableTransmitters.map(tx => ({
        id: tx.id,
        selected: false,
        config: tx
      }));

      // Se houver um ID de canal, carrega a configuração
      if (this.channelId) {
        this.generateQRCode();
        const channelData = await this.firestore.getChannelById(this.channelId);
        if (channelData) {
          this.populateFormFromConfig(channelData.config);
          // Marca os transmissores que fazem parte do canal
          this.selectedTransmitters = this.selectedTransmitters.map(tx => ({
            ...tx,
            selected: channelData.config.transmitterIds.includes(tx.id)
          }));
          await this.loadSignalsAndValidate();
        }
      }
    } catch (err) {
      console.error('Erro ao carregar transmissores:', err);
    }
  }

  private populateFormFromConfig(config: ChannelConfig): void {
    this.form.patchValue({
      duration: config.duration,
      samplingFrequency: config.samplingFrequency,
      filterLow: config.filter?.lowCutoff || 0,
      filterHigh: config.filter?.highCutoff || 2000,
      filterOrder: config.filter?.order || 101,
      freqRespMax: config.filter?.freqRespMax,
      spectrumMax: null
    });
    this.filterEnabled = config.filterEnabled;
  }

  private async generateQRCode(): Promise<void> {
    try {
      this.qrCodeDataUrl = await QRCode.toDataURL(this.channelUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#111827',
          light: '#ffffff'
        },
      });
    } catch (err) {
      console.error('Erro ao gerar QR Code:', err);
    }
  }

  toggleQrCode(): void {
    this.showQrCode = !this.showQrCode;
  }

  toggleTransmitter(transmitterId: string): void {
    const tx = this.selectedTransmitters.find(t => t.id === transmitterId);
    if (tx) {
      tx.selected = !tx.selected;
      this.loadSignalsAndValidate();
    }
  }

  async loadSignalsAndValidate(): Promise<void> {
    const selectedIds = this.selectedTransmitters
      .filter(tx => tx.selected)
      .map(tx => tx.id);

    if (selectedIds.length === 0) {
      this.validationMessage = 'Selecione pelo menos um transmissor.';
      this.canMultiplex = false;
      this.validationInfos = [];
      this.multiplexedSignal = undefined;
      this.filteredSignal = undefined;
      this.spectrum = undefined;
      return;
    }

    // Carrega os sinais dos transmissores selecionados usando Promise.all com firstValueFrom
    const signalPromises = selectedIds.map(id => 
      new Promise<SignalOutput>((resolve) => {
        this.firestore.subscribeToSignal(id).subscribe({
          next: (signalDoc) => {
            if (signalDoc) {
              resolve({
                transmitterId: id,
                data: {
                  x: signalDoc['data']?.x || [],
                  y: signalDoc['data']?.y || []
                }
              });
            } else {
              resolve({
                transmitterId: id,
                data: { x: [], y: [] }
              });
            }
          },
          error: () => {
            resolve({
              transmitterId: id,
              data: { x: [], y: [] }
            });
          }
        });
      })
    );

    const signals = await Promise.all(signalPromises);

    // Atualiza a lista de transmissores com os sinais
    this.selectedTransmitters.forEach(tx => {
      tx.signal = signals.find(s => s.transmitterId === tx.id);
    });

    // Valida os sinais
    this.validationInfos = this.channelService.validateSignals(signals);

    // Verifica se há sinais sem dados
    const missingSignals = this.validationInfos.filter(info => !info.hasSignal);
    if (missingSignals.length > 0) {
      this.validationMessage = `Os seguintes transmissores não possuem sinais: ${missingSignals.map(info => info.transmitterId).join(', ')}`;
      this.canMultiplex = false;
      this.multiplexedSignal = undefined;
      this.filteredSignal = undefined;
      this.spectrum = undefined;
      return;
    }

    // Verifica consistência de frequência de amostragem
    const fsCheck = this.channelService.checkSamplingFrequencyConsistency(this.validationInfos);
    if (!fsCheck.isConsistent) {
      this.validationMessage = `Taxa de amostragem inconsistente. Configure os seguintes transmissores para ${fsCheck.maxFs} Hz: ${fsCheck.inconsistentTransmitters.join(', ')}`;
      this.canMultiplex = false;
      this.multiplexedSignal = undefined;
      this.filteredSignal = undefined;
      this.spectrum = undefined;
      return;
    }

    // Atualiza a taxa de amostragem do canal
    this.form.patchValue({ samplingFrequency: fsCheck.maxFs }, { emitEvent: false });

    // Calcula a duração máxima
    const maxDuration = Math.max(...this.validationInfos.map(info => info.duration));
    this.form.patchValue({ duration: maxDuration }, { emitEvent: false });

    this.validationMessage = `✓ ${selectedIds.length} transmissores válidos. Taxa: ${fsCheck.maxFs} Hz, Duração: ${maxDuration.toFixed(3)} s`;
    this.canMultiplex = true;

    // Gera o sinal multiplexado automaticamente
    this.generateMultiplexedSignal();
  }

  generateMultiplexedSignal(): void {
    if (!this.canMultiplex) return;

    const duration = Number(this.form.get('duration')?.value) || 1;
    const fs = Number(this.form.get('samplingFrequency')?.value) || 5000;

    const signals = this.selectedTransmitters
      .filter(tx => tx.selected && tx.signal)
      .map(tx => tx.signal!);

    this.multiplexedSignal = this.channelService.multiplexSignals(signals, duration, fs);

    // Aplica filtro se habilitado
    if (this.filterEnabled) {
      this.applyFilter();
    } else {
      this.filteredSignal = undefined;
    }

    // Calcula espectro
    this.updateSpectrum();
  }

  toggleFilter(): void {
    this.filterEnabled = !this.filterEnabled;
    if (this.filterEnabled) {
      this.updateFilterResponse();
      this.applyFilter();
    } else {
      this.filteredSignal = undefined;
      this.freqResponse = undefined;
    }
  }

  updateFilterResponse(): void {
    if (!this.filterEnabled) return;

    const lowCutoff = Number(this.form.get('filterLow')?.value) || 0;
    const highCutoff = Number(this.form.get('filterHigh')?.value) || 2000;
    const order = Number(this.form.get('filterOrder')?.value) || 101;
    const fs = Number(this.form.get('samplingFrequency')?.value) || 5000;
    const maxFreq = Number(this.form.get('freqRespMax')?.value) || fs / 2;

    this.freqResponse = this.channelService.getFilterFrequencyResponse(
      lowCutoff,
      highCutoff,
      order,
      fs,
      maxFreq
    );
  }

  applyFilter(): void {
    if (!this.multiplexedSignal || !this.filterEnabled) return;

    const lowCutoff = Number(this.form.get('filterLow')?.value) || 0;
    const highCutoff = Number(this.form.get('filterHigh')?.value) || 2000;
    const order = Number(this.form.get('filterOrder')?.value) || 101;
    const fs = Number(this.form.get('samplingFrequency')?.value) || 5000;

    this.filteredSignal = this.channelService.applyFilter(
      this.multiplexedSignal,
      lowCutoff,
      highCutoff,
      order,
      fs
    );
  }

  updateSpectrum(): void {
    const signal = this.filteredSignal || this.multiplexedSignal;
    if (!signal) return;

    const fs = Number(this.form.get('samplingFrequency')?.value) || 5000;
    const maxFreq = Number(this.form.get('spectrumMax')?.value) || fs / 2;

    const fullSpectrum = this.fourier.computeSpectrum(signal, fs);
    
    // Filtra apenas as frequências até maxFreq
    const maxIdx = fullSpectrum.x.findIndex(f => f > maxFreq);
    if (maxIdx > 0) {
      this.spectrum = {
        x: fullSpectrum.x.slice(0, maxIdx),
        y: fullSpectrum.y.slice(0, maxIdx)
      };
    } else {
      this.spectrum = fullSpectrum;
    }
  }

  async transmit(): Promise<void> {
    if (!this.canMultiplex || !this.multiplexedSignal) {
      alert('Não é possível transmitir. Verifique os sinais selecionados.');
      return;
    }

    try {
      const selectedIds = this.selectedTransmitters
        .filter(tx => tx.selected)
        .map(tx => tx.id);

      const duration = Number(this.form.get('duration')?.value) || 1;
      const fs = Number(this.form.get('samplingFrequency')?.value) || 5000;
      const lowCutoff = Number(this.form.get('filterLow')?.value) || 0;
      const highCutoff = Number(this.form.get('filterHigh')?.value) || 2000;
      const order = Number(this.form.get('filterOrder')?.value) || 101;
      const freqRespMax = Number(this.form.get('freqRespMax')?.value) || null;

      const config: ChannelConfig = {
        transmitterIds: selectedIds,
        duration,
        samplingFrequency: fs,
        filterEnabled: this.filterEnabled,
        filter: this.filterEnabled ? {
          lowCutoff,
          highCutoff,
          order,
          freqRespMax: freqRespMax ?? fs/2
        } : undefined
      };

      const signalToTransmit = this.filteredSignal || this.multiplexedSignal;

      const output: ChannelOutput = {
        channelId: this.channelId,
        data: {
          x: Array.from(signalToTransmit.x),
          y: Array.from(signalToTransmit.y)
        }
      };

      // Salva no Firestore
      const savedId = await this.firestore.saveChannel(config, output, this.channelId || undefined);

      // Se é um novo canal, redireciona para a página com ID
      if (!this.channelId) {
        this.router.navigate(['/channel', savedId]);
      } else {
        alert('Canal transmitido com sucesso!');
        this.generateQRCode();
      }
    } catch (err) {
      console.error('Erro ao transmitir canal:', err);
      alert('Erro ao transmitir canal. Veja o console para detalhes.');
    }
  }

  getTransmitterName(id: string): string {
    const tx = this.availableTransmitters.find(t => t.id === id);
    return tx ? `Transmissor <${id}>` : id;
  }
}

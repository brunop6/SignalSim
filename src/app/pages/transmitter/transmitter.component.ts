import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { SignalChartComponent } from '../../components/signal-chart/signal-chart.component';
import { TransmitterService } from '../../shared/services/transmitter.service';
import { Signal } from '../../shared/interfaces/signal.interface';
import { SignalOutput } from '../../shared/interfaces/signal-output';
import { SignalTypes } from '../../shared/enums/signal-types.enum';

@Component({
  selector: 'app-transmitter',
  imports: [CommonModule, ReactiveFormsModule, SignalChartComponent],
  templateUrl: './transmitter.component.html',
  styleUrl: './transmitter.component.scss'
})
export class TransmitterComponent {
  signalTypes = Object.values(SignalTypes);
  form!: FormGroup;

  output?: SignalOutput;

  constructor(
    private fb: FormBuilder,
    private tx: TransmitterService
  ) {
    this.form = this.fb.group({
      type: [SignalTypes.SINE, Validators.required],
      amplitude: [1, [Validators.required, Validators.min(0)]],
      frequency: [10, [Validators.required, Validators.min(1)]], // Hz
      phase: [0], // radianos
      duration: [200, [Validators.required, Validators.min(0)]], // ms
      samplingFrequency: [1000, [Validators.required, Validators.min(1)]], // Hz
    });
  }

  // Helpers para UI
  get f(): number {
    return Number(this.form?.get('frequency')?.value) || 0;
  }

  get fs(): number {
    return Number(this.form?.get('samplingFrequency')?.value) || 0;
  }

  get nyquistViolated(): boolean {
    return this.fs < 2 * this.f;
  }

  get expectedSamples(): number {
    const duration = Number(this.form?.get('duration')?.value) || 0;
    const fs = this.fs / 1000; // converter ms para s
    return Math.max(0, Math.round(duration * fs));
  }

  generate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { type, amplitude, frequency, phase, duration, samplingFrequency } = this.form.getRawValue();

    // Segurança de tipos para o TS
    const amp = Number(amplitude);
    const f = Number(frequency);
    const ph = Number(phase);
    const dur = Number(duration) / 1000;
    const fs = Number(samplingFrequency);

    const signal: Signal = {
      type: type as SignalTypes,
      amplitude: amp,
      frequency: f,
      phase: ph,
    };

    this.output = this.tx.generateSignal(signal, dur, fs);
  }
}

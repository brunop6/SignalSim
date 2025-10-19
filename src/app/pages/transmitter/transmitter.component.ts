import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormArray } from '@angular/forms';
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
      duration: [200, [Validators.required, Validators.min(0)]], // ms
      samplingFrequency: [1000, [Validators.required, Validators.min(1)]], // Hz
      signals: this.fb.array([this.createSignalGroup()])
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

    this.output = this.tx.multiplexChannel(signals, dur, fs);
  }
}

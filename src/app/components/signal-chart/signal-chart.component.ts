import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SignalData } from '../../shared/interfaces/signal-data';

import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';


Chart.register(...registerables);

@Component({
  selector: 'app-signal-chart',
  imports: [CommonModule],
  templateUrl: './signal-chart.component.html',
  styleUrl: './signal-chart.component.scss'
})
export class SignalChartComponent implements AfterViewInit, OnChanges {
  @Input() data?: SignalData;
  @Input() title = 'Signal';
  @Input() type: 'signal' | 'frequency-response' | 'spectrum' = 'signal';
  @Input() modulator?: SignalData;
  // Optional max for x-axis (used for spectrum/frequency-response)
  @Input() xMax?: number;

  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  constructor(private destroyRef: DestroyRef) {
    // Ensure chart is destroyed when the component is destroyed
    this.destroyRef.onDestroy(() => this.destroyChart());
  }

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['data'] && !changes['data'].firstChange) ||
        (changes['xMax'] && !changes['xMax'].firstChange) ||
        (changes['type'] && !changes['type'].firstChange) ||
        (changes['modulator'] && !changes['modulator'].firstChange)) {
      this.render();
    }
  }

  private render(): void {
    if (!this.canvasRef) return;

    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Destroy previous instance to avoid leaks
    this.destroyChart();

    const output = this.data;
    if (!output || output.x.length === 0) {
      return; // nothing to draw yet
    }

    // Convert Float64Array to Chart.js format {x, y}[]
    const chartData = this.convertToChartData(output.x, output.y);

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        datasets: [
          {
            label: this.title,
            data: chartData,
            borderColor: '#00C9A7',
            backgroundColor: 'rgba(0,201,167,0.15)',
            fill: true,
            pointRadius: 0,
            borderWidth: 1.5,
            tension: 0, // straight lines
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            title: { 
              display: true, 
              text: (this.type === 'frequency-response' || this.type === 'spectrum') ? 'Frequência (Hz)' : 'Tempo (s)' 
            },
            ticks: { maxTicksLimit: 10 },
            min: (this.type === 'frequency-response' || this.type === 'spectrum') ? 0 : undefined,
            max: (this.type === 'frequency-response' || this.type === 'spectrum') ? (this.xMax ?? undefined) : undefined,
          },
          y: {
            title: { display: true, text: 'Amplitude' },
            ticks: { maxTicksLimit: 6 },
            suggestedMin: (this.type === 'frequency-response' || this.type === 'spectrum') ? 0 : -5,
            suggestedMax: (this.type === 'frequency-response' || this.type === 'spectrum') ? undefined : 5
          }
        },
        plugins: {
          legend: { display: true },
          tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false
          },
          title: { display: false }
        },
        parsing: false
      }
    };

    if (this.modulator && this.modulator.x.length > 0){
      const modulatorData = this.convertToChartData(this.modulator.x, this.modulator.y);
      config.data.datasets?.push({
        label: 'Sinal Modulador',
        data: modulatorData,
        borderColor: '#0070F3',
        backgroundColor: 'rgba(0,112,243,0.15)',
        fill: true,
        pointRadius: 0,
        borderWidth: 1.5,
        tension: 0, // straight lines
      });
    }

    this.chart = new Chart(ctx, config);
  }

  /**
   * Converts Float64Array x and y to Chart.js format {x, y}[]
   */
  private convertToChartData(x: Float64Array, y: Float64Array): Array<{x: number, y: number}> {
    const data: Array<{x: number, y: number}> = [];
    const len = Math.min(x.length, y.length);
    for (let i = 0; i < len; i++) {
      data.push({ x: x[i], y: y[i] });
    }
    return data;
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }
}

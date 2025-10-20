import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalOutput } from '../../shared/interfaces/signal-output';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { LiteralArray } from '@angular/compiler';

Chart.register(...registerables);

@Component({
  selector: 'app-signal-chart',
  imports: [CommonModule],
  templateUrl: './signal-chart.component.html',
  styleUrl: './signal-chart.component.scss'
})
export class SignalChartComponent implements AfterViewInit, OnChanges {
  @Input() data?: SignalOutput;
  @Input() title = 'Signal';
  @Input() type: 'signal' | 'frequency-response' | 'spectrum' = 'signal';

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
    if (changes['data'] && !changes['data'].firstChange) {
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
    if (!output || !output.data || output.data.length === 0) {
      return; // nothing to draw yet
    }

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        datasets: [
          {
            label: this.title,
            data: output.data,
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
              text: this.type=='frequency-response' ? 'Frequency (Hz)' : 'Time (s)' },
            ticks: { maxTicksLimit: 10 },
          },
          y: {
            title: { display: true, text: 'Amplitude' },
            ticks: { maxTicksLimit: 6 },
            suggestedMin: this.type=='frequency-response' ? -1 : -5,
            suggestedMax: this.type=='frequency-response' ? 1 : 5
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

    this.chart = new Chart(ctx, config);
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }
}

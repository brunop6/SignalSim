import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'frequency',
  standalone: true
})
export class FrequencyPipe implements PipeTransform {
  transform(value?: number | null): string {
    if (value == null || isNaN(value)) return '';

    const abs = Math.abs(value);
    let unit = 'Hz';
    let factor = 1;

    if (abs >= 1e9) {
      unit = 'GHz';
      factor = 1e9;
    } else if (abs >= 1e6) {
      unit = 'MHz';
      factor = 1e6;
    } else if (abs >= 1e3) {
      unit = 'kHz';
      factor = 1e3;
    }

    const num = value / factor;
    let formatted: string;
    if (Math.abs(num) >= 100) {
      formatted = num.toFixed(0);
    } else if (Math.abs(num) >= 10) {
      formatted = num.toFixed(1);
    } else {
      formatted = num.toFixed(2);
    }
    formatted = formatted.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    return `${formatted} ${unit}`;
  }
}

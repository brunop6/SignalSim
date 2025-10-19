import { Routes } from '@angular/router';
import { TransmitterComponent } from './pages/transmitter/transmitter.component';

export const routes: Routes = [
  {
    path: 'transmitter',
    loadComponent: () => import('./pages/transmitter/transmitter.component').then(m => m.TransmitterComponent)
  }
];

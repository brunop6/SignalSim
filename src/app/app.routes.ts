import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'transmitter/:id',
    loadComponent: () => import('./pages/transmitter/transmitter.component').then(m => m.TransmitterComponent)
  },
  {
    path: 'receiver',
    loadComponent: () => import('./pages/receiver/receiver.component').then(m => m.ReceiverComponent)
  }
];

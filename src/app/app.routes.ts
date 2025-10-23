import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/transmitter',
    pathMatch: 'full'
  },
  {
    path: 'transmitter',
    loadComponent: () => import('./pages/transmitters/transmitters.component').then(m => m.TransmittersComponent)
  },
  {
    path: 'transmitter/:id',
    loadComponent: () => import('./pages/transmitters/transmitter/transmitter.component').then(m => m.TransmitterComponent)
  },
  {
    path: 'receiver',
    loadComponent: () => import('./pages/receiver/receiver.component').then(m => m.ReceiverComponent)
  }
];

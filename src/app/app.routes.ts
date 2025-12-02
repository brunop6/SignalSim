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
    path: 'channel/new',
    loadComponent: () => import('./pages/channels/channel/channel.component').then(m => m.ChannelComponent)
  },
  {
    path: 'channel/:id',
    loadComponent: () => import('./pages/channels/channel/channel.component').then(m => m.ChannelComponent)
  },
  {
    path: 'receiver',
    loadComponent: () => import('./pages/receiver/receiver.component').then(m => m.ReceiverComponent)
  }
];

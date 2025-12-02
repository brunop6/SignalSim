import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ChannelConfig } from '../../shared/interfaces/channel';
import { FrequencyPipe } from '../../shared/pipes/frequency.pipe';

@Component({
  selector: 'app-channel-card',
  imports: [FrequencyPipe],
  templateUrl: './channel-card.component.html',
  styleUrl: './channel-card.component.scss'
})
export class ChannelCardComponent {
  @Input() channel!: { id: string; config: ChannelConfig };

  constructor(private router: Router) {}

  open(): void {
    this.router.navigate(['/channel', this.channel.id]);
  }
}

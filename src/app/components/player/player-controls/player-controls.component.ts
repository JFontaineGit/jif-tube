import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoggerService } from '../../../services/core/logger.service';

@Component({
  selector: 'app-player-controls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './player-controls.component.html',
  styleUrls: ['./player-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerControlsComponent {
  private logger = inject(LoggerService);

  @Input() isPlaying = false;
  @Input() volume = 1;

  @Output() playPause = new EventEmitter<void>();
  @Output() stop = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() volumeChange = new EventEmitter<number>();

  isVolumeVisible = false;

  onVolumeIconClick(): void {
    this.isVolumeVisible = !this.isVolumeVisible;
    this.logger.debug(`Visibilidad del volumen: ${this.isVolumeVisible}`);
  }

  onVolumeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number.parseFloat(input.value);
    this.logger.debug(`Cambiando volumen a: ${value}`);
    this.volumeChange.emit(value);
  }

  onPlayPause(): void {
    this.logger.debug(`Acción: ${this.isPlaying ? 'Pausar' : 'Reproducir'}`);
    this.playPause.emit();
  }

  onStop(): void {
    this.logger.debug('Acción: Detener');
    this.stop.emit();
  }

  onPrevious(): void {
    this.logger.debug('Acción: Pista anterior');
    this.previous.emit();
  }

  onNext(): void {
    this.logger.debug('Acción: Siguiente pista');
    this.next.emit();
  }

  get volumeLabel(): string {
    return `Volumen: ${Math.round(this.volume * 100)}%`;
  }

  public getVolumeLabel(): string {
    return `Volumen: ${Math.round(this.volume * 100)}%`;
  }
}
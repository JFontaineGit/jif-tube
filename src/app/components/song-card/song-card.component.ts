import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song } from '../../models/song.model';
import { LoggerService } from '../../services/core/logger.service';

@Component({
  selector: 'app-song-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-card.component.html',
  styleUrls: ['./song-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongCardComponent {
  private logger = inject(LoggerService);

  @Input() song!: Song;
  @Output() selected = new EventEmitter<Song>();

  get cardTypeClass(): string {
    return this.song?.type || 'album-track';
  }

  onSelect(): void {
    this.logger.info(`Canción seleccionada en SongCard: ${this.song.title} (${this.song.videoId})`);
    this.selected.emit(this.song);
  }
}
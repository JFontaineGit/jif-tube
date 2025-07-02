import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song } from '../../../models/song.model';
import { LoggerService } from '../../../services/core/logger.service';

@Component({
  selector: 'app-player-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-info.component.html',
  styleUrls: ['./player-info.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerInfoComponent {
  private logger = inject(LoggerService);

  @Input() currentTrack: Song | null = null;

  get trackTitle(): string {
    const title = this.currentTrack?.title || 'Sin título';
    this.logger.debug(`Mostrando título: ${title}`);
    return title;
  }

  get trackArtist(): string {
    const artist = this.currentTrack?.artist || 'Artista desconocido';
    this.logger.debug(`Mostrando artista: ${artist}`);
    return artist;
  }

  get trackThumbnail(): string {
    const thumbnail = this.currentTrack?.thumbnailUrl || '/assets/images/default-thumbnail.jpg';
    this.logger.debug(`Mostrando thumbnail: ${thumbnail}`);
    return thumbnail;
  }

  get trackAlbum(): string {
    const album = this.currentTrack?.album || 'Desconocido';
    this.logger.debug(`Mostrando álbum: ${album}`);
    return album;
  }

  get trackDuration(): string {
    if (!this.currentTrack?.duration) {
      return '0:00';
    }
    return this.formatTime(this.currentTrack.duration);
  }

  private formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) {
      return '0:00';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song } from '../../models/song.model';
import { LibraryService } from '../../services/library.service';
import { LoggerService } from '../../services/core/logger.service';
import { LibraryService } from '../../services/library.service';

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
  private libraryService = inject(LibraryService);

  @Input() song!: Song;
  @Input() showSaveButton: boolean = false;
  @Output() selected = new EventEmitter<Song>();
  @Output() save = new EventEmitter<Song>();

  savedSongs: Song[] = [];


  get cardTypeClass(): string {
    return this.song?.type || 'album-track';
  }

  onSelect(): void {
    this.logger.info(`Canción seleccionada en SongCard: ${this.song.title} (${this.song.videoId})`);
    this.selected.emit(this.song);
  }

  onSave(event: Event): void {
    event.stopPropagation(); 
    this.save.emit(this.song);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = '/assets/images/default-thumbnail.jpg';
    this.logger.warn(`Error cargando imagen para: ${this.song.title}`);
  }

  isSongSaved(): boolean {
    return this.savedSongs.some(savedSong => savedSong.id === this.song.id);
  }
}
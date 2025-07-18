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
  @Input() showSaveButton: boolean = false;
  @Output() selected = new EventEmitter<Song>();
  @Output() save = new EventEmitter<Song>()

  savedSongs: Song[] = [];

  constructor (private libraryService: LibraryService) {}

  get cardTypeClass(): string {
    return this.song?.type || 'album-track';
  }

  onSelect(): void {
    this.logger.info(`Canción seleccionada en SongCard: ${this.song.title} (${this.song.videoId})`);
    this.selected.emit(this.song);
  }

  onSave(event: Event): void{
    event.stopPropagation(); 
    this.save.emit(this.song);
  }

  isSongSaved(): boolean{
    return this.savedSongs.some(savedSong => savedSong.id === this.song.id);
  }
}
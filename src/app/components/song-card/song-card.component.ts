import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song, SongType } from '../../models/song.model';

@Component({
  selector: 'app-song-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-card.component.html',
  styleUrls: ['./song-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongCardComponent {
  @Input({ required: true }) song!: Song;
  @Input() showActions = true;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Output() selected = new EventEmitter<Song>();
  @Output() optionsClick = new EventEmitter<{ song: Song; event: Event }>();

  isLoading = signal(false);
  imageLoaded = signal(false);

  cardClasses = computed(() => {
    const classes = ['song-card'];

    if (this.song?.type) {
      classes.push(this.song.type);
    }

    if (this.isLoading()) {
      classes.push('loading');
    }

    classes.push(`size-${this.size}`);

    return classes.join(' ');
  });

  thumbnailClasses = computed(() => {
    const classes = ['thumbnail'];

    if (this.song?.type === SongType.OfficialVideo) {
      classes.push('video-thumbnail');
    } else {
      classes.push('album-thumbnail');
    }

    return classes.join(' ');
  });

  onSelect(): void {
    if (!this.song || this.isLoading()) return;

    console.log(`Canción seleccionada: ${this.song.title} (${this.song.videoId})`);
    this.selected.emit(this.song);
  }

  onOptionsClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.song) return;

    this.optionsClick.emit({ song: this.song, event });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = '/assets/images/default-thumbnail.jpg';

    console.warn(`Error loading image for: ${this.song?.title || 'Unknown song'}`);
    this.imageLoaded.set(false);
  }

  onImageLoad(): void {
    this.imageLoaded.set(true);
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds < 0) return '0:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getAriaLabel(): string {
    const { title, artist } = this.song;
    const artistText = artist && artist !== 'Artista desconocido' ? ` de ${artist}` : '';
    return `Reproducir ${title}${artistText}`;
  }

  getCardClasses(): string {
    return this.cardClasses();
  }

  getThumbnailClasses(): string {
    return this.thumbnailClasses();
  }

  // Fix para el template HTML (usa SongType enum)
  get SongType() {
    return SongType;
  }
}
import { Component, OnInit, OnDestroy, inject, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PlayerService, QueueService, LibraryService, SongService, LoggerService } from '@services';
import { Song } from '@interfaces';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
})
export class PlayerComponent implements OnInit, OnDestroy {
  private readonly playerService = inject(PlayerService);
  private readonly queueService = inject(QueueService);
  private readonly libraryService = inject(LibraryService);
  private readonly songService = inject(SongService);
  private readonly logger = inject(LoggerService);
  private readonly destroy$ = new Subject<void>();

  // Input para saber si sidebar está colapsada
  @Input() sidebarCollapsed = false;

  private readonly _isMinimized = signal(false);
  readonly isMinimized = this._isMinimized.asReadonly();

  // Signals del player
  readonly currentSong = this.playerService.currentSong;
  readonly isPlaying = this.playerService.playing;
  readonly currentTime = this.playerService.currentTime;
  readonly duration = this.playerService.duration;
  readonly volume = this.playerService.volume;
  readonly isMuted = this.playerService.isMuted;
  readonly error = this.playerService.error;
  readonly isBuffering = this.playerService.isBuffering;
  readonly progress = this.playerService.progress;
  readonly timeElapsed = this.playerService.formattedCurrentTime;
  readonly timeTotal = this.playerService.formattedDuration;

  // Computed signals
  readonly isLiked = computed(() => {
    const song = this.currentSong();
    return song ? this.libraryService.isFavorite(song.id) : false;
  });

  readonly hasError = computed(() => !!this.error());
  readonly errorMessage = computed(() => this.error() || '');
  readonly hasNext = this.queueService.hasNext;
  readonly hasPrevious = this.queueService.hasPrevious;

  ngOnInit(): void {
    this.logger.info('PlayerComponent initialized');
    this.libraryService.getLibrary().subscribe({
      error: (err) => this.logger.error('Error cargando biblioteca', err)
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Playback controls
  onPlayPause(): void {
    this.playerService.togglePlayPause();
  }

  onPrevious(): void {
    const prevSong = this.queueService.previous();
    if (prevSong) {
      this.logger.info('Reproduciendo canción anterior', { title: prevSong.title });
      this.playerService.loadAndPlay(prevSong.id, { autoplay: true }).subscribe();
    }
  }

  onNext(): void {
    const nextSong = this.queueService.next();
    if (nextSong) {
      this.logger.info('Reproduciendo siguiente canción', { title: nextSong.title });
      this.playerService.loadAndPlay(nextSong.id, { autoplay: true }).subscribe();
    }
  }

  onSeek(event: Event): void {
    const target = event.target as HTMLInputElement;
    const percentage = parseFloat(target.value);
    const duration = this.duration();
    const seconds = (percentage / 100) * duration;
    this.playerService.seek(seconds);
  }

  onVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const volumeValue = parseInt(target.value, 10);
    this.playerService.setVolume(volumeValue / 100);
  }

  onMuteToggle(): void {
    this.playerService.toggleMute();
  }

  onLikeToggle(): void {
    const song = this.currentSong();
    if (!song) return;

    this.libraryService.toggleFavorite(song.id).subscribe({
      next: () => {
        const isNowLiked = this.libraryService.isFavorite(song.id);
        this.logger.info(
          isNowLiked ? 'Canción agregada a favoritos' : 'Canción eliminada de favoritos',
          { title: song.title }
        );
      },
      error: (err) => this.logger.error('Error al cambiar favorito', err)
    });
  }

  toggleMinimize(): void {
    this._isMinimized.update(current => !current);
  }

  onOptionsClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.logger.info('Opciones clickeadas (no implementado)');
  }

  // Helpers
  getThumbnailUrl(): string {
    const song = this.currentSong();
    if (!song) return '/assets/default-art.jpg';
    return this.songService.getBestThumbnail(song.thumbnails) || '/assets/default-art.jpg';
  }

  getSongTitle(): string {
    return this.currentSong()?.title || 'Sin canción';
  }

  getSongArtist(): string {
    return this.currentSong()?.channel_title || 'Artista desconocido';
  }
}
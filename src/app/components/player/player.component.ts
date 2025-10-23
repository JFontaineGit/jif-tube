import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  Input,
  HostListener,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, fromEvent } from 'rxjs';
import { PlayerService, QueueService, LibraryService, SongService, LoggerService } from '@services';
import { Song } from '@interfaces';
import { PLATFORM_ID } from '@angular/core';

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
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroy$ = new Subject<void>();
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Input para saber si sidebar está colapsada
  @Input() sidebarCollapsed = false;

  private readonly _isMinimized = signal(false);
  private readonly _isMobileView = signal(false);
  private readonly _isMobileExpanded = signal(false);
  private readonly _isMobileMenuOpen = signal(false);
  readonly isMinimized = this._isMinimized.asReadonly();
  readonly isMobileView = this._isMobileView.asReadonly();
  readonly isMobileExpanded = this._isMobileExpanded.asReadonly();
  readonly isMobileMenuOpen = this._isMobileMenuOpen.asReadonly();
  readonly showMobileOverlay = computed(() => this.isMobileView() && this.isMobileExpanded());

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

    if (this.isBrowser) {
      this.updateViewportState();
      fromEvent(window, 'resize')
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.updateViewportState());
    }
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

  openMobileExpanded(): void {
    if (!this.isMobileView()) return;
    this._isMobileExpanded.set(true);
    this._isMobileMenuOpen.set(false);
  }

  closeMobileExpanded(): void {
    if (!this.isMobileView()) return;
    this._isMobileExpanded.set(false);
    this._isMobileMenuOpen.set(false);
  }

  toggleMobileMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (!this.isMobileExpanded()) return;
    this._isMobileMenuOpen.update(open => !open);
  }

  closeMobileMenu(): void {
    if (this._isMobileMenuOpen()) {
      this._isMobileMenuOpen.set(false);
    }
  }

  onMobileContainerClick(event: Event): void {
    this.closeMobileMenu();
    event.stopPropagation();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isMobileExpanded()) {
      this.closeMobileExpanded();
    }
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

  private updateViewportState(): void {
    if (!this.isBrowser) return;
    const isMobile = window.innerWidth <= 768;
    this._isMobileView.set(isMobile);

    if (!isMobile) {
      this._isMobileExpanded.set(false);
      this._isMobileMenuOpen.set(false);
    }
  }
}
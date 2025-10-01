import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PlayerService, PlayerState } from '../../services/player.service';
import { LibraryService } from '../../services/library.service';
import { LoggerService } from '../../services/core/logger.service';
import { Song } from '../../models/song.model';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
})
export class PlayerComponent implements OnInit, OnDestroy {
  private playerService = inject(PlayerService);
  private libraryService = inject(LibraryService);
  private logger = inject(LoggerService);
  private destroy$ = new Subject<void>();

  // Estado del player
  private playerState = signal<PlayerState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    videoId: null,
    volume: 100,
    isMuted: false,
    error: null,
    currentSong: null,
  });

  private minimized = signal(false);
  private liked = signal(false);

  currentSong = computed(() => this.playerState().currentSong);
  isPlaying = computed(() => this.playerState().playing);
  progress = computed(() => {
    const state = this.playerState();
    return state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  });
  timeElapsed = computed(() => this.formatTime(this.playerState().currentTime));
  timeTotal = computed(() => this.formatTime(this.playerState().duration));
  volume = computed(() => this.playerState().volume);
  isMuted = computed(() => this.playerState().isMuted);
  hasError = computed(() => !!this.playerState().error);
  errorMessage = computed(() => this.playerState().error);

  // Computeds de UI
  isLiked = computed(() => this.liked());
  isMinimized = computed(() => this.minimized());

  ngOnInit(): void {
    this.subscribeToPlayerState();
    this.checkIfLiked();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPlayPause(): void {
    if (this.isPlaying()) {
      this.playerService.pause();
    } else {
      this.playerService.play();
    }
  }

  onPrevious(): void {
    this.logger.info('Anterior canción (no implementado aún)');
  }

  onNext(): void {
    this.logger.info('Siguiente canción (no implementado aún)');
  }

  onSeek(event: Event): void {
    const target = event.target as HTMLInputElement;
    const percentage = parseFloat(target.value);
    const seconds = (percentage / 100) * this.playerState().duration;
    this.playerService.seek(seconds);
  }

  onVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const volumeValue = parseInt(target.value, 10);
    this.playerService.setVolume(volumeValue / 100);
  }

  onMuteToggle(): void {
    this.playerService.setMuted(!this.isMuted());
  }

  onLikeToggle(): void {
    const song = this.currentSong();
    if (!song) return;

    if (this.liked()) {
      // Eliminar de biblioteca
      this.libraryService.removeSong(song.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.liked.set(false);
          this.logger.info(`Canción eliminada de biblioteca: ${song.title}`);
        },
        error: (err) => this.logger.error('Error eliminando canción', err),
      });
    } else {
      this.libraryService.saveSong(song).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.liked.set(true);
          this.logger.info(`Canción guardada en biblioteca: ${song.title}`);
        },
        error: (err) => this.logger.error('Error guardando canción', err),
      });
    }
  }

  onOptionsClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    // TODO: Abrir menú contextual (compartir, añadir a playlist, etc.)
    this.logger.info('Opciones clickeadas');
  }

  toggleMinimize(): void {
    this.minimized.update(current => !current);
  }

  /* ----------------------------
   * Public Methods (para Layout/componentes padre)
   * ---------------------------- */
  loadSong(song: Song): void {
    if (!song?.videoId) {
      this.logger.error('Canción sin videoId', song);
      return;
    }
    this.playerService.loadVideo(song.videoId, 0, song);
  }

  /* ----------------------------
   * Private Methods
   * ---------------------------- */
  private subscribeToPlayerState(): void {
    this.playerService.state$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(state => {
      this.playerState.set(state);
      
      if (state.currentSong) {
        this.checkIfLiked();
      }
    });
  }

  private checkIfLiked(): void {
    const song = this.currentSong();
    if (!song) {
      this.liked.set(false);
      return;
    }

    this.libraryService.getSavedSongs().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (savedSongs) => {
        const isInLibrary = savedSongs.some(s => s.id === song.id);
        this.liked.set(isInLibrary);
      },
      error: (err) => this.logger.error('Error verificando biblioteca', err),
    });
  }

  private formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }
}
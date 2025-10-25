import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { PlayerService, QueueService, LoggerService } from '@services';
import { Song } from '@interfaces';
import { SongCardComponent } from '../../components/song-card/song-card.component';

/**
 * History Page Component - Muestra el historial de reproducción
 * 
 * Features:
 * - Lista de canciones reproducidas recientemente
 * - Reproducción directa
 * - Limpiar historial
 * - Sincronizado con QueueService
 */
@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule, SongCardComponent],
  templateUrl: './history-page.component.html',
  styleUrls: ['./history-page.component.scss'],
})
export class HistoryPageComponent implements OnInit, OnDestroy {
  private readonly playerService = inject(PlayerService);
  private readonly queueService = inject(QueueService);
  private readonly logger = inject(LoggerService);
  
  private readonly destroy$ = new Subject<void>();

  // =========================================================================
  // STATE SIGNALS
  // =========================================================================

  private readonly _error = signal<string | null>(null);

  readonly error = this._error.asReadonly();

  // Usar el historial del QueueService
  readonly history = this.queueService.history;

  // =========================================================================
  // COMPUTED SIGNALS
  // =========================================================================

  /**
   * Canciones recientes (historial invertido para mostrar las más nuevas primero)
   */
  readonly recentSongs = computed(() => {
    return [...this.history()].reverse();
  });

  /**
   * Indica si el historial está vacío
   */
  readonly isEmpty = computed(() => this.history().length === 0);

  /**
   * Cantidad de canciones en el historial
   */
  readonly historyCount = computed(() => this.history().length);

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.logger.info('HistoryPageComponent initialized');
    this.setupPlayerListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  /**
   * Escucha cambios en el reproductor para logging
   */
  private setupPlayerListener(): void {
    this.playerService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        if (state.currentSong && state.playing) {
          this.logger.debug(`Reproduciendo: ${state.currentSong.title}`);
        }
      });
  }

  // =========================================================================
  // PLAYBACK
  // =========================================================================

  /**
   * Reproduce una canción del historial
   */
  onSongSelected(song: Song, index: number, songs: Song[]): void {
    if (!song?.id) {
      this.logger.error('Canción sin ID válido:', song);
      this._error.set('No se puede reproducir esta canción');
      return;
    }

    this.logger.info(`▶️ Reproduciendo desde historial: ${song.title}`);
    this._error.set(null);

    const playlist = Array.isArray(songs) && songs.length > 0 ? songs : [song];
    const startIndex = Math.max(0, Math.min(index, playlist.length - 1));

    this.queueService.setQueue(playlist, startIndex);

    // Reproducir con PlayerService
    this.playerService.loadAndPlay(song.id, { autoplay: true }).subscribe({
      next: () => {
        this.logger.info('✅ Canción cargada correctamente');
      },
      error: (err) => {
        this.logger.error('❌ Error reproduciendo canción:', err);
        this._error.set('Error al reproducir la canción');
      },
    });
  }

  // =========================================================================
  // HISTORY MANAGEMENT
  // =========================================================================

  /**
   * Limpia todo el historial
   */
  clearHistory(): void {
    if (this.isEmpty()) {
      this.logger.warn('El historial ya está vacío');
      return;
    }

    // Confirmar antes de limpiar
    const confirmed = confirm(
      `¿Estás seguro de que deseas limpiar el historial? (${this.historyCount()} canciones)`
    );

    if (!confirmed) {
      this.logger.info('Limpieza de historial cancelada');
      return;
    }

    try {
      // El QueueService tiene el método clearQueue() que limpia todo incluido el historial
      // Pero solo queremos limpiar el historial, así que necesitamos un método específico
      // Por ahora, limpiamos la cola completa
      this.queueService.clearQueue();
      
      this.logger.info('✅ Historial limpiado');
    } catch (err) {
      this.logger.error('❌ Error limpiando historial:', err);
      this._error.set('Error al limpiar el historial');
    }
  }

  // =========================================================================
  // UI HELPERS
  // =========================================================================

  /**
   * Limpia el mensaje de error
   */
  clearError(): void {
    this._error.set(null);
  }

  /**
   * TrackBy para optimizar renderizado
   */
  trackBySongId(index: number, song: Song): string {
    return song.id || index.toString();
  }

  /**
   * Formatea la fecha de última reproducción (si está disponible)
   */
  getLastPlayedTime(song: Song): string {
    // Por ahora el historial no guarda timestamps
    // Esto se podría mejorar en el QueueService
    return 'Recientemente';
  }
}
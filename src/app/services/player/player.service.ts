import { Injectable, inject, OnDestroy, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  BehaviorSubject,
  Subject,
  interval,
  map,
  takeUntil,
  Observable,
  throwError,
  Subscription,
  switchMap,
} from 'rxjs';
import { catchError, tap, filter } from 'rxjs/operators';
import { LoggerService } from '../core/logger.service';
import { StorageService } from '../core/storage.service';
import { SearchService } from '../search/search.service';
import { SongService } from '../songs/song.service';
import { YoutubePlayerCoreService } from '../youtube-player-core.service';
import { YoutubeApiLoaderService } from '../youtube-api-loader.service';
import { Song, PlayerState, PlayOptions, getBestThumbnail } from '@interfaces';
import { ThemeService } from '../theme.service';

/**
 * Servicio principal del reproductor de música.
 * 
 * Features:
 * - Reproducción de videos de YouTube
 * - Control de playback (play/pause/seek/volume)
 * - Búsqueda y reproducción directa
 * - Estado reactivo con Signals
 * - Persistencia de volumen/mute
 * - SSR-safe
 */
@Injectable({ providedIn: 'root' })
export class PlayerService implements OnDestroy {
  private readonly logger = inject(LoggerService);
  private readonly storage = inject(StorageService);
  private readonly searchService = inject(SearchService);
  private readonly songService = inject(SongService);
  private readonly playerCore = inject(YoutubePlayerCoreService);
  private readonly apiLoader = inject(YoutubeApiLoaderService);
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // =========================================================================
  // STATE MANAGEMENT (BehaviorSubject + Signals)
  // =========================================================================

  private readonly stateSubject = new BehaviorSubject<PlayerState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    videoId: null,
    volume: 100,
    isMuted: false,
    error: null,
    currentSong: null,
    isBuffering: false,
    quality: 'default',
  });

  // Observable state (para templates que usan async pipe)
  readonly state$ = this.stateSubject.asObservable();

  // Signals para acceso síncrono
  private readonly _playing = signal<boolean>(false);
  private readonly _currentTime = signal<number>(0);
  private readonly _duration = signal<number>(0);
  private readonly _volume = signal<number>(100);
  private readonly _isMuted = signal<boolean>(false);
  private readonly _currentSong = signal<Song | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _isBuffering = signal<boolean>(false);

  readonly playing = this._playing.asReadonly();
  readonly currentTime = this._currentTime.asReadonly();
  readonly duration = this._duration.asReadonly();
  readonly volume = this._volume.asReadonly();
  readonly isMuted = this._isMuted.asReadonly();
  readonly currentSong = this._currentSong.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isBuffering = this._isBuffering.asReadonly();

  // Computed signals
  readonly progress = computed(() => {
    const dur = this._duration();
    return dur > 0 ? (this._currentTime() / dur) * 100 : 0;
  });

  readonly formattedCurrentTime = computed(() => 
    this.formatTime(this._currentTime())
  );

  readonly formattedDuration = computed(() => 
    this.formatTime(this._duration())
  );

  readonly canPlay = computed(() => 
    this._currentSong() !== null && !this._error()
  );

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  private pollingSub: Subscription | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor() {
    if (this.isBrowser) {
      this.initializeService();
    } else {
      this.logger.warn('PlayerService: SSR mode, player disabled');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling();
    this.playerCore.destroyPlayer();
    this.logger.info('PlayerService destroyed');
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  private initializeService(): void {
    // Esperar a que la API de YouTube esté lista
    this.apiLoader.apiReady$
      .pipe(
        filter(ready => ready),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.logger.info('YouTube API lista, PlayerService ready');
      });

    // Cargar volumen y mute guardados
    this.loadSavedSettings();
  }

  /**
   * Inicializa el player de YouTube
   * @param elementId ID del elemento DOM donde se montará el player
   * @param options Opciones adicionales del player
   */
  public init(elementId: string, options: any = {}): Observable<void> {
    if (!this.isBrowser) {
      return throwError(() => new Error('Player no disponible en SSR'));
    }

    this.logger.info('Inicializando player', { elementId });

    return this.playerCore.initializePlayer(elementId, options).pipe(
      tap(() => {
        this.startPolling();

        // Aplicar settings guardados
        const savedVolume = this._volume();
        const savedMuted = this._isMuted();

        this.playerCore.setVolume(savedVolume);
        if (savedMuted) {
          this.playerCore.mute();
        }

        this.updateState({
          volume: savedVolume,
          isMuted: savedMuted,
          error: null,
        });

        const playerInstance = this.playerCore.getPlayer();
        if (playerInstance) {
          this.themeService.init(playerInstance);
        }

        this.logger.info('Player inicializado correctamente');
      }),
      map(() => void 0),
      catchError(err => {
        this.logger.error('Error inicializando player', err);
        this.updateState({ error: err.message });
        return throwError(() => err);
      })
    );
  }

  // =========================================================================
  // PLAYBACK CONTROL
  // =========================================================================

  /**
   * Reproduce el video actual
   */
  play(): void {
    if (!this.playerCore.getPlayer()) {
      this.logger.warn('Player no inicializado');
      return;
    }

    this.playerCore.playVideo();
    this.updateState({ playing: true, error: null });
    this.logger.debug('Play');
  }

  /**
   * Pausa el video actual
   */
  pause(): void {
    if (!this.playerCore.getPlayer()) {
      this.logger.warn('Player no inicializado');
      return;
    }

    this.playerCore.pauseVideo();
    this.updateState({ playing: false });
    this.logger.debug('Pause');
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause(): void {
    if (this._playing()) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Detiene completamente el video
   */
  stop(): void {
    this.playerCore.stopVideo();
    this.updateState({
      playing: false,
      currentTime: 0,
      error: null,
    });
    this.logger.debug('Stop');
  }

  /**
   * Busca a una posición específica del video
   * @param seconds Segundos (0 hasta duration)
   */
  seek(seconds: number): void {
    if (!this.playerCore.getPlayer()) {
      this.logger.warn('Player no inicializado');
      return;
    }

    const duration = this._duration();
    const clampedSeconds = Math.max(0, Math.min(seconds, duration));

    this.playerCore.seekTo(clampedSeconds);
    this.updateState({ currentTime: clampedSeconds });
    this.logger.debug('Seek', { seconds: clampedSeconds });
  }

  /**
   * Avanza X segundos
   */
  forward(seconds: number = 10): void {
    const newTime = this._currentTime() + seconds;
    this.seek(newTime);
  }

  /**
   * Retrocede X segundos
   */
  backward(seconds: number = 10): void {
    const newTime = this._currentTime() - seconds;
    this.seek(newTime);
  }

  // =========================================================================
  // VOLUME CONTROL
  // =========================================================================

  /**
   * Establece el volumen
   * @param volume Volumen entre 0 y 1 (se convierte a 0-100 internamente)
   */
  setVolume(volume: number): void {
    const volume0to100 = Math.round(Math.max(0, Math.min(1, volume)) * 100);
    
    this.playerCore.setVolume(volume0to100);
    this.updateState({ volume: volume0to100 });
    
    // Guardar en storage
    this.storage.saveVolume(volume0to100).subscribe();
    
    this.logger.debug('Volume set', { volume: volume0to100 });
  }

  /**
   * Silencia/desilencia el audio
   */
  setMuted(muted: boolean): void {
    if (muted) {
      this.playerCore.mute();
    } else {
      this.playerCore.unMute();
    }
    
    this.updateState({ isMuted: muted });
    this.logger.debug('Mute toggled', { muted });
  }

  /**
   * Toggle mute/unmute
   */
  toggleMute(): void {
    this.setMuted(!this._isMuted());
  }

  // =========================================================================
  // LOAD & PLAY
  // =========================================================================

  /**
   * Carga y reproduce un video por su ID
   * @param videoId YouTube video ID (11 chars)
   * @param options Opciones de reproducción
   */
  loadAndPlay(videoId: string, options: PlayOptions = {}): Observable<void> {
    if (!videoId || videoId.length !== 11) {
      return throwError(() => new Error('video_id inválido'));
    }

    // Si el player no está inicializado, inicializarlo primero
    if (!this.playerCore.getPlayer()) {
      this.logger.info('Player no inicializado, inicializando...');
      return this.init('youtube-player').pipe(
        switchMap(() => this.loadAndPlay(videoId, options))
      );
    }

    // Obtener info de la canción
    return this.songService.getSongById(videoId).pipe(
      tap(song => {
        const startSeconds = options.startSeconds ?? 0;
        
        this.playerCore.loadVideoById(videoId, startSeconds);

        this.updateState({
          videoId,
          currentSong: song,
          playing: options.autoplay ?? false,
          currentTime: startSeconds,
          error: null,
          isBuffering: true,
        });

        this.applyDynamicTheme(song);

        this.logger.info('Video cargado', {
          videoId,
          title: song.title,
          autoplay: options.autoplay,
        });

        // Si autoplay está activado, reproducir
        if (options.autoplay) {
          setTimeout(() => this.play(), 500);
        }
      }),
      map(() => void 0),
      catchError(err => {
        this.logger.error('Error cargando video', err);
        this.updateState({ error: err.message });
        return throwError(() => err);
      })
    );
  }

  /**
   * Busca y reproduce la primera canción encontrada
   * @param query Término de búsqueda
   */
  searchAndPlay(query: string): Observable<string> {
    if (!query.trim()) {
      return throwError(() => new Error('Consulta de búsqueda vacía'));
    }

    this.logger.info('Buscando y reproduciendo', { query });

    return this.searchService.quickSearch(query, 1).pipe(
      switchMap(results => {
        if (results.length === 0) {
          throw new Error('No se encontraron resultados');
        }

        const song = results[0];
        return this.loadAndPlay(song.id, { autoplay: true }).pipe(
          map(() => song.id)
        );
      }),
      tap(videoId => {
        this.logger.info('Reproduciendo', { query, videoId });
      }),
      catchError(error => {
        this.logger.error('Error en búsqueda y reproducción', error);
        this.updateState({ error: error.message });
        return throwError(() => error);
      })
    );
  }

  // =========================================================================
  // STATE HELPERS
  // =========================================================================

  /**
   * Limpia la canción actual
   */
  clearCurrentSong(): void {
    this.updateState({ currentSong: null, videoId: null });
    this.stop();
    this.logger.info('Canción actual limpiada');
  }

  private applyDynamicTheme(song: Song | null): void {
    if (!this.isBrowser || !song) return;

    if (!song.thumbnails) {
      this.logger.warn('Canción sin thumbnails para tema dinámico', { id: song.id });
      return;
    }

    const thumbnailUrl = getBestThumbnail(song.thumbnails);
    if (!thumbnailUrl) {
      this.logger.warn('Sin thumbnail disponible para tema dinámico', { id: song.id });
      return;
    }

    void this.themeService.updateFromThumbnail(thumbnailUrl);
  }

  /**
   * Limpia el error
   */
  clearError(): void {
    this.updateState({ error: null });
  }

  // =========================================================================
  // GETTERS (legacy, usar signals cuando sea posible)
  // =========================================================================

  getCurrentTime(): number {
    return this.playerCore.getCurrentTime();
  }

  getDuration(): number {
    return this.playerCore.getDuration();
  }

  getVolume(): number {
    return this._volume();
  }

  isPlaying(): boolean {
    return this._playing();
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  /**
   * Inicia el polling para actualizar currentTime y duration
   */
  private startPolling(): void {
    this.stopPolling();
    
    this.pollingSub = interval(1000)
      .pipe(
        takeUntil(this.destroy$),
        map(() => ({
          currentTime: this.playerCore.getCurrentTime(),
          duration: this.playerCore.getDuration(),
        }))
      )
      .subscribe(({ currentTime, duration }) => {
        this.updateState({ 
          currentTime, 
          duration,
          isBuffering: false,
        });
      });

    this.logger.debug('Polling iniciado');
  }

  /**
   * Detiene el polling
   */
  private stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;
  }

  /**
   * Actualiza el estado (BehaviorSubject + Signals)
   */
  private updateState(partial: Partial<PlayerState>): void {
    const current = this.stateSubject.value;
    const newState = { ...current, ...partial };
    
    this.stateSubject.next(newState);

    // Sincronizar con signals
    if (partial.playing !== undefined) this._playing.set(partial.playing);
    if (partial.currentTime !== undefined) this._currentTime.set(partial.currentTime);
    if (partial.duration !== undefined) this._duration.set(partial.duration);
    if (partial.volume !== undefined) this._volume.set(partial.volume);
    if (partial.isMuted !== undefined) this._isMuted.set(partial.isMuted);
    if (partial.currentSong !== undefined) this._currentSong.set(partial.currentSong);
    if (partial.error !== undefined) this._error.set(partial.error);
    if (partial.isBuffering !== undefined) this._isBuffering.set(partial.isBuffering);
  }

  /**
   * Carga settings guardados del storage
   */
  private loadSavedSettings(): void {
    this.storage.getVolume().subscribe(volume => {
      if (volume !== null) {
        this._volume.set(volume);
        this.logger.debug('Volumen cargado', { volume });
      }
    });

    // TODO: Agregar más settings si es necesario (quality, etc.)
  }

  /**
   * Formatea segundos a MM:SS
   */
  private formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
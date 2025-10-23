import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { LoggerService } from '../core/logger.service';
import { SONG_ENDPOINTS } from '../constants/endpoints';
import { Song } from '../interfaces/song.interfaces';

/**
 * Servicio para obtener información de canciones individuales.
 * 
 * Features:
 * - Obtener detalles de canción por video_id
 * - Cache en memoria de canciones consultadas
 * - Validación de video_id
 */
@Injectable({
  providedIn: 'root',
})
export class SongService {
  private readonly api = inject(ApiService);
  private readonly logger = inject(LoggerService);

  private readonly songCache = new Map<string, Song>();
  
  private readonly _currentSong = signal<Song | null>(null);
  private readonly _isLoading = signal<boolean>(false);

  readonly currentSong = this._currentSong.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  constructor() {
    this.logger.info('SongService initialized');
  }

  // =========================================================================
  // GET SONG
  // =========================================================================

  /**
   * Obtiene detalles de una canción por su video ID
   * @param videoId YouTube video ID (11 caracteres)
   * @param forceRefresh Si es true, ignora cache
   */
  getSongById(videoId: string, forceRefresh: boolean = false): Observable<Song> {
    this.validateVideoId(videoId);

    // Verificar cache primero
    if (!forceRefresh && this.songCache.has(videoId)) {
      this.logger.debug(`Canción obtenida del cache: ${videoId}`);
      const cachedSong = this.songCache.get(videoId)!;
      this._currentSong.set(cachedSong);
      return of(cachedSong);
    }

    this.logger.info('Obteniendo detalles de canción', { videoId });
    this._isLoading.set(true);

    return this.api.get<Song>(SONG_ENDPOINTS.BY_ID(videoId)).pipe(
      tap((song) => {
        this.songCache.set(videoId, song);
        this._currentSong.set(song);
        this.logger.info('Canción obtenida exitosamente', {
          videoId,
          title: song.title,
        });
      }),
      catchError((error) => {
        this.logger.error('Error obteniendo canción', error);
        return throwError(() => this.normalizeError(error, videoId));
      }),
      tap(() => this._isLoading.set(false))
    );
  }

  // =========================================================================
  // CACHE MANAGEMENT
  // =========================================================================

  /**
   * Pre-cachea múltiples canciones (útil después de búsqueda)
   */
  cacheSongs(songs: Song[]): void {
    songs.forEach(song => {
      if (!this.songCache.has(song.id)) {
        this.songCache.set(song.id, song);
      }
    });
    this.logger.debug(`Cacheadas ${songs.length} canciones`);
  }

  /**
   * Obtiene canción del cache (sin llamar API)
   */
  getCachedSong(videoId: string): Song | null {
    return this.songCache.get(videoId) || null;
  }

  /**
   * Verifica si una canción está en cache
   */
  isCached(videoId: string): boolean {
    return this.songCache.has(videoId);
  }

  /**
   * Limpia el cache
   */
  clearCache(): void {
    this.songCache.clear();
    this.logger.debug('Cache de canciones limpiado');
  }

  /**
   * Limpia canción actual del estado
   */
  clearCurrentSong(): void {
    this._currentSong.set(null);
  }

  // =========================================================================
  // VALIDATION
  // =========================================================================

  /**
   * Valida que el video_id sea válido (11 caracteres)
   */
  private validateVideoId(videoId: string): void {
    if (!videoId || typeof videoId !== 'string') {
      throw new Error('video_id es requerido');
    }

    if (videoId.length !== 11) {
      throw new Error('video_id debe tener exactamente 11 caracteres');
    }

    // Validar caracteres permitidos (YouTube IDs son alfanuméricos + - y _)
    const validPattern = /^[a-zA-Z0-9_-]{11}$/;
    if (!validPattern.test(videoId)) {
      throw new Error('video_id contiene caracteres inválidos');
    }
  }

  /**
   * Normaliza errores de la API
   */
  private normalizeError(error: any, videoId: string): Error {
    if (error?.message) {
      return new Error(error.message);
    }

    const status = error?.status;
    const detail = error?.error?.detail;

    switch (status) {
      case 404:
        return new Error(`Canción no encontrada: ${videoId}`);
      case 422:
        return new Error(detail || 'video_id inválido');
      case 503:
        return new Error('Servicio de YouTube no disponible temporalmente');
      default:
        return new Error(detail || 'Error obteniendo información de la canción');
    }
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  /**
   * Formatea duración de segundos a MM:SS
   */
  formatDuration(durationSeconds: string | null): string {
    if (!durationSeconds) return '--:--';

    const totalSeconds = parseInt(durationSeconds, 10);
    if (isNaN(totalSeconds)) return '--:--';

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Obtiene URL de thumbnail de mejor calidad disponible
   */
  getBestThumbnail(thumbnails: Record<string, any> | null): string | null {
    if (!thumbnails) return null;

    // Orden de preferencia: maxres > high > medium > default
    const priorities = ['maxres', 'high', 'medium', 'default'];
    
    for (const priority of priorities) {
      if (thumbnails[priority]?.url) {
        return thumbnails[priority].url;
      }
    }

    return null;
  }
}
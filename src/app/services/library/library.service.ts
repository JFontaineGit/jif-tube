import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { ApiService, LoggerService, AuthService } from '@services';
import { LIBRARY_ENDPOINTS } from '../constants/endpoints';
import { LibraryItem, LibraryItemCreate } from '@interfaces';

/**
 * Servicio para gestión de biblioteca/favoritos del usuario.
 * 
 * Features:
 * - Listar canciones favoritas
 * - Agregar/quitar de biblioteca
 * - Estado reactivo con Signals
 * - Verificación rápida de favoritos
 * - Comprobación de autenticación
 */
@Injectable({
  providedIn: 'root',
})
export class LibraryService {
  private readonly api = inject(ApiService);
  private readonly logger = inject(LoggerService);
  private readonly auth = inject(AuthService); 

  // Estado reactivo
  private readonly _libraryItems = signal<LibraryItem[]>([]);
  private readonly _isLoading = signal<boolean>(false);

  readonly libraryItems = this._libraryItems.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  // Computed: Set de IDs para verificación rápida
  readonly favoriteIds = computed(() => {
    return new Set(this._libraryItems().map(item => item.song_id));
  });

  // Computed: Cantidad de favoritos
  readonly favoriteCount = computed(() => this._libraryItems().length);

  constructor() {
    this.logger.info('LibraryService initialized');
  }

  // =========================================================================
  // GET LIBRARY
  // =========================================================================

  /**
   * Obtiene todas las canciones de la biblioteca del usuario
   */
  getLibrary(): Observable<LibraryItem[]> {
    this.logger.info('Obteniendo biblioteca');
    this._isLoading.set(true);

    // Si el usuario no está logueado, devolvemos un array vacío
    if (!this.auth.isLoggedIn()) {
      this.logger.warn('Intento de obtener biblioteca sin autenticación');
      this._libraryItems.set([]);
      this._isLoading.set(false);
      return of([]);
    }

    return this.api.get<LibraryItem[]>(LIBRARY_ENDPOINTS.LIST).pipe(
      tap((items) => {
        this._libraryItems.set(items);
        this.logger.info('Biblioteca cargada', { count: items.length });
      }),
      catchError((error) => {
        this.logger.error('Error obteniendo biblioteca', error);
        return throwError(() => this.normalizeError(error));
      }),
      tap(() => this._isLoading.set(false))
    );
  }

  // =========================================================================
  // ADD TO LIBRARY
  // =========================================================================

  /**
   * Agrega una canción a la biblioteca
   * @param songId YouTube video_id
   */
  addToLibrary(songId: string): Observable<LibraryItem> {
    this.validateSongId(songId);

    // Verificar autenticación
    if (!this.auth.isLoggedIn()) {
      return throwError(() => new Error('Debes iniciar sesión para guardar canciones'));
    }

    // Verificar si ya está en favoritos
    if (this.isFavorite(songId)) {
      this.logger.warn('Canción ya está en biblioteca', { songId });
      return throwError(() => new Error('Esta canción ya está en tu biblioteca'));
    }

    this.logger.info('Agregando a biblioteca', { songId });

    const payload: LibraryItemCreate = { song_id: songId };

    return this.api.post<LibraryItem>(LIBRARY_ENDPOINTS.ADD, payload).pipe(
      tap((item) => {
        // Agregar al estado local
        this._libraryItems.update(items => [...items, item]);
        this.logger.info('Canción agregada a biblioteca', {
          songId,
          itemId: item.id,
        });
      }),
      catchError((error) => {
        this.logger.error('Error agregando a biblioteca', error);
        return throwError(() => this.normalizeError(error));
      })
    );
  }

  // =========================================================================
  // REMOVE FROM LIBRARY
  // =========================================================================

  /**
   * Elimina una canción de la biblioteca
   * @param songId YouTube video_id
   */
  removeFromLibrary(songId: string): Observable<void> {
    this.validateSongId(songId);

    // Verificar autenticación
    if (!this.auth.isLoggedIn()) {
      return throwError(() => new Error('Debes iniciar sesión para eliminar canciones'));
    }

    if (!this.isFavorite(songId)) {
      this.logger.warn('Canción no está en biblioteca', { songId });
      return throwError(() => new Error('Esta canción no está en tu biblioteca'));
    }

    this.logger.info('Eliminando de biblioteca', { songId });

    return this.api.delete<void>(LIBRARY_ENDPOINTS.REMOVE(songId)).pipe(
      tap(() => {
        // Quitar del estado local
        this._libraryItems.update(items => 
          items.filter(item => item.song_id !== songId)
        );
        this.logger.info('Canción eliminada de biblioteca', { songId });
      }),
      catchError((error) => {
        this.logger.error('Error eliminando de biblioteca', error);
        return throwError(() => this.normalizeError(error));
      })
    );
  }

  // =========================================================================
  // TOGGLE FAVORITE
  // =========================================================================

  /**
   * Toggle: agrega o quita según el estado actual
   * @param songId YouTube video_id
   */
  toggleFavorite(songId: string): Observable<LibraryItem | void> {
    if (this.isFavorite(songId)) {
      return this.removeFromLibrary(songId);
    } else {
      return this.addToLibrary(songId);
    }
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  /**
   * Verifica si una canción está en favoritos (sincrónico)
   */
  isFavorite(songId: string): boolean {
    return this.favoriteIds().has(songId);
  }

  /**
   * Obtiene un item de la biblioteca por song_id
   */
  getLibraryItem(songId: string): LibraryItem | undefined {
    return this._libraryItems().find(item => item.song_id === songId);
  }

  /**
   * Limpia el estado local de la biblioteca
   */
  clearLibrary(): void {
    this._libraryItems.set([]);
    this.logger.debug('Biblioteca local limpiada');
  }

  // =========================================================================
  // VALIDATION
  // =========================================================================

  /**
   * Valida que el song_id sea válido (11 caracteres)
   */
  private validateSongId(songId: string): void {
    if (!songId || typeof songId !== 'string') {
      throw new Error('song_id es requerido');
    }

    if (songId.length !== 11) {
      throw new Error('song_id debe tener exactamente 11 caracteres');
    }

    const validPattern = /^[a-zA-Z0-9_-]{11}$/;
    if (!validPattern.test(songId)) {
      throw new Error('song_id contiene caracteres inválidos');
    }
  }

  /**
   * Normaliza errores de la API
   */
  private normalizeError(error: any): Error {
    if (error?.message) {
      return new Error(error.message);
    }

    const status = error?.status;
    const detail = error?.error?.detail;

    switch (status) {
      case 401:
        return new Error('Debes iniciar sesión para acceder a tu biblioteca');
      case 404:
        return new Error('Canción no encontrada en la biblioteca');
      case 409:
        return new Error('Esta canción ya está en tu biblioteca');
      case 422:
        return new Error(detail || 'song_id inválido');
      default:
        return new Error(detail || 'Error en la operación de biblioteca');
    }
  }
}

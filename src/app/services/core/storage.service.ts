import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoggerService } from '@services';
import { StorageKey, STORAGE_KEYS } from '@constants';

/**
 * Servicio para gestionar localStorage de forma segura.
 * Maneja:
 * - Tokens (access_token, refresh_token)
 * - Settings de usuario (theme, volume, playback_quality)
 * - Estado del player (opcional)
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private logger: LoggerService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // =========================================================================
  // TOKEN MANAGEMENT
  // =========================================================================

  saveAccessToken(token: string): Observable<void> {
    return this.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  }

  getAccessToken(): Observable<string | null> {
    return this.getItem<string>(STORAGE_KEYS.ACCESS_TOKEN);
  }

  saveRefreshToken(token: string): Observable<void> {
    return this.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  }

  getRefreshToken(): Observable<string | null> {
    return this.getItem<string>(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Guarda ambos tokens de forma asíncrona garantizando que se completen antes de continuar
   */
  saveTokens(accessToken: string, refreshToken: string): Observable<void> {
    this.logger.debug('Guardando tokens en storage...');
    
    return forkJoin({
      access: this.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
      refresh: this.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
    }).pipe(
      map(() => {
        this.logger.info('✓ Tokens guardados exitosamente en storage');
        return void 0;
      })
    );
  }

  clearTokens(): Observable<void> {
    this.removeItemSync(STORAGE_KEYS.ACCESS_TOKEN);
    this.removeItemSync(STORAGE_KEYS.REFRESH_TOKEN);
    this.logger.info('Tokens eliminados del storage');
    return of(void 0);
  }

  // =========================================================================
  // USER SETTINGS
  // =========================================================================

  saveUserSettings(settings: Record<string, any>): Observable<void> {
    return this.setItem(STORAGE_KEYS.USER_SETTINGS, settings);
  }

  getUserSettings<T = Record<string, any>>(): Observable<T | null> {
    return this.getItem<T>(STORAGE_KEYS.USER_SETTINGS);
  }

  saveTheme(theme: string): Observable<void> {
    return this.setItem(STORAGE_KEYS.THEME, theme);
  }

  getTheme(): Observable<string | null> {
    return this.getItem<string>(STORAGE_KEYS.THEME);
  }

  saveVolume(volume: number): Observable<void> {
    return this.setItem(STORAGE_KEYS.VOLUME, volume);
  }

  getVolume(): Observable<number | null> {
    return this.getItem<number>(STORAGE_KEYS.VOLUME);
  }

  savePlaybackQuality(quality: string): Observable<void> {
    return this.setItem(STORAGE_KEYS.PLAYBACK_QUALITY, quality);
  }

  getPlaybackQuality(): Observable<string | null> {
    return this.getItem<string>(STORAGE_KEYS.PLAYBACK_QUALITY);
  }

  // =========================================================================
  // PLAYER STATE (opcional)
  // =========================================================================

  savePlayerState(state: any): Observable<void> {
    return this.setItem(STORAGE_KEYS.PLAYER_STATE, state);
  }

  getPlayerState<T = any>(): Observable<T | null> {
    return this.getItem<T>(STORAGE_KEYS.PLAYER_STATE);
  }

  saveQueue(queue: any): Observable<void> {
    return this.setItem(STORAGE_KEYS.QUEUE, queue);
  }

  getQueue<T = any>(): Observable<T | null> {
    return this.getItem<T>(STORAGE_KEYS.QUEUE);
  }

  // =========================================================================
  // CACHE & SYNC
  // =========================================================================

  saveLastSync(timestamp: number): Observable<void> {
    return this.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
  }

  getLastSync(): Observable<number | null> {
    return this.getItem<number>(STORAGE_KEYS.LAST_SYNC);
  }

  // =========================================================================
  // REMEMBER EMAIL (para login)
  // =========================================================================

  saveRememberedEmail(email: string): Observable<void> {
    return this.setItem(STORAGE_KEYS.REMEMBER_EMAIL, email);
  }

  getRememberedEmail(): Observable<string | null> {
    return this.getItem<string>(STORAGE_KEYS.REMEMBER_EMAIL);
  }

  clearRememberedEmail(): Observable<void> {
    this.removeItemSync(STORAGE_KEYS.REMEMBER_EMAIL);
    return of(void 0);
  }

  // =========================================================================
  // GENERIC METHODS (privados)
  // =========================================================================

  private setItem<T>(key: StorageKey, value: T): Observable<void> {
    if (!this.isBrowser) {
      this.logger.warn(`setItem: No se puede guardar ${key} (SSR)`);
      return of(void 0);
    }

    try {
      // Para strings primitivos (tokens), guardar directamente sin stringify
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
      this.logger.debug(`Storage: guardado ${key}`);
      return of(void 0);
    } catch (error) {
      this.logger.error(`Error guardando ${key}`, error);
      return throwError(() => error);
    }
  }

  public getItem<T>(key: StorageKey): Observable<T | null> {
    if (!this.isBrowser) {
      this.logger.warn(`getItem: No se puede leer ${key} (SSR)`);
      return of(null);
    }

    try {
      const serialized = localStorage.getItem(key);
      if (serialized === null) {
        this.logger.debug(`Storage: ${key} no encontrado`);
        return of(null);
      }

      // Intentar parsear como JSON, si falla devolver como string
      try {
        const value = JSON.parse(serialized) as T;
        this.logger.debug(`Storage: leído ${key}`);
        return of(value);
      } catch {
        // Si no es JSON válido, devolver como string (caso de tokens)
        this.logger.debug(`Storage: leído ${key} (string)`);
        return of(serialized as T);
      }
    } catch (error) {
      this.logger.error(`Error leyendo ${key}`, error);
      return throwError(() => error);
    }
  }

  private setItemSync<T>(key: StorageKey, value: T): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Error guardando sync ${key}`, error);
    }
  }

  private removeItemSync(key: StorageKey): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      this.logger.error(`Error eliminando sync ${key}`, error);
    }
  }

  /**
   * Limpia SOLO datos de JifTube (no todo localStorage)
   */
  clearAll(): Observable<void> {
    if (!this.isBrowser) {
      return of(void 0);
    }

    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      this.logger.info('Storage limpiado completamente');
      return of(void 0);
    } catch (error) {
      this.logger.error('Error limpiando storage', error);
      return throwError(() => error);
    }
  }
}
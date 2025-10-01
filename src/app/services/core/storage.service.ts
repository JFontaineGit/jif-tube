import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from, throwError, catchError } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoggerService } from './logger.service';

/**
 * Servicio para gestionar operaciones de almacenamiento local (localStorage/sessionStorage o en memoria).
 * Proporciona métodos para guardar, obtener, limpiar y listar claves, con soporte para entornos sin localStorage.
 * Incluye métodos específicos síncronos para autenticación.
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private memoryStorage: Map<string, string> = new Map();
  private memorySessionStorage: Map<string, string> = new Map();
  private isBrowser: boolean;

  // Storage keys para auth
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly STORAGE_KEY_EMAIL = 'rememberEmail';
  private readonly TEMP_RESET_EMAIL_KEY = 'temp_reset_email';
  private readonly SCOPES_KEY = 'scopes';

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private logger: LoggerService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Verifica si localStorage está disponible.
   * @returns True si localStorage está definido y accesible.
   */
  private isLocalStorageAvailable(): boolean {
    if (!this.isBrowser) {
      this.logger.warn('localStorage no disponible: no se está ejecutando en un navegador');
      return false;
    }
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (error: any) {
      this.logger.warn(`localStorage no accesible: ${error.message || 'Error desconocido'}`, error);
      return false;
    }
  }

  /**
   * Verifica si sessionStorage está disponible.
   */
  private isSessionStorageAvailable(): boolean {
    if (!this.isBrowser) {
      return false;
    }
    try {
      const testKey = '__test__';
      sessionStorage.setItem(testKey, testKey);
      sessionStorage.removeItem(testKey);
      return true;
    } catch (error: any) {
      this.logger.warn(`sessionStorage no accesible: ${error.message || 'Error desconocido'}`);
      return false;
    }
  }

  // ============================================
  // MÉTODOS OBSERVABLES ORIGINALES (INTACTOS)
  // ============================================

  /**
   * Guarda un valor en el almacenamiento (localStorage o en memoria).
   * @param key - La clave bajo la cual se almacenará el valor.
   * @param value - El valor a almacenar (se convierte a JSON).
   * @returns Observable que resuelve cuando el valor se guarda exitosamente.
   */
  save<T>(key: string, value: T): Observable<void> {
    return from(
      new Promise<void>((resolve, reject) => {
        try {
          const serializedValue = JSON.stringify(value);
          if (this.isLocalStorageAvailable()) {
            localStorage.setItem(key, serializedValue);
            this.logger.debug(`Guardado en localStorage: ${key}`);
          } else {
            this.memoryStorage.set(key, serializedValue);
            this.logger.debug(`Guardado en memoria: ${key}`);
          }
          resolve();
        } catch (error: any) {
          this.logger.error(`Error al guardar en almacenamiento: ${key}`, error);
          reject(error);
        }
      })
    ).pipe(
      map(() => void 0),
      catchError((error) => {
        this.logger.error(`Error en observable de save: ${key}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene un valor del almacenamiento (localStorage o en memoria).
   * @param key - La clave del valor a recuperar.
   * @returns Observable que emite el valor deserializado o null si no existe.
   */
  get<T>(key: string): Observable<T | null> {
    return from(
      new Promise<T | null>((resolve, reject) => {
        try {
          let serializedValue: string | null = null;
          if (this.isLocalStorageAvailable()) {
            serializedValue = localStorage.getItem(key);
            this.logger.debug(`Obtenido de localStorage: ${key}`);
          } else {
            serializedValue = this.memoryStorage.get(key) || null;
            this.logger.debug(`Obtenido de memoria: ${key}`);
          }
          if (serializedValue === null) {
            this.logger.debug(`No se encontró valor para la clave: ${key}`);
            resolve(null);
          } else {
            const value: T = JSON.parse(serializedValue);
            resolve(value);
          }
        } catch (error: any) {
          this.logger.error(`Error al obtener del almacenamiento: ${key}`, error);
          reject(error);
        }
      })
    ).pipe(
      catchError((error) => {
        this.logger.error(`Error en observable de get: ${key}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Limpia todo el almacenamiento (localStorage o en memoria).
   * @returns Observable que resuelve cuando el almacenamiento se limpia exitosamente.
   */
  clearStorage(): Observable<void> {
    return from(
      new Promise<void>((resolve, reject) => {
        try {
          if (this.isLocalStorageAvailable()) {
            localStorage.clear();
            this.logger.info('localStorage limpiado');
          } else {
            this.memoryStorage.clear();
            this.logger.info('Almacenamiento en memoria limpiado');
          }
          resolve();
        } catch (error: any) {
          this.logger.error('Error al limpiar el almacenamiento', error);
          reject(error);
        }
      })
    ).pipe(
      map(() => void 0),
      catchError((error) => {
        this.logger.error('Error en observable de clearStorage', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Elimina una clave específica del almacenamiento (localStorage o en memoria).
   * @param key - La clave a eliminar.
   * @returns Observable que resuelve cuando la clave se elimina exitosamente.
   */
  remove(key: string): Observable<void> {
    return from(
      new Promise<void>((resolve, reject) => {
        try {
          if (this.isLocalStorageAvailable()) {
            localStorage.removeItem(key);
            this.logger.debug(`Eliminada clave de localStorage: ${key}`);
          } else {
            this.memoryStorage.delete(key);
            this.logger.debug(`Eliminada clave de memoria: ${key}`);
          }
          resolve();
        } catch (error: any) {
          this.logger.error(`Error al eliminar del almacenamiento: ${key}`, error);
          reject(error);
        }
      })
    ).pipe(
      map(() => void 0),
      catchError((error) => {
        this.logger.error(`Error en observable de remove: ${key}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene todas las claves almacenadas (localStorage o en memoria).
   * @returns Observable con un arreglo de claves.
   */
  getKeys(): Observable<string[]> {
    return from(
      new Promise<string[]>((resolve, reject) => {
        try {
          if (this.isLocalStorageAvailable()) {
            const keys = Object.keys(localStorage);
            this.logger.debug(`Claves obtenidas de localStorage: ${keys.length}`);
            resolve(keys);
          } else {
            const keys = Array.from(this.memoryStorage.keys());
            this.logger.debug(`Claves obtenidas de memoria: ${keys.length}`);
            resolve(keys);
          }
        } catch (error: any) {
          this.logger.error('Error al obtener claves del almacenamiento', error);
          reject(error);
        }
      })
    ).pipe(
      catchError((error) => {
        this.logger.error('Error en observable de getKeys', error);
        return throwError(() => error);
      })
    );
  }

  // ============================================
  // MÉTODOS SÍNCRONOS PARA AUTH (NUEVOS)
  // ============================================

  /**
   * Obtiene el access token (síncrono).
   */
  getAccessToken(): string | null {
    if (this.isLocalStorageAvailable()) {
      return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    }
    return this.memoryStorage.get(this.ACCESS_TOKEN_KEY) || null;
  }

  /**
   * Guarda el access token (síncrono).
   */
  setAccessToken(token: string): void {
    if (this.isLocalStorageAvailable()) {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
      this.logger.debug('Access token guardado');
    } else {
      this.memoryStorage.set(this.ACCESS_TOKEN_KEY, token);
      this.logger.debug('Access token guardado en memoria');
    }
  }

  /**
   * Obtiene el refresh token (síncrono).
   */
  getRefreshToken(): string | null {
    if (this.isLocalStorageAvailable()) {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }
    return this.memoryStorage.get(this.REFRESH_TOKEN_KEY) || null;
  }

  /**
   * Guarda el refresh token (síncrono).
   */
  setRefreshToken(token: string): void {
    if (this.isLocalStorageAvailable()) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
      this.logger.debug('Refresh token guardado');
    } else {
      this.memoryStorage.set(this.REFRESH_TOKEN_KEY, token);
      this.logger.debug('Refresh token guardado en memoria');
    }
  }

  /**
   * Elimina ambos tokens (access y refresh) (síncrono).
   */
  removeTokens(): void {
    if (this.isLocalStorageAvailable()) {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      this.logger.debug('Tokens eliminados de localStorage');
    } else {
      this.memoryStorage.delete(this.ACCESS_TOKEN_KEY);
      this.memoryStorage.delete(this.REFRESH_TOKEN_KEY);
      this.logger.debug('Tokens eliminados de memoria');
    }
  }

  /**
   * Obtiene el email recordado (síncrono).
   */
  getRememberEmail(): string | null {
    if (this.isLocalStorageAvailable()) {
      return localStorage.getItem(this.STORAGE_KEY_EMAIL);
    }
    return this.memoryStorage.get(this.STORAGE_KEY_EMAIL) || null;
  }

  /**
   * Guarda el email para recordar (síncrono).
   */
  setRememberEmail(email: string): void {
    if (this.isLocalStorageAvailable()) {
      localStorage.setItem(this.STORAGE_KEY_EMAIL, email);
      this.logger.debug('Email recordado guardado');
    } else {
      this.memoryStorage.set(this.STORAGE_KEY_EMAIL, email);
      this.logger.debug('Email recordado guardado en memoria');
    }
  }

  /**
   * Elimina el email recordado (síncrono).
   */
  removeRememberEmail(): void {
    if (this.isLocalStorageAvailable()) {
      localStorage.removeItem(this.STORAGE_KEY_EMAIL);
    } else {
      this.memoryStorage.delete(this.STORAGE_KEY_EMAIL);
    }
  }

  /**
   * Guarda temporalmente el email para reset de contraseña (sessionStorage, síncrono).
   */
  setTempResetEmail(email: string): void {
    try {
      if (this.isSessionStorageAvailable()) {
        sessionStorage.setItem(this.TEMP_RESET_EMAIL_KEY, email);
        this.logger.debug('Email temporal de reset guardado');
      } else {
        this.memorySessionStorage.set(this.TEMP_RESET_EMAIL_KEY, email);
        this.logger.debug('Email temporal de reset guardado en memoria');
      }
    } catch (error) {
      this.logger.warn('No se pudo guardar el email temporal:', error);
    }
  }

  /**
   * Obtiene el email temporal para reset de contraseña (síncrono).
   */
  getTempResetEmail(): string | null {
    try {
      if (this.isSessionStorageAvailable()) {
        return sessionStorage.getItem(this.TEMP_RESET_EMAIL_KEY);
      }
      return this.memorySessionStorage.get(this.TEMP_RESET_EMAIL_KEY) || null;
    } catch (error) {
      this.logger.warn('No se pudo leer el email temporal:', error);
      return null;
    }
  }

  /**
   * Elimina el email temporal para reset de contraseña (síncrono).
   */
  removeTempResetEmail(): void {
    try {
      if (this.isSessionStorageAvailable()) {
        sessionStorage.removeItem(this.TEMP_RESET_EMAIL_KEY);
      } else {
        this.memorySessionStorage.delete(this.TEMP_RESET_EMAIL_KEY);
      }
      this.logger.debug('Email temporal de reset eliminado');
    } catch (error) {
      this.logger.warn('No se pudo eliminar el email temporal:', error);
    }
  }

  /**
   * Guarda un valor genérico en localStorage (síncrono).
   */
  setItem(key: string, value: string): void {
    if (this.isLocalStorageAvailable()) {
      localStorage.setItem(key, value);
      this.logger.debug(`Item guardado: ${key}`);
    } else {
      this.memoryStorage.set(key, value);
      this.logger.debug(`Item guardado en memoria: ${key}`);
    }
  }

  /**
   * Obtiene un valor genérico de localStorage (síncrono).
   */
  getItem(key: string): string | null {
    if (this.isLocalStorageAvailable()) {
      return localStorage.getItem(key);
    }
    return this.memoryStorage.get(key) || null;
  }

  /**
   * Elimina un valor genérico de localStorage (síncrono).
   */
  removeItem(key: string): void {
    if (this.isLocalStorageAvailable()) {
      localStorage.removeItem(key);
      this.logger.debug(`Item eliminado: ${key}`);
    } else {
      this.memoryStorage.delete(key);
      this.logger.debug(`Item eliminado de memoria: ${key}`);
    }
  }

  /**
   * Limpia todos los datos temporales (sessionStorage, síncrono).
   */
  clearAllTempData(): void {
    this.removeTempResetEmail();
  }
}
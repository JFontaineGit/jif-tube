import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from, throwError, catchError } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoggerService } from './logger.service';

/**
 * Servicio para gestionar operaciones de almacenamiento local (localStorage o en memoria).
 * Proporciona métodos para guardar, obtener, limpiar y listar claves, con soporte para entornos sin localStorage.
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private memoryStorage: Map<string, string> = new Map();
  private isBrowser: boolean;

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
}
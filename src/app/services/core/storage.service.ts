import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from, throwError, catchError } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Servicio para gestionar operaciones de almacenamiento local (localStorage o en memoria).
 * Proporciona métodos para guardar, obtener y limpiar datos de forma segura, con soporte para entornos sin localStorage.
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private memoryStorage: Map<string, string> = new Map(); // Fallback en memoria
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Verifica si localStorage está disponible.
   * @returns True si localStorage está definido y accesible.
   */
  private isLocalStorageAvailable(): boolean {
    if (!this.isBrowser) return false;
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
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
          } else {
            this.memoryStorage.set(key, serializedValue);
          }
          resolve();
        } catch (error: any) {
          reject(new Error(`Error al guardar en almacenamiento: ${error.message || 'Error desconocido'}`));
        }
      })
    ).pipe(
      map(() => void 0),
      catchError(error => throwError(() => error))
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
          } else {
            serializedValue = this.memoryStorage.get(key) || null;
          }
          if (serializedValue === null) {
            resolve(null);
          } else {
            const value: T = JSON.parse(serializedValue);
            resolve(value);
          }
        } catch (error: any) {
          reject(new Error(`Error al obtener del almacenamiento: ${error.message || 'Error desconocido'}`));
        }
      })
    ).pipe(
      catchError(error => throwError(() => error))
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
          } else {
            this.memoryStorage.clear();
          }
          resolve();
        } catch (error: any) {
          reject(new Error(`Error al limpiar el almacenamiento: ${error.message || 'Error desconocido'}`));
        }
      })
    ).pipe(
      map(() => void 0),
      catchError(error => throwError(() => error))
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
          } else {
            this.memoryStorage.delete(key);
          }
          resolve();
        } catch (error: any) {
          reject(new Error(`Error al eliminar del almacenamiento: ${error.message || 'Error desconocido'}`));
        }
      })
    ).pipe(
      map(() => void 0),
      catchError(error => throwError(() => error))
    );
  }
}
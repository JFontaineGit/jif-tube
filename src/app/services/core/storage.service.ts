import { Injectable } from '@angular/core';
import { Observable, Observer, throwError } from 'rxjs';

/**
 * Servicio para gestionar operaciones de almacenamiento local (localStorage).
 * Proporciona métodos para guardar, obtener y limpiar datos de forma segura.
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  /**
   * Guarda un valor en el almacenamiento local.
   * @param key - La clave bajo la cual se almacenará el valor.
   * @param value - El valor a almacenar (se convierte a JSON).
   * @returns Observable que resuelve cuando el valor se guarda exitosamente.
   */
  save<T>(key: string, value: T): Observable<void> {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
      return new Observable<void>((observer: Observer<void>) => {
        observer.next();
        observer.complete();
      });
    } catch (error: any) {
      return throwError(() => new Error(`Error al guardar en localStorage: ${error.message || 'Error desconocido'}`));
    }
  }

  /**
   * Obtiene un valor del almacenamiento local.
   * @param key - La clave del valor a recuperar.
   * @returns Observable que emite el valor deserializado o null si no existe.
   */
  get<T>(key: string): Observable<T | null> {
    try {
      const serializedValue = localStorage.getItem(key);
      if (serializedValue === null) {
        return new Observable<T | null>((observer: Observer<T | null>) => {
          observer.next(null);
          observer.complete();
        });
      }
      const value: T = JSON.parse(serializedValue);
      return new Observable<T | null>((observer: Observer<T | null>) => {
        observer.next(value);
        observer.complete();
      });
    } catch (error: any) {
      return throwError(() => new Error(`Error al obtener de localStorage: ${error.message || 'Error desconocido'}`));
    }
  }

  /**
   * Limpia todo el almacenamiento local.
   * @returns Observable que resuelve cuando el almacenamiento se limpia exitosamente.
   */
  clearStorage(): Observable<void> {
    try {
      localStorage.clear();
      return new Observable<void>((observer: Observer<void>) => {
        observer.next();
        observer.complete();
      });
    } catch (error: any) {
      return throwError(() => new Error(`Error al limpiar localStorage: ${error.message || 'Error desconocido'}`));
    }
  }

  /**
   * Elimina una clave específica del almacenamiento local.
   * @param key - La clave a eliminar.
   * @returns Observable que resuelve cuando la clave se elimina exitosamente.
   */
  remove(key: string): Observable<void> {
    try {
      localStorage.removeItem(key);
      return new Observable<void>((observer: Observer<void>) => {
        observer.next();
        observer.complete();
      });
    } catch (error: any) {
      return throwError(() => new Error(`Error al eliminar de localStorage: ${error.message || 'Error desconocido'}`));
    }
  }
}
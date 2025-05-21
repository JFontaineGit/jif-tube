import { Injectable } from '@angular/core';
import { Observable, Observer, of } from 'rxjs';

/**
 * Servicio para registrar mensajes y errores en la aplicación.
 * Proporciona métodos para logging en consola, con soporte para futuros backends.
 */
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  /**
   * Registra un mensaje informativo en la consola.
   * @param message - El mensaje a registrar.
   * @param context - Contexto adicional opcional (objeto o datos relevantes).
   * @returns Observable que resuelve cuando el mensaje se registra.
   */
  log(message: string, context?: any): Observable<void> {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[INFO] ${timestamp} - ${message}`;
      if (context) {
        console.log(logMessage, context);
      } else {
        console.log(logMessage);
      }
      return of(void 0);
    } catch (error) {
      return this.handleError(error, 'Error al registrar mensaje informativo');
    }
  }

  /**
   * Registra un mensaje de error en la consola.
   * @param message - El mensaje de error a registrar.
   * @param error - El objeto de error asociado (opcional).
   * @returns Observable que resuelve cuando el error se registra.
   */
  error(message: string, error?: any): Observable<void> {
    try {
      const timestamp = new Date().toISOString();
      const errorMessage = `[ERROR] ${timestamp} - ${message}`;
      if (error) {
        console.error(errorMessage, error);
      } else {
        console.error(errorMessage);
      }
      return of(void 0);
    } catch (error) {
      return this.handleError(error, 'Error al registrar mensaje de error');
    }
  }

  /**
   * Registra un mensaje de advertencia en la consola.
   * @param message - El mensaje de advertencia a registrar.
   * @param context - Contexto adicional opcional (objeto o datos relevantes).
   * @returns Observable que resuelve cuando la advertencia se registra.
   */
  warn(message: string, context?: any): Observable<void> {
    try {
      const timestamp = new Date().toISOString();
      const warnMessage = `[WARN] ${timestamp} - ${message}`;
      if (context) {
        console.warn(warnMessage, context);
      } else {
        console.warn(warnMessage);
      }
      return of(void 0);
    } catch (error) {
      return this.handleError(error, 'Error al registrar mensaje de advertencia');
    }
  }

  /**
   * Maneja errores internos del servicio de logging.
   * @param error - El error capturado.
   * @param message - Mensaje descriptivo del error.
   * @returns Observable que emite el error manejado.
   */
  private handleError(error: any, message: string): Observable<never> {
    const errorMessage = `${message}: ${error.message || 'Error desconocido'}`;
    console.error(`[LoggerService] ${errorMessage}`, error);
    return new Observable<never>((observer: Observer<never>) => {
      observer.error(new Error(errorMessage));
    });
  }
}
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoggerService } from './logger.service';

/**
 * Service to handle HTTP requests to the backend API.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = 'http://127.0.0.1:8000';
  private baseWsUrl = 'ws://127.0.0.1:8000';
  private readonly logger = inject(LoggerService);

  constructor(private http: HttpClient) {}

  /**
   * Builds the full URL for an endpoint.
   * @param endpoint The API endpoint (e.g., 'doctors/').
   * @returns The constructed URL.
   */
  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
    return `${this.baseUrl}/${cleanEndpoint}`;
  }

  /**
   * Builds the full URL for a WebSocket endpoint.
   * @param endpoint The WebSocket endpoint (e.g., 'ws/chat/<chatId>').
   * @returns The constructed WebSocket URL.
   */
  public buildWsUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
    return `${this.baseWsUrl}/${cleanEndpoint}`;
  }

  /**
   * Performs a GET request to the specified endpoint.
   * @param endpoint The API endpoint.
   * @param options Optional HTTP options (e.g., query parameters).
   * @returns Observable of the response data.
   */
  get<T>(endpoint: string, options?: { headers?: HttpHeaders | { [header: string]: string | string[] }, params?: HttpParams }): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.get<T>(url, options).pipe(
      catchError((err) => {
        this.logger.error(`Error in GET ${endpoint}:`, err);
        return throwError(() => new Error(`Error al obtener datos de ${endpoint}`));
      })
    );
  }

  /**
   * Performs a POST request to the specified endpoint.
   * @param endpoint The API endpoint.
   * @param payload The request body.
   * @param options Optional HTTP options (e.g., query parameters).
   * @returns Observable of the response data.
   */
  post<T>(endpoint: string, payload: any, options?: { headers?: HttpHeaders | { [header: string]: string | string[] }, params?: HttpParams }): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.post<T>(url, payload, options).pipe(
      catchError((err) => {
        this.logger.error(`Error in POST ${endpoint}:`, err);
        return throwError(() => new Error(`Error al enviar datos a ${endpoint}`));
      })
    );
  }

  /**
   * Performs a PUT request to the specified endpoint.
   * @param endpoint The API endpoint.
   * @param payload The request body.
   * @param options Optional HTTP options (e.g., query parameters).
   * @returns Observable of the response data.
   */
  put<T>(endpoint: string, payload: any, options?: { params?: HttpParams }): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.put<T>(url, payload, options).pipe(
      catchError((err) => {
        this.logger.error(`Error in PUT ${endpoint}:`, err);
        return throwError(() => new Error(`Error al actualizar datos en ${endpoint}`));
      })
    );
  }

  /**
   * Performs a DELETE request to the specified endpoint.
   * @param endpoint The API endpoint.
   * @param options Optional HTTP options (e.g., query parameters).
   * @returns Observable of the response data.
   */
  delete<T>(endpoint: string, options?: { params?: HttpParams }): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.delete<T>(url, options).pipe(
      catchError((err) => {
        this.logger.error(`Error in DELETE ${endpoint}:`, err);
        return throwError(() => new Error(`Error al eliminar datos en ${endpoint}`));
      })
    );
  }

  /**
   * Performs a PATCH request to the specified endpoint.
   * @param endpoint The API endpoint.
   * @param payload The request body.
   * @param options Optional HTTP options (e.g., query parameters).
   * @returns Observable of the response data.
   */
  patch<T>(endpoint: string, payload: any, options?: { headers?: HttpHeaders | { [header: string]: string | string[] }, params?: HttpParams }): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.patch<T>(url, payload, options).pipe(
      catchError((err) => {
        this.logger.error(`Error in PATCH ${endpoint}:`, err);
        return throwError(() => new Error(`Error al modificar datos en ${endpoint}`));
      })
    );
  }
}
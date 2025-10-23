import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import { environment } from '../../environments/environment';

/**
 * Servicio base para todas las peticiones HTTP al backend FastAPI.
 * Encapsula HttpClient y maneja errores globalmente.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;
  private readonly logger = inject(LoggerService);

  constructor(private http: HttpClient) {
    this.logger.info('ApiService initialized', { baseUrl: this.baseUrl });
  }

  /**
   * GET request
   */
  get<T>(
    endpoint: string,
    options?: {
      params?: HttpParams | { [param: string]: string | string[] };
      headers?: HttpHeaders | { [header: string]: string | string[] };
    }
  ): Observable<T> {
    const url = this.buildUrl(endpoint);
    this.logger.debug(`GET ${url}`, options);

    return this.http.get<T>(url, options).pipe(
      catchError((error) => this.handleError('GET', endpoint, error))
    );
  }

  /**
   * POST request
   */
  post<T>(
    endpoint: string,
    body: any,
    options?: {
      params?: HttpParams | { [param: string]: string | string[] };
      headers?: HttpHeaders | { [header: string]: string | string[] };
    }
  ): Observable<T> {
    const url = this.buildUrl(endpoint);
    this.logger.debug(`POST ${url}`, { body, options });

    return this.http.post<T>(url, body, options).pipe(
      catchError((error) => this.handleError('POST', endpoint, error))
    );
  }

  /**
   * PUT request
   */
  put<T>(
    endpoint: string,
    body: any,
    options?: {
      params?: HttpParams | { [param: string]: string | string[] };
      headers?: HttpHeaders | { [header: string]: string | string[] };
    }
  ): Observable<T> {
    const url = this.buildUrl(endpoint);
    this.logger.debug(`PUT ${url}`, { body, options });

    return this.http.put<T>(url, body, options).pipe(
      catchError((error) => this.handleError('PUT', endpoint, error))
    );
  }

  /**
   * PATCH request
   */
  patch<T>(
    endpoint: string,
    body: any,
    options?: {
      params?: HttpParams | { [param: string]: string | string[] };
      headers?: HttpHeaders | { [header: string]: string | string[] };
    }
  ): Observable<T> {
    const url = this.buildUrl(endpoint);
    this.logger.debug(`PATCH ${url}`, { body, options });

    return this.http.patch<T>(url, body, options).pipe(
      catchError((error) => this.handleError('PATCH', endpoint, error))
    );
  }

  /**
   * DELETE request
   */
  delete<T>(
    endpoint: string,
    options?: {
      params?: HttpParams | { [param: string]: string | string[] };
      headers?: HttpHeaders | { [header: string]: string | string[] };
    }
  ): Observable<T> {
    const url = this.buildUrl(endpoint);
    this.logger.debug(`DELETE ${url}`, options);

    return this.http.delete<T>(url, options).pipe(
      catchError((error) => this.handleError('DELETE', endpoint, error))
    );
  }

  /**
   * POST with FormData (for login/refresh with form-urlencoded)
   */
  postForm<T>(
    endpoint: string,
    formData: { [key: string]: string }
  ): Observable<T> {
    const url = this.buildUrl(endpoint);
    const body = new URLSearchParams();
    Object.keys(formData).forEach(key => body.set(key, formData[key]));

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    this.logger.debug(`POST (form) ${url}`, formData);

    return this.http.post<T>(url, body.toString(), { headers }).pipe(
      catchError((error) => this.handleError('POST (form)', endpoint, error))
    );
  }

  /**
   * Construye URL completa: baseUrl + endpoint
   */
  private buildUrl(endpoint: string): string {
    // Limpiar slashes duplicados
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    return `${this.baseUrl}/${cleanEndpoint}`;
  }

  /**
   * Manejo centralizado de errores HTTP
   */
  private handleError(
    method: string,
    endpoint: string,
    error: any
  ): Observable<never> {
    let errorMessage = 'Error desconocido';

    // Si es un HttpErrorResponse (entorno Angular universal o navegador),
    // obtenemos el status y el detalle del backend
    if (error instanceof HttpErrorResponse) {
      const detail = error.error?.detail;
      errorMessage = detail || error.message || `Error ${error.status}`;
      this.logger.error(
        `${method} ${endpoint} - Status ${error.status}: ${errorMessage}`,
        error.error
      );
    } else {
      // En SSR, error puede no ser HttpErrorResponse ni tener ErrorEvent
      errorMessage = error?.message ?? String(error);
      this.logger.error(
        `${method} ${endpoint} - ${errorMessage}`,
        error
      );
    }

    // Devolvemos un objeto con status y message para que los servicios lo procesen
    return throwError(() => ({
      status: (error as HttpErrorResponse)?.status ?? 500,
      message: errorMessage,
      error: (error as HttpErrorResponse)?.error
    }));
  }
}
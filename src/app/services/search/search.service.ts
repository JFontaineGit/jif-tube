import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from '../core/api.service';
import { LoggerService } from '../core/logger.service';
import { SEARCH_ENDPOINTS } from '../constants/endpoints';
import {
  SongSearchResult,
  SearchParams,
  SearchHistory,
} from '../interfaces/search.interfaces';

/**
 * Servicio para búsqueda de canciones y manejo de historial.
 * 
 * Features:
 * - Búsqueda de videos en YouTube
 * - Historial de búsquedas (si está autenticado)
 * - Estado reactivo con Signals
 * - Validación de parámetros
 */
@Injectable({
  providedIn: 'root',
})
export class SearchService {
  private readonly api = inject(ApiService);
  private readonly logger = inject(LoggerService);

  // Estado reactivo
  private readonly _lastSearchResults = signal<SongSearchResult[]>([]);
  private readonly _searchHistory = signal<SearchHistory[]>([]);
  private readonly _isSearching = signal<boolean>(false);

  readonly lastSearchResults = this._lastSearchResults.asReadonly();
  readonly searchHistory = this._searchHistory.asReadonly();
  readonly isSearching = this._isSearching.asReadonly();

  constructor() {
    this.logger.info('SearchService initialized');
  }

  // =========================================================================
  // SEARCH
  // =========================================================================

  /**
   * Busca canciones en YouTube
   * @param params Query, max_results, region_code
   */
  search(params: SearchParams): Observable<SongSearchResult[]> {
    this.validateSearchParams(params);
    
    this.logger.info('Buscando canciones', { query: params.q });
    this._isSearching.set(true);

    // Construir HttpParams
    let httpParams = new HttpParams().set('q', params.q);

    if (params.max_results !== undefined) {
      httpParams = httpParams.set('max_results', params.max_results.toString());
    }

    if (params.region_code) {
      httpParams = httpParams.set('region_code', params.region_code);
    }

    return this.api.get<SongSearchResult[]>(SEARCH_ENDPOINTS.SEARCH, {
      params: httpParams,
    }).pipe(
      tap((results) => {
        this._lastSearchResults.set(results);
        this.logger.info('Búsqueda exitosa', {
          query: params.q,
          resultCount: results.length,
        });
      }),
      catchError((error) => {
        this.logger.error('Error en búsqueda', error);
        this._lastSearchResults.set([]);
        return throwError(() => this.normalizeError(error));
      }),
      tap(() => this._isSearching.set(false))
    );
  }

  /**
   * Búsqueda rápida (solo query string)
   */
  quickSearch(query: string, maxResults: number = 10): Observable<SongSearchResult[]> {
    return this.search({ q: query, max_results: maxResults });
  }

  // =========================================================================
  // SEARCH HISTORY
  // =========================================================================

  /**
   * Obtiene historial de búsquedas del usuario autenticado
   */
  getSearchHistory(): Observable<SearchHistory[]> {
    this.logger.debug('Obteniendo historial de búsquedas');

    return this.api.get<SearchHistory[]>(SEARCH_ENDPOINTS.HISTORY).pipe(
      tap((history) => {
        this._searchHistory.set(history);
        this.logger.info('Historial cargado', { count: history.length });
      }),
      catchError((error) => {
        this.logger.error('Error obteniendo historial', error);
        return throwError(() => this.normalizeError(error));
      })
    );
  }

  /**
   * Limpia el historial local (el backend no tiene DELETE endpoint)
   */
  clearLocalHistory(): void {
    this._searchHistory.set([]);
    this.logger.debug('Historial local limpiado');
  }

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================

  /**
   * Limpia resultados de búsqueda locales
   */
  clearSearchResults(): void {
    this._lastSearchResults.set([]);
    this.logger.debug('Resultados de búsqueda limpiados');
  }

  // =========================================================================
  // VALIDATION
  // =========================================================================

  /**
   * Valida parámetros de búsqueda
   */
  private validateSearchParams(params: SearchParams): void {
    const query = params.q.trim();

    if (!query) {
      throw new Error('El término de búsqueda no puede estar vacío');
    }

    if (query.length > 500) {
      throw new Error('El término de búsqueda es demasiado largo (máx 500 caracteres)');
    }

    if (params.max_results !== undefined) {
      if (params.max_results < 1 || params.max_results > 50) {
        throw new Error('max_results debe estar entre 1 y 50');
      }
    }

    if (params.region_code) {
      if (params.region_code.length !== 2) {
        throw new Error('region_code debe ser un código ISO de 2 caracteres');
      }
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
      case 400:
        return new Error(detail || 'Parámetros de búsqueda inválidos');
      case 422:
        return new Error(detail || 'Error de validación en la búsqueda');
      case 429:
        return new Error('Demasiadas búsquedas. Intenta de nuevo en unos momentos.');
      case 503:
        return new Error('Servicio de YouTube no disponible temporalmente');
      default:
        return new Error(detail || 'Error en la búsqueda');
    }
  }
}
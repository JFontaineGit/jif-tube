import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, distinctUntilChanged } from 'rxjs';
import {
  PlayerService,
  LibraryService,
  SearchService,
  LoggerService,
  QueueService,
} from '@services';
import { Song, SongSearchResult } from '@interfaces';
import { SongCardComponent } from '../../components/song-card/song-card.component';

/**
 * Search Page Component - Página de resultados de búsqueda
 * 
 * Features:
 * - Muestra el mejor resultado destacado
 * - Grid de resultados de búsqueda
 * - Reproducción directa
 * - Guardar en biblioteca
 * - Estados de carga y error
 */
@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SongCardComponent],
  templateUrl: './search-page.component.html',
  styleUrls: ['./search-page.component.scss'],
})
export class SearchPageComponent implements OnInit, OnDestroy {
  private readonly playerService = inject(PlayerService);
  private readonly libraryService = inject(LibraryService);
  private readonly searchService = inject(SearchService);
  private readonly logger = inject(LoggerService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly queueService = inject(QueueService);
  
  private readonly destroy$ = new Subject<void>();

  // =========================================================================
  // STATE SIGNALS
  // =========================================================================

  private readonly _query = signal<string>('');
  private readonly _searchResults = signal<SongSearchResult[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly query = this._query.asReadonly();
  readonly isSearching = this.searchService.isSearching;
  readonly error = this._error.asReadonly();

  // =========================================================================
  // COMPUTED SIGNALS
  // =========================================================================

  /**
   * Resultados de búsqueda (Song sin el custom_score)
   */
  readonly songs = computed(() => {
    return this._searchResults() as Song[];
  });

  /**
   * Mejor resultado (el primero de la lista)
   */
  readonly bestResult = computed(() => {
    const results = this._searchResults();
    return results.length > 0 ? results[0] as Song : null;
  });

  /**
   * Resultados filtrados (sin el mejor resultado)
   */
  readonly filteredSongs = computed(() => {
    const results = this._searchResults();
    return results.length > 1 ? results.slice(1) as Song[] : [];
  });

  /**
   * Indica si hay resultados
   */
  readonly hasResults = computed(() => this._searchResults().length > 0);

  /**
   * Indica si la búsqueda está vacía
   */
  readonly isEmpty = computed(() => {
    return !this.isSearching() && this._searchResults().length === 0 && this._query().trim().length > 0;
  });

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.logger.info('SearchPageComponent initialized');
    this.handleNavigationState();
    this.loadLibrary();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  /**
   * Carga la biblioteca del usuario para verificar favoritos
   */
  private loadLibrary(): void {
    this.libraryService.getLibrary().subscribe({
      next: () => this.logger.debug('Biblioteca cargada para búsqueda'),
      error: (err) => this.logger.warn('Error cargando biblioteca:', err),
    });
  }

  /**
   * Maneja el estado de navegación (router state o query params)
   */
  private handleNavigationState(): void {
    const state = this.router.getCurrentNavigation()?.extras.state as any;
    
    if (state?.songs && state?.query) {
      // Si viene del navbar con resultados precargados
      this._query.set(state.query);
      this._searchResults.set(state.songs);
      this.logger.info('Resultados precargados desde navbar', {
        query: state.query,
        count: state.songs.length,
      });
    } else {
      // Fallback: leer query params y ejecutar búsqueda
      this.route.queryParams
        .pipe(
          takeUntil(this.destroy$),
          distinctUntilChanged((prev, curr) => prev['q'] === curr['q'])
        )
        .subscribe(params => {
          const query = params['q'] || '';
          this._query.set(query);
          
          if (query.trim()) {
            this.performSearch(query);
          }
        });
    }
  }

  // =========================================================================
  // SEARCH
  // =========================================================================

  /**
   * Ejecuta la búsqueda
   */
  private performSearch(query: string): void {
    if (!query.trim()) {
      this._error.set('La búsqueda no puede estar vacía');
      return;
    }

    this.logger.info(`🔍 Ejecutando búsqueda: "${query}"`);
    this._error.set(null);

    this.searchService.search({ q: query, max_results: 20 }).subscribe({
      next: (results) => {
        this._searchResults.set(results);
        this.logger.info(`✅ ${results.length} resultados encontrados`);
      },
      error: (err) => {
        this.logger.error('❌ Error en búsqueda:', err);
        this._error.set(err.message || 'Error al buscar canciones');
        this._searchResults.set([]);
      },
    });
  }

  /**
   * Refresca la búsqueda actual
   */
  refreshSearch(): void {
    const query = this._query();
    if (query.trim()) {
      this.performSearch(query);
    }
  }

  // =========================================================================
  // PLAYBACK
  // =========================================================================

  /**
   * Reproduce una canción
   */
  playSong(song: Song, index: number, songs: Song[]): void {
    if (!song?.id) {
      this.logger.error('Canción sin ID válido:', song);
      this._error.set('No se puede reproducir esta canción');
      return;
    }

    this.logger.info(`▶️ Reproduciendo: ${song.title} (${song.id})`);
    this._error.set(null);

    const playlist = Array.isArray(songs) && songs.length > 0 ? songs : [song];
    const startIndex = Math.max(0, Math.min(index, playlist.length - 1));

    this.queueService.setQueue(playlist, startIndex);

    // Reproducir con PlayerService
    this.playerService.loadAndPlay(song.id, { autoplay: true }).subscribe({
      next: () => {
        this.logger.info('✅ Canción cargada correctamente');
      },
      error: (err) => {
        this.logger.error('❌ Error reproduciendo canción:', err);
        this._error.set('Error al reproducir la canción');
      },
    });
  }

  // =========================================================================
  // UI HELPERS
  // =========================================================================

  /**
   * Limpia el mensaje de error
   */
  clearError(): void {
    this._error.set(null);
  }

  /**
   * TrackBy para optimizar renderizado
   */
  trackBySongId(index: number, song: Song): string {
    return song.id || index.toString();
  }

  /**
   * Mensaje de estado vacío
   */
  getEmptyStateMessage(): string {
    if (this._error()) {
      return 'Ocurrió un error al buscar';
    }
    return 'No se encontraron resultados';
  }

  /**
   * Subtítulo de estado vacío
   */
  getEmptyStateSubtitle(): string {
    if (this._error()) {
      return 'Intenta con otros términos de búsqueda';
    }
    return `No hay resultados para "${this._query()}"`;
  }
}
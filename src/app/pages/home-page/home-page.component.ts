import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { 
  PlayerService, 
  SearchService,
  QueueService,
  LoggerService 
} from '@services';
import { Song } from '@interfaces';
import { SongCardComponent } from '../../components/song-card/song-card.component';

/**
 * Home Page Component - Página principal con contenido destacado
 * 
 * Features:
 * - Carrusel horizontal de canciones
 * - Secciones: Trending, Reciente, Recomendaciones
 * - Navegación con botones
 * - Reproducción directa
 */
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SongCardComponent],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
})
export class HomePageComponent implements OnInit, OnDestroy {
  private readonly playerService = inject(PlayerService);
  private readonly searchService = inject(SearchService);
  private readonly queueService = inject(QueueService);
  private readonly logger = inject(LoggerService);
  
  private readonly destroy$ = new Subject<void>();

  // ViewChild para scroll horizontal
  @ViewChild('trendingRow') trendingRow!: ElementRef;
  @ViewChild('recentRow') recentRow!: ElementRef;

  // =========================================================================
  // STATE SIGNALS
  // =========================================================================

  private readonly _trendingSongs = signal<Song[]>([]);
  private readonly _recentSongs = signal<Song[]>([]);
  private readonly _error = signal<string | null>(null);
  private readonly _isLoading = signal<boolean>(false);

  // Scroll states
  private readonly _isAtStartTrending = signal(true);
  private readonly _isAtEndTrending = signal(false);
  private readonly _isAtStartRecent = signal(true);
  private readonly _isAtEndRecent = signal(false);

  readonly error = this._error.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isAtStartTrending = this._isAtStartTrending.asReadonly();
  readonly isAtEndTrending = this._isAtEndTrending.asReadonly();
  readonly isAtStartRecent = this._isAtStartRecent.asReadonly();
  readonly isAtEndRecent = this._isAtEndRecent.asReadonly();

  // =========================================================================
  // COMPUTED SIGNALS
  // =========================================================================

  /**
   * Canciones trending (filtradas)
   */
  readonly trendingSongs = this._trendingSongs.asReadonly();

  /**
   * Canciones recientes (del historial)
   */
  readonly recentSongs = computed(() => {
    // Usar el historial del QueueService
    const history = this.queueService.history();
    return [...history].reverse().slice(0, 20); // Últimas 20
  });

  /**
   * Indica si hay contenido para mostrar
   */
  readonly hasContent = computed(() => {
    return this._trendingSongs().length > 0 || this.recentSongs().length > 0;
  });

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.logger.info('HomePageComponent initialized');
    this.loadInitialContent();
    
    // Setup scroll listeners después de que se rendericen los elementos
    setTimeout(() => this.setupScrollListeners(), 500);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================================
  // DATA LOADING
  // =========================================================================

  /**
   * Carga contenido inicial (trending music)
   */
  private loadInitialContent(): void {
    this._isLoading.set(true);
    this._error.set(null);

    // Buscar música trending
    this.searchService.quickSearch('trending music 2024', 20).subscribe({
      next: (results) => {
        this._trendingSongs.set(results);
        this._isLoading.set(false);
        this.logger.info(`✅ ${results.length} canciones trending cargadas`);
      },
      error: (err) => {
        this.logger.error('❌ Error cargando contenido inicial:', err);
        this._error.set('Error al cargar el contenido');
        this._isLoading.set(false);
      },
    });
  }

  /**
   * Recarga el contenido
   */
  refreshContent(): void {
    this.loadInitialContent();
  }

  // =========================================================================
  // PLAYBACK
  // =========================================================================

  /**
   * Reproduce una canción
   */
  onSongSelected(song: Song): void {
    if (!song?.id) {
      this.logger.error('Canción sin ID válido:', song);
      this._error.set('No se puede reproducir esta canción');
      return;
    }

    this.logger.info(`▶️ Reproduciendo: ${song.title}`);
    this._error.set(null);

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
  // SCROLL CONTROLS
  // =========================================================================

  /**
   * Scroll horizontal - Trending
   */
  scrollLeftTrending(): void {
    if (this.trendingRow?.nativeElement) {
      this.trendingRow.nativeElement.scrollLeft -= 300;
      setTimeout(() => this.updateScrollState('trending'), 300);
    }
  }

  scrollRightTrending(): void {
    if (this.trendingRow?.nativeElement) {
      this.trendingRow.nativeElement.scrollLeft += 300;
      setTimeout(() => this.updateScrollState('trending'), 300);
    }
  }

  /**
   * Scroll horizontal - Recent
   */
  scrollLeftRecent(): void {
    if (this.recentRow?.nativeElement) {
      this.recentRow.nativeElement.scrollLeft -= 300;
      setTimeout(() => this.updateScrollState('recent'), 300);
    }
  }

  scrollRightRecent(): void {
    if (this.recentRow?.nativeElement) {
      this.recentRow.nativeElement.scrollLeft += 300;
      setTimeout(() => this.updateScrollState('recent'), 300);
    }
  }

  /**
   * Configura listeners de scroll
   */
  private setupScrollListeners(): void {
    if (this.trendingRow?.nativeElement) {
      this.trendingRow.nativeElement.addEventListener('scroll', () => {
        this.updateScrollState('trending');
      });
      this.updateScrollState('trending');
    }

    if (this.recentRow?.nativeElement) {
      this.recentRow.nativeElement.addEventListener('scroll', () => {
        this.updateScrollState('recent');
      });
      this.updateScrollState('recent');
    }
  }

  /**
   * Actualiza el estado de los botones de scroll
   */
  private updateScrollState(type: 'trending' | 'recent'): void {
    const element = type === 'trending' 
      ? this.trendingRow?.nativeElement 
      : this.recentRow?.nativeElement;

    if (!element) return;

    const isAtStart = element.scrollLeft <= 1;
    const isAtEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;

    if (type === 'trending') {
      this._isAtStartTrending.set(isAtStart);
      this._isAtEndTrending.set(isAtEnd);
    } else {
      this._isAtStartRecent.set(isAtStart);
      this._isAtEndRecent.set(isAtEnd);
    }
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
}
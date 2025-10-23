import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  signal,
  computed,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { 
  LoggerService, 
  PlayerService, 
  SearchService, 
  LibraryService 
} from '@services';
import { Song } from '@interfaces';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { PlayerComponent } from '../player/player.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    NavbarComponent,
    PlayerComponent,
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit, OnDestroy {
  private readonly playerService = inject(PlayerService);
  private readonly searchService = inject(SearchService);
  private readonly libraryService = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly destroy$ = new Subject<void>();
  private readonly isBrowser: boolean;

  // =========================================================================
  // SIDEBAR STATE
  // =========================================================================

  readonly isSidebarOpen = signal(false);
  readonly isSidebarCollapsed = signal(false);
  readonly isMobile = signal(false);

  // =========================================================================
  // SCROLL STATE
  // =========================================================================

  readonly isScrolled = signal(false);

  // =========================================================================
  // PLAYER STATE
  // =========================================================================

  readonly currentSong = signal<Song | null>(null);
  readonly isPlayerVisible = computed(() => !!this.currentSong());

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      this.logger.warn('Layout: SSR mode, some features disabled');
      return;
    }

    this.checkMobile();
    this.loadSidebarState();
    this.subscribeToPlayerState();
    this.initializePlayer();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================================
  // HOST LISTENERS
  // =========================================================================

  @HostListener('window:resize')
  onResize(): void {
    if (!this.isBrowser) return;
    this.checkMobile();
    
    // Si cambiamos de mobile a desktop, cerrar el sidebar overlay
    if (!this.isMobile() && this.isSidebarOpen()) {
      this.isSidebarOpen.set(false);
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.isBrowser) return;
    this.isScrolled.set(window.scrollY > 20);
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  private checkMobile(): void {
    if (!this.isBrowser) return;
    const isMobileView = window.innerWidth <= 768;
    this.isMobile.set(isMobileView);
  }

  private loadSidebarState(): void {
    if (!this.isBrowser) return;

    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved !== null && !this.isMobile()) {
        this.isSidebarCollapsed.set(saved === 'true');
      }
    } catch (error) {
      this.logger.error('Error cargando estado del sidebar', error);
    }
  }

  private saveSidebarState(): void {
    if (!this.isBrowser) return;

    try {
      localStorage.setItem('sidebar-collapsed', String(this.isSidebarCollapsed()));
    } catch (error) {
      this.logger.error('Error guardando estado del sidebar', error);
    }
  }

  private subscribeToPlayerState(): void {
    this.playerService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.currentSong.set(state.currentSong);
      });
  }

  private initializePlayer(): void {
    this.logger.info('Inicializando player en layout');

    this.playerService.init('yt-player', {
      height: '0',
      width: '0',
      playerVars: {
        autoplay: 0,
        controls: 0,
        fs: 0,
        modestbranding: 1,
        rel: 0,
      },
    }).subscribe({
      next: () => {
        this.logger.info('Player inicializado correctamente en layout');
      },
      error: (err) => {
        this.logger.error('Error inicializando player en layout', err);
      }
    });
  }

  // =========================================================================
  // SIDEBAR CONTROL
  // =========================================================================

  onToggleSidebar(): void {
    if (this.isMobile()) {
      // Móvil: toggle open/close (overlay)
      this.isSidebarOpen.update(open => !open);
    } else {
      // Desktop: toggle collapsed/expanded
      this.isSidebarCollapsed.update(collapsed => !collapsed);
      this.saveSidebarState();
    }
  }

  onCloseSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  // =========================================================================
  // PLAYER CONTROL
  // =========================================================================

  closePlayer(): void {
    this.playerService.pause();
    this.playerService.clearCurrentSong();
    this.currentSong.set(null);
    this.logger.debug('Player cerrado desde layout');
  }

  // =========================================================================
  // SEARCH HANDLING
  // =========================================================================

  onSearch(event: { query: string; tab: string }): void {
    const { query, tab } = event;
    
    if (!query.trim()) {
      this.logger.warn('Búsqueda vacía');
      return;
    }

    this.logger.info('Búsqueda iniciada', { query, tab });

    // Cerrar sidebar en mobile después de buscar
    if (this.isMobile()) {
      this.onCloseSidebar();
    }

    if (tab === 'library') {
      this.searchInLibrary(query);
    } else {
      this.searchInYoutube(query);
    }
  }

  private searchInYoutube(query: string): void {
    this.searchService.search({
      q: query,
      max_results: 20,
      region_code: 'AR'
    }).subscribe({
      next: (results) => {
        this.logger.info('Resultados de búsqueda', { count: results.length });
        
        this.router.navigate(['/search'], {
          queryParams: { q: query, tab: 'youtube' },
          state: { 
            query, 
            tab: 'youtube', 
            results 
          }
        });
      },
      error: (err) => {
        this.logger.error('Error en búsqueda de YouTube', err);
      }
    });
  }

  private searchInLibrary(query: string): void {
    this.libraryService.getLibrary().subscribe({
      next: (items) => {
        const filteredItems = items.filter(item => {
          const song = item.song;
          if (!song) return false;

          const searchTerm = query.toLowerCase();
          return (
            song.title.toLowerCase().includes(searchTerm) ||
            song.channel_title?.toLowerCase().includes(searchTerm)
          );
        });

        const results = filteredItems.map(item => item.song!);

        this.logger.info('Resultados en biblioteca', { count: results.length });

        this.router.navigate(['/search'], {
          queryParams: { q: query, tab: 'library' },
          state: { 
            query, 
            tab: 'library', 
            results 
          }
        });
      },
      error: (err) => {
        this.logger.error('Error buscando en biblioteca', err);
      }
    });
  }

  // =========================================================================
  // PUBLIC API (para otros componentes)
  // =========================================================================

  playSong(song: Song): void {
    this.logger.info('Reproduciendo canción desde layout', { title: song.title });
    
    this.playerService.loadAndPlay(song.id, { 
      autoplay: true 
    }).subscribe({
      next: () => {
        this.logger.debug('Canción cargada exitosamente');
      },
      error: (err) => {
        this.logger.error('Error cargando canción', err);
      }
    });
  }
}
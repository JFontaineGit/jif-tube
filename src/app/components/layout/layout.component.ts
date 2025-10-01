import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  signal,
  computed,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { LoggerService } from '../../services/core/logger.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { PlayerComponent } from '../player/player.component';
import { PlayerService } from '../../services/player.service';
import { ThemeService } from '../../services/theme.service';
import { YoutubeService } from '../../services/youtube.service';
import { LibraryService } from '../../services/library.service';
import { Song } from '../../models/song.model';

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
  @ViewChild(PlayerComponent) playerComponent?: PlayerComponent;

  private destroy$ = new Subject<void>();
  private isBrowser: boolean;

  // Sidebar states
  isSidebarOpen = signal(false);
  isSidebarCollapsed = signal(false);
  isMobile = signal(false);

  // Scroll state
  isScrolled = signal(false);

  // Player state
  currentSong = signal<Song | null>(null);
  isPlayerVisible = computed(() => !!this.currentSong());

  constructor(
    private playerService: PlayerService,
    private themeService: ThemeService,
    private youtubeService: YoutubeService,
    private libraryService: LibraryService,
    private router: Router,
    private logger: LoggerService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    this.checkMobile();
    this.initializeSidebarState();
    this.subscribeToPlayerState();
    this.initializePlayer();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.themeService.destroy();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.isBrowser) return;
    this.checkMobile();
    this.initializeSidebarState();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.isBrowser) return;
    this.isScrolled.set(window.scrollY > 20);
  }

  private checkMobile(): void {
    if (!this.isBrowser) return;
    this.isMobile.set(window.innerWidth <= 768);
  }

  private initializeSidebarState(): void {
    if (this.isMobile()) {
      // En móvil: sidebar cerrada por defecto
      this.isSidebarOpen.set(false);
      this.isSidebarCollapsed.set(false);
    } else {
      // En desktop: sidebar expandida por defecto
      this.isSidebarOpen.set(true);
      this.isSidebarCollapsed.set(false);
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
      next: () => this.logger.info('Player inicializado en layout'),
      error: (err) => this.logger.error('Error inicializando player:', err),
    });
  }

  onToggleSidebar(): void {
    if (this.isMobile()) {
      // En móvil: toggle open/close
      this.isSidebarOpen.update(open => !open);
    } else {
      // En desktop: toggle collapsed/expanded
      this.isSidebarCollapsed.update(collapsed => !collapsed);
      this.isSidebarOpen.set(true);
    }
  }

  onCloseSidebar(): void {
    if (this.isMobile()) {
      this.isSidebarOpen.set(false);
    }
  }

  closePlayer(): void {
    this.playerService.pause();
    this.playerService.clearCurrentSong();
    this.currentSong.set(null);
  }

  onSearch(event: { query: string; tab: string }): void {
    const { query, tab } = event;
    if (!query.trim()) return;

    const handleSearchResults = (songs: Song[]) => {
      this.router.navigate(['/search'], {
        queryParams: { q: query, tab },
        state: { query, tab, songs },
      });
    };

    if (tab === 'library') {
      this.libraryService
        .searchInLibrary(query)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: handleSearchResults,
          error: (err) => console.error('Error en búsqueda de biblioteca:', err),
        });
    } else {
      this.youtubeService
        .searchVideos(query)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: handleSearchResults,
          error: (err) => console.error('Error en búsqueda de YouTube:', err),
        });
    }
  }

  playSong(song: Song): void {
    if (this.playerComponent) {
      this.playerComponent.loadSong(song);
    } else {
      console.warn('PlayerComponent no disponible aún');
    }
  }
}

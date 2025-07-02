import {
  Component,
  OnInit,
  Inject,
  PLATFORM_ID,
  OnDestroy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { PlayerComponent } from '../player/player/player.component';
import { YoutubePlayerService } from '../../services/youtube-iframe.service';
import { ThemeService } from '../../services/theme.service';
import { Song } from '../../models/song.model';
import { YoutubeService } from '../../services/youtube.service';
import { LibraryService } from '../../services/library.service';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NavbarComponent, PlayerComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit, OnDestroy {
  isPlayerVisible = false;
  currentSong: Song | null = null;
  dominantColor: string = 'rgb(30, 41, 59)';
  private destroy$ = new Subject<void>();

  constructor(
    private youtubePlayerService: YoutubePlayerService,
    private themeService: ThemeService,
    private youtubeService: YoutubeService,
    private libraryService: LibraryService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.youtubePlayerService.currentSong$
      .pipe(takeUntil(this.destroy$))
      .subscribe((song: Song | null) => {
        this.currentSong = song;
        this.isPlayerVisible = !!song;
        if (song?.thumbnailUrl) {
          this.themeService.updateThemeFromImage(song.thumbnailUrl, song);
        } else {
          this.themeService.setDefaultTheme();
        }
      });

    this.themeService.dominantColor$
      .pipe(takeUntil(this.destroy$))
      .subscribe(color => {
        this.dominantColor = color;
      });

    if (!this.youtubePlayerService.isPlayerReady()) {
      this.youtubePlayerService.initializePlayer('youtube-player', {
        height: '1',
        width: '1',
        playerVars: { autoplay: 0, controls: 0 },
      }).subscribe({
        error: (err) => console.error('Error al inicializar el reproductor en Layout:', err),
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  closePlayer(): void {
    this.youtubePlayerService.stopVideo();
    this.youtubePlayerService.clearCurrentSong(); // Usa el nuevo método
    this.isPlayerVisible = false;
  }

  onSearch(event: { query: string; tab: string }): void {
    const { query, tab } = event;
    if (!query.trim()) return;

    const navigateToSearch = (songs: Song[]) => {
      this.router.navigate(['/search'], {
        queryParams: { q: query, tab: tab },
        state: { query, tab, songs }
      });
    };

    if (tab === 'library') {
      this.libraryService.searchInLibrary(query).subscribe(navigateToSearch);
    } else {
      this.youtubeService.searchVideos(query).subscribe(navigateToSearch);
    }
  }
}
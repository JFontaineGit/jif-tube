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
import { PlayerService } from '../../services/player.service';
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
    private playerService: PlayerService,
    private themeService: ThemeService,
    private youtubeService: YoutubeService,
    private libraryService: LibraryService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.playerService.selectedSong$
      .pipe(takeUntil(this.destroy$))
      .subscribe((song: Song | null) => {
        this.currentSong = song;
        this.isPlayerVisible = !!song;
        if (song?.thumbnailUrl) {
          this.themeService.updateThemeFromImage(song.thumbnailUrl, song);
        }
      });

    this.themeService.dominantColor$
      .pipe(takeUntil(this.destroy$))
      .subscribe(color => {
        this.dominantColor = color;
        // Ya no seteamos nada directamente acá
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  closePlayer(): void {
    this.playerService.setSelectedSong(null);
  }

  onSearch(event: { query: string; tab: string }): void {
    const { query, tab } = event;
    if (!query.trim()) return;

    const navigateToSearch = (songs: Song[]) => {
      this.router.navigate(['/search'], { state: { query, tab, songs } });
    };

    if (tab === 'library') {
      this.libraryService.searchInLibrary(query).subscribe(navigateToSearch);
    } else {
      this.youtubeService.searchVideos(query).subscribe(navigateToSearch);
    }
  }
}

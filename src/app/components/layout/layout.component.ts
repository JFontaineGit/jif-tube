import { Component, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SearchButtonComponent } from '../search-button/search-button.component';
import { PlayerComponent } from '../player/player/player.component';
import { PlayerService } from '../../services/player.service';
import { ThemeService } from '../../services/theme.service';
import { Song } from '../../models/song.model';
import { YoutubeService } from '../../services/youtube.service';
import { LibraryService } from '../../services/library.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, SearchButtonComponent, PlayerComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit {
  isPlayerVisible = false;
  currentSong: Song | null = null;
  dominantColor: string = 'rgb(30, 41, 59)';

  constructor(
    private playerService: PlayerService,
    private themeService: ThemeService,
    private youtubeService: YoutubeService,
    private libraryService: LibraryService,
    private router: Router,
    private elRef: ElementRef
  ) {}

  ngOnInit() {
    this.playerService.selectedSong$.subscribe((song: Song | null) => {
      this.currentSong = song;
      this.isPlayerVisible = !!song;
      if (song && song.thumbnailUrl) {
        this.themeService.updateThemeFromImage(song.thumbnailUrl);
      }
    });

    this.themeService.dominantColor$.subscribe(color => {
      this.dominantColor = color;
    });

    this.themeService.gradient$.subscribe(({ start, end }) => {
      const root = this.elRef.nativeElement as HTMLElement;
      root.style.setProperty('--gradient-start', start);
      root.style.setProperty('--gradient-end', end);
    });
  }

  closePlayer(): void {
    this.playerService.setSelectedSong(null);
  }

  onSearch(event: { query: string; tab: string }): void {
    const { query, tab } = event;
    if (query.trim()) {
      if (tab === 'library') {
        this.libraryService.searchInLibrary(query).subscribe(songs => {
          this.router.navigate(['/search'], { state: { query, tab, songs } });
        });
      } else {
        this.youtubeService.searchVideos(query).subscribe(songs => {
          this.router.navigate(['/search'], { state: { query, tab, songs } });
        });
      }
    }
  }
}
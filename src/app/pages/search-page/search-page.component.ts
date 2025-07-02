import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Song } from '../../models/song.model';
import { YoutubePlayerService } from '../../services/youtube-iframe.service';
import { LibraryService } from '../../services/library.service';
import { YoutubeService } from '../../services/youtube.service';
import { LoggerService } from '../../services/core/logger.service';
import { Router, ActivatedRoute } from '@angular/router';
import { map, Observable, Subject, takeUntil } from 'rxjs';
import { SongCardComponent } from '../../components/song-card/song-card.component';
import { ThemeService } from '../../services/theme.service';

interface RouterState {
  query?: string;
  tab?: string;
  songs?: Song[];
}

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SongCardComponent],
  templateUrl: './search-page.component.html',
  styleUrls: ['./search-page.component.scss'],
})
export class SearchPageComponent implements OnInit, OnDestroy {
  private youtubePlayerService = inject(YoutubePlayerService);
  private libraryService = inject(LibraryService);
  private youtubeService = inject(YoutubeService);
  private logger = inject(LoggerService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  query: string = '';
  tab: string = 'all';
  songs: Song[] = [];
  bestResult: Song | null = null;
  filteredSongs: Song[] = [];
  savedSongs$!: Observable<Song[]>;
  private savedSongsCache: { [key: string]: boolean } = {};

  ngOnInit(): void {
    this.savedSongs$ = this.libraryService.getSavedSongs().pipe(
      takeUntil(this.destroy$),
      map(savedSongs => {
        this.savedSongsCache = {};
        savedSongs.forEach(song => {
          this.savedSongsCache[song.id] = true;
        });
        return savedSongs;
      })
    );

    this.youtubePlayerService.playerState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((state) => {
      if (state === 'error') {
        this.logger.error('Error en el reproductor de YouTube desde SearchPage');
      }
    });

    const state = this.router.getCurrentNavigation()?.extras.state as RouterState;
    if (state) {
      this.query = state.query || '';
      this.tab = state.tab || 'all';
      this.songs = state.songs || [];
      this.setBestResult();
      this.filterSongs();
    } else {
      this.route.queryParams.pipe(
        takeUntil(this.destroy$)
      ).subscribe(params => {
        this.query = params['q'] || '';
        this.tab = params['tab'] || 'all';
        if (this.query.trim()) {
          const navigateToSearch = (songs: Song[]) => {
            this.logger.info(`Navegando a búsqueda con query: ${this.query}, tab: ${this.tab}`);
            this.songs = songs;
            this.setBestResult();
            this.filterSongs();
            this.cdr.detectChanges();
          };
          if (this.tab === 'library') {
            this.libraryService.searchInLibrary(this.query).pipe(
              takeUntil(this.destroy$)
            ).subscribe(navigateToSearch);
          } else {
            this.youtubeService.searchVideos(this.query).pipe(
              takeUntil(this.destroy$)
            ).subscribe(navigateToSearch);
          }
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setBestResult(): void {
    if (this.songs.length > 0) {
      this.bestResult = this.songs[0];
    } else {
      this.bestResult = null;
    }
  }

  filterSongs(): void {
    if (this.tab === 'library') {
      this.libraryService.searchInLibrary(this.query).pipe(
        takeUntil(this.destroy$)
      ).subscribe(songs => {
        this.filteredSongs = songs;
        this.cdr.detectChanges();
      });
    } else {
      this.filteredSongs = this.songs;
      this.cdr.detectChanges();
    }
  }

  playSong(song: Song): void {
    if (!song?.videoId) {
      this.logger.error(`Canción sin videoId válido: ${song?.title || 'canción desconocida'}`);
      return;
    }

    this.logger.info(`Reproduciendo canción: ${song.title} (${song.videoId})`);
    this.youtubePlayerService.playVideo(song.videoId, undefined, song);

    if (song.thumbnailUrl) {
      this.themeService.updateThemeFromImage(song.thumbnailUrl, { artist: song.artist, type: song.type });
    }
  }

  saveSong(song: Song): void {
    this.libraryService.saveSong(song).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.logger.info(`Canción guardada: ${song.title}`);
        this.savedSongs$ = this.libraryService.getSavedSongs();
        this.cdr.detectChanges();
      },
      error: (err) => this.logger.error('Error al guardar la canción', err),
    });
  }

  isSongSaved(song: Song): boolean {
    return !!this.savedSongsCache[song.id];
  }
}
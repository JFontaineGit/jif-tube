import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song } from '../../models/song.model';
import { PlayerService } from '../../services/player.service';
import { LibraryService } from '../../services/library.service';
import { YoutubeService } from '../../services/youtube.service';
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
  imports: [SongCardComponent, CommonModule], 
  templateUrl: './search-page.component.html',
  styleUrls: ['./search-page.component.scss'],
})
export class SearchPageComponent implements OnInit, OnDestroy {
  query: string = '';
  tab: string = 'all';
  songs: Song[] = [];
  bestResult: Song | null = null;
  filteredSongs: Song[] = [];
  savedSongs$!: Observable<Song[]>;
  private savedSongsCache: { [key: string]: boolean } = {};
  private destroy$ = new Subject<void>();

  constructor(
    private playerService: PlayerService,
    private libraryService: LibraryService,
    private youtubeService: YoutubeService,
    private themeService: ThemeService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

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
    const state = this.router.getCurrentNavigation()?.extras.state as RouterState;
    if (state) {
      this.query = state.query || '';
      this.tab = state.tab || 'all';
      this.songs = state.songs || [];
      this.setBestResult();
      this.filterSongs();
    } else {
      this.route.queryParams.subscribe(params => {
        this.query = params['q'] || '';
        this.tab = params['tab'] || 'all';
        if (this.query.trim()) {
          const navigateToSearch = (songs: Song[]) => {
            console.log('Navigating to search with query:', this.query, 'and tab:', this.tab);
            this.songs = songs;
            this.setBestResult();
            this.filterSongs();
          };
          if (this.tab === 'library') {
            this.libraryService.searchInLibrary(this.query).subscribe(navigateToSearch);
          } else {
            this.youtubeService.searchVideos(this.query).subscribe(navigateToSearch);
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
      this.libraryService.searchInLibrary(this.query).subscribe(songs => {
        this.filteredSongs = songs;
      });
    } else {
      this.filteredSongs = this.songs;
    }
  }

  playSong(song: Song): void {
    this.playerService.setSelectedSong(song);
  }

  saveSong(song: Song): void {
    this.libraryService.saveSong(song).subscribe(() => {
      this.savedSongs$ = this.libraryService.getSavedSongs();
    });
  }

  isSongSaved(song: Song): boolean {
    return !!this.savedSongsCache[song.id];
  }
}
// search-page.component.ts
import { Component, OnInit } from '@angular/core';
import { Song } from '../../models/song.model';
import { PlayerService } from '../../services/player.service';
import { LibraryService } from '../../services/library.service';
import { YoutubeService } from '../../services/youtube.service';
import { Router, ActivatedRoute } from '@angular/router';
import { map, Observable, of } from 'rxjs';
import { SongCardComponent } from '../../components/song-card/song-card.component'; 

// Interfaz para tipar el estado del router
interface RouterState {
  query?: string;
  tab?: string;
  songs?: Song[];
}

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [SongCardComponent], 
  templateUrl: './search-page.component.html',
  styleUrls: ['./search-page.component.scss'],
})
export class SearchPageComponent implements OnInit {
  query: string = '';
  tab: string = 'all';
  songs: Song[] = [];
  bestResult: Song | null = null;
  filteredSongs: Song[] = [];
  savedSongs$!: Observable<Song[]>;

  constructor(
    private playerService: PlayerService,
    private libraryService: LibraryService,
    private youtubeService: YoutubeService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.savedSongs$ = this.libraryService.getSavedSongs();
    // Recuperar state de la navegación
    const state = this.router.getCurrentNavigation()?.extras.state as RouterState;
    if (state) {
      this.query = state.query || '';
      this.tab = state.tab || 'all';
      this.songs = state.songs || [];
      this.setBestResult();
      this.filterSongs();
    } else {
      // Manejar recarga: recuperar query y tab de parámetros de URL
      this.route.queryParams.subscribe(params => {
        this.query = params['q'] || '';
        this.tab = params['tab'] || 'all';
        if (this.query.trim()) {
          const navigateToSearch = (songs: Song[]) => {
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

  setBestResult(): void {
    if (this.songs.length > 0) {
      this.bestResult = this.songs[0];
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

  isSongSaved(song: Song): Observable<boolean> {
    return this.savedSongs$.pipe(
      map(savedSongs => savedSongs.some(s => s.id === song.id))
    );
  }
}
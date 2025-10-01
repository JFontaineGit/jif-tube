import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { map, Observable, Subject, takeUntil, distinctUntilChanged } from 'rxjs';

import { Song } from '../../models/song.model';
import { PlayerService } from '../../services/player.service';
import { LibraryService } from '../../services/library.service';
import { YoutubeService } from '../../services/youtube.service';
import { LoggerService } from '../../services/core/logger.service';
import { SongCardComponent } from '../../components/song-card/song-card.component';

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
  private playerService = inject(PlayerService);
  private libraryService = inject(LibraryService);
  private youtubeService = inject(YoutubeService);
  private logger = inject(LoggerService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();

  // Signals para UI
  query = signal<string>('');
  tab = signal<string>('all');
  songs = signal<Song[]>([]);
  filteredSongs = signal<Song[]>([]);
  bestResult = computed(() => this.songs().length > 0 ? this.songs()[0] : null);
  error = signal<string | null>(null);
  isLoading = signal<boolean>(false);

  // Cache de canciones guardadas
  private savedSongsCache = signal<{ [key: string]: boolean }>({});
  savedSongs$!: Observable<Song[]>;

  ngOnInit(): void {
    this.setupSavedSongs();
    this.setupPlayerStateListener();
    this.handleNavigationState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Configura el observable de canciones guardadas y actualiza el cache
   */
  private setupSavedSongs(): void {
    this.savedSongs$ = this.libraryService.getSavedSongs().pipe(
      takeUntil(this.destroy$),
      map(savedSongs => {
        const cache: { [key: string]: boolean } = {};
        savedSongs.forEach(song => { cache[song.id] = true; });
        this.savedSongsCache.set(cache);
        return savedSongs;
      })
    );
  }

  /**
   * Escucha errores del player para mostrar feedback
   */
  private setupPlayerStateListener(): void {
    this.playerService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        if (state.error) {
          this.logger.error('Error en el reproductor:', state.error);
          this.error.set(`Error en reproductor: ${state.error}`);
        }
      });
  }

  /**
   * Maneja el estado de navegación (router state o query params)
   */
  private handleNavigationState(): void {
    const state = this.router.getCurrentNavigation()?.extras.state as RouterState;
    
    if (state?.songs) {
      // Si viene del navbar con resultados precargados
      this.query.set(state.query || '');
      this.tab.set(state.tab || 'all');
      this.songs.set(state.songs);
      this.filterSongs();
    } else {
      // Fallback: leer query params y ejecutar búsqueda
      this.route.queryParams
        .pipe(
          takeUntil(this.destroy$),
          distinctUntilChanged((prev, curr) => 
            prev['q'] === curr['q'] && prev['tab'] === curr['tab']
          )
        )
        .subscribe(params => {
          this.query.set(params['q'] || '');
          this.tab.set(params['tab'] || 'all');
          
          if (this.query().trim()) {
            this.performSearch();
          }
        });
    }
  }

  /**
   * Ejecuta la búsqueda según el tab activo
   */
  private performSearch(): void {
    const searchQuery = this.query();
    const currentTab = this.tab();

    if (!searchQuery.trim()) {
      this.error.set('La búsqueda no puede estar vacía');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const handleResults = (songs: Song[]) => {
      this.logger.info(`Búsqueda ejecutada: "${searchQuery}", tab: ${currentTab}, resultados: ${songs.length}`);
      this.songs.set(songs);
      this.filterSongs();
      this.isLoading.set(false);
    };

    const handleError = (err: any) => {
      const errorMsg = currentTab === 'library' 
        ? 'Error al buscar en la biblioteca' 
        : 'Error al buscar videos en YouTube';
      this.error.set(errorMsg);
      this.logger.error(errorMsg, err);
      this.isLoading.set(false);
    };

    if (currentTab === 'library') {
      this.libraryService.searchInLibrary(searchQuery)
        .pipe(takeUntil(this.destroy$))
        .subscribe({ next: handleResults, error: handleError });
    } else {
      this.youtubeService.searchVideos(searchQuery)
        .pipe(takeUntil(this.destroy$))
        .subscribe({ next: handleResults, error: handleError });
    }
  }

  /**
   * Filtra las canciones según el tab activo
   */
  private filterSongs(): void {
    const currentTab = this.tab();
    
    if (currentTab === 'library') {
      this.libraryService.searchInLibrary(this.query())
        .pipe(takeUntil(this.destroy$))
        .subscribe(songs => this.filteredSongs.set(songs));
    } else {
      this.filteredSongs.set(this.songs());
    }
  }

  /**
   * Reproduce una canción usando el nuevo PlayerService
   */
  playSong(song: Song): void {
    if (!song?.videoId) {
      this.logger.error(`Canción sin videoId válido: ${song?.title || 'desconocida'}`);
      this.error.set('No se puede reproducir: videoId inválido');
      return;
    }

    this.logger.info(`Reproduciendo: ${song.title} (${song.videoId})`);
    this.error.set(null);
    
    // Usa el nuevo PlayerService
    this.playerService.loadVideo(song.videoId, 0, song);
  }

  /**
   * Guarda una canción en la biblioteca
   */
  saveSong(song: Song): void {
    if (this.isSongSaved(song)) {
      this.logger.info(`Canción ya guardada: ${song.title}`);
      return;
    }

    this.libraryService.saveSong(song)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.logger.info(`Canción guardada: ${song.title}`);
          
          // Actualiza cache localmente
          const newCache = { ...this.savedSongsCache(), [song.id]: true };
          this.savedSongsCache.set(newCache);
          
          // Refresca lista de guardados
          this.savedSongs$ = this.libraryService.getSavedSongs();
        },
        error: (err) => {
          this.logger.error('Error al guardar la canción', err);
          this.error.set('Error al guardar la canción');
        },
      });
  }

  /**
   * Verifica si una canción está guardada
   */
  isSongSaved(song: Song): boolean {
    return !!this.savedSongsCache()[song.id];
  }

  /**
   * TrackBy para optimizar renderizado de lista
   */
  trackBySongId(index: number, song: Song): string {
    return song.id || index.toString();
  }
}
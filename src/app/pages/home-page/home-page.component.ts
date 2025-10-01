import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, switchMap, distinctUntilChanged } from 'rxjs';

import { Song } from '../../models/song.model';
import { PlayerService } from '../../services/player.service';
import { YoutubeService } from '../../services/youtube.service';
import { LoggerService } from '../../services/core/logger.service';
import { SongCardComponent } from '../../components/song-card/song-card.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SongCardComponent],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
})
export class HomePageComponent implements OnInit, OnDestroy {
  private playerService = inject(PlayerService);
  private youtubeService = inject(YoutubeService);
  private logger = inject(LoggerService);
  private destroy$ = new Subject<void>();

  @ViewChild('videosRow') videosRow!: ElementRef;
  @ViewChild('tracksRow') tracksRow!: ElementRef;

  searchQuery = '';

  // Signals para reactividad
  officialVideos = signal<Song[]>([]);
  albumTracks = signal<Song[]>([]);
  error = signal<string | null>(null);
  isLoading = signal<boolean>(false);

  // Estados de scroll (reactivos)
  isAtStartVideos = signal(true);
  isAtEndVideos = signal(false);
  isAtStartTracks = signal(true);
  isAtEndTracks = signal(false);

  ngOnInit(): void {
    this.loadInitialContent();
    this.setupScrollListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga contenido inicial basado en historial o trending
   */
  private loadInitialContent(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.youtubeService.getSearchHistory().pipe(
      takeUntil(this.destroy$),
      switchMap((history) => {
        const query = history.length > 0 ? history[0] : 'trending music';
        return this.youtubeService.searchVideos(query);
      })
    ).subscribe({
      next: (songs) => {
        this.officialVideos.set(songs.filter(s => s.type === 'official-video'));
        this.albumTracks.set(songs.filter(s => s.type === 'album-track'));
        this.error.set(null);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar contenido inicial');
        this.logger.error('Error cargando contenido inicial:', err);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Ejecuta búsqueda manual
   */
  onSearch(): void {
    if (!this.searchQuery.trim()) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.youtubeService.searchVideos(this.searchQuery).pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged((prev, curr) => prev.length === curr.length)
    ).subscribe({
      next: (songs) => {
        this.officialVideos.set(songs.filter(s => s.type === 'official-video'));
        this.albumTracks.set(songs.filter(s => s.type === 'album-track'));
        this.error.set(null);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Error al buscar canciones');
        this.logger.error('Error en búsqueda:', err);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Reproduce una canción usando PlayerService
   */
  onSongSelected(song: Song): void {
    if (!song?.videoId) {
      this.logger.error(`Canción sin videoId válido: ${song?.title || 'desconocida'}`);
      this.error.set('No se puede reproducir: videoId inválido');
      return;
    }

    this.logger.info(`Reproduciendo desde Home: ${song.title} (${song.videoId})`);
    this.error.set(null);
    
    // Usa el nuevo PlayerService (maneja ThemeService internamente)
    this.playerService.loadVideo(song.videoId, 0, song);
  }

  /**
   * TrackBy para optimizar renderizado
   */
  trackBySongId(index: number, song: Song): string {
    return song.id || index.toString();
  }

  /* ----------------------------
   * Scroll Controls
   * ---------------------------- */
  scrollLeftVideos(): void {
    this.videosRow.nativeElement.scrollLeft -= 300;
    setTimeout(() => this.updateScrollState('videos'), 300);
  }

  scrollRightVideos(): void {
    this.videosRow.nativeElement.scrollLeft += 300;
    setTimeout(() => this.updateScrollState('videos'), 300);
  }

  scrollLeftTracks(): void {
    this.tracksRow.nativeElement.scrollLeft -= 300;
    setTimeout(() => this.updateScrollState('tracks'), 300);
  }

  scrollRightTracks(): void {
    this.tracksRow.nativeElement.scrollLeft += 300;
    setTimeout(() => this.updateScrollState('tracks'), 300);
  }

  /**
   * Configura listeners para actualizar estado de scroll
   */
  private setupScrollListeners(): void {
    // Espera a que los ViewChild estén disponibles
    setTimeout(() => {
      if (this.videosRow?.nativeElement) {
        this.videosRow.nativeElement.addEventListener('scroll', () => {
          this.updateScrollState('videos');
        });
        this.updateScrollState('videos');
      }

      if (this.tracksRow?.nativeElement) {
        this.tracksRow.nativeElement.addEventListener('scroll', () => {
          this.updateScrollState('tracks');
        });
        this.updateScrollState('tracks');
      }
    }, 100);
  }

  /**
   * Actualiza estado de botones de scroll
   */
  private updateScrollState(type: 'videos' | 'tracks'): void {
    const element = type === 'videos' 
      ? this.videosRow?.nativeElement 
      : this.tracksRow?.nativeElement;

    if (!element) return;

    const isAtStart = element.scrollLeft <= 1;
    const isAtEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;

    if (type === 'videos') {
      this.isAtStartVideos.set(isAtStart);
      this.isAtEndVideos.set(isAtEnd);
    } else {
      this.isAtStartTracks.set(isAtStart);
      this.isAtEndTracks.set(isAtEnd);
    }
  }
}
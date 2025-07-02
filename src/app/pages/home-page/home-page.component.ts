import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Song } from '../../models/song.model';
import { YoutubePlayerService } from '../../services/youtube-iframe.service';
import { YoutubeService } from '../../services/youtube.service';
import { LoggerService } from '../../services/core/logger.service';
import { ThemeService } from '../../services/theme.service';
import { Subject, takeUntil,switchMap } from 'rxjs';
import { SongCardComponent } from '../../components/song-card/song-card.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SongCardComponent],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
})
export class HomePageComponent implements OnInit, OnDestroy {
  private youtubePlayerService = inject(YoutubePlayerService);
  private youtubeService = inject(YoutubeService);
  private logger = inject(LoggerService);
  private themeService = inject(ThemeService);
  private destroy$ = new Subject<void>();

  @ViewChild('videosRow') videosRow!: ElementRef;
  @ViewChild('tracksRow') tracksRow!: ElementRef;

  searchQuery: string = '';
  officialVideos: Song[] = [];
  albumTracks: Song[] = [];
  error: string | null = null;
  isAtStartVideos = true;
  isAtEndVideos = false;
  isAtStartTracks = true;
  isAtEndTracks = false;

  ngOnInit(): void {
    this.loadInitialContent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadInitialContent(): void {
    this.youtubeService.getSearchHistory().pipe(
      takeUntil(this.destroy$),
      switchMap((history) => {
        if (history.length > 0) {
          return this.youtubeService.searchVideos(history[0]);
        }
        return this.youtubeService.searchVideos('trending music');
      })
    ).subscribe({
      next: (songs) => {
        this.officialVideos = songs.filter(s => s.type === 'official-video');
        this.albumTracks = songs.filter(s => s.type === 'album-track');
        this.error = null;
      },
      error: (err) => {
        this.error = 'Error al cargar contenido inicial';
        this.logger.error(this.error, err);
      },
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) return;

    this.youtubeService.searchVideos(this.searchQuery).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (songs) => {
        this.officialVideos = songs.filter(s => s.type === 'official-video');
        this.albumTracks = songs.filter(s => s.type === 'album-track');
        this.error = null;
      },
      error: (err) => {
        this.error = 'Error al buscar canciones';
        this.logger.error(this.error, err);
      },
    });
  }

  onSongSelected(song: Song): void {
    if (!song?.videoId) {
      this.logger.error(`Canción sin videoId válido: ${song?.title || 'canción desconocida'}`);
      return;
    }

    this.logger.info(`Reproduciendo canción desde Home: ${song.title} (${song.videoId})`);
    this.youtubePlayerService.playVideo(song.videoId, undefined, song);

    if (song.thumbnailUrl) {
      this.themeService.updateThemeFromImage(song.thumbnailUrl, { artist: song.artist, type: song.type });
    }
  }

  scrollLeftVideos(): void {
    this.videosRow.nativeElement.scrollLeft -= 200;
    this.updateScrollState('videos');
  }

  scrollRightVideos(): void {
    this.videosRow.nativeElement.scrollLeft += 200;
    this.updateScrollState('videos');
  }

  scrollLeftTracks(): void {
    this.tracksRow.nativeElement.scrollLeft -= 200;
    this.updateScrollState('tracks');
  }

  scrollRightTracks(): void {
    this.tracksRow.nativeElement.scrollLeft += 200;
    this.updateScrollState('tracks');
  }

  private updateScrollState(type: 'videos' | 'tracks'): void {
    const element = type === 'videos' ? this.videosRow.nativeElement : this.tracksRow.nativeElement;
    this.isAtStartVideos = element.scrollLeft === 0;
    this.isAtEndVideos = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
    this.isAtStartTracks = element.scrollLeft === 0;
    this.isAtEndTracks = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
  }
}
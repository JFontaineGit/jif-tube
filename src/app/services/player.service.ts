import { Injectable, inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  BehaviorSubject,
  Subject,
  interval,
  map,
  takeUntil,
  Observable,
  throwError,
  Subscription,
  switchMap,
} from 'rxjs';
import { catchError, tap, filter } from 'rxjs/operators';
import { LoggerService } from './core/logger.service';
import { YoutubeService } from './youtube.service';
import { YoutubePlayerCoreService } from './youtube-player-core.service';
import { YoutubeApiLoaderService } from './youtube-api-loader.service';
import { Song } from '../models/song.model';
import { ThemeService } from './theme.service';

export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  videoId: string | null;
  volume: number;
  isMuted: boolean;
  error?: string | null;
  currentSong: Song | null;
}

@Injectable({ providedIn: 'root' })
export class PlayerService implements OnDestroy {
  private logger = inject(LoggerService);
  private youtubeService = inject(YoutubeService);
  private playerCore = inject(YoutubePlayerCoreService);
  private apiLoader = inject(YoutubeApiLoaderService);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private stateSubject = new BehaviorSubject<PlayerState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    videoId: null,
    volume: 100,
    isMuted: false,
    error: null,
    currentSong: null,
  });
  public state$ = this.stateSubject.asObservable();

  private pollingSub: Subscription | null = null;
  private destroy$ = new Subject<void>();

  constructor() {
    if (this.isBrowser) {
      this.apiLoader.apiReady$.pipe(
        filter(ready => ready),
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.logger.info('API lista, player facade ready');
      });
    }
  }

  public init(elementId: string, options: any = {}): Observable<void> {
    if (!this.isBrowser) {
      return throwError(() => new Error('Player no disponible en server'));
    }

    return this.playerCore.initializePlayer(elementId, options).pipe(
      tap(() => {
        this.startPolling();
        this.updateState({
          volume: this.playerCore.getVolume(),
          isMuted: this.playerCore.isMuted(),
        });
      }),
      map(() => void 0),
      catchError(err => {
        this.logger.error('Error inicializando player facade', err);
        this.updateState({ error: err.message });
        return throwError(() => err);
      })
    );
  }

  public play(): void {
    this.playerCore.playVideo();
    this.updateState({ playing: true, error: null });
  }

  public pause(): void {
    this.playerCore.pauseVideo();
    this.updateState({ playing: false });
  }

  public seek(seconds: number): void {
    this.playerCore.seekTo(seconds);
    this.updateState({ currentTime: seconds });
  }

  public setVolume(volume0to1: number): void {
    const volume0to100 = Math.round(Math.max(0, Math.min(1, volume0to1)) * 100);
    this.playerCore.setVolume(volume0to100);
    this.updateState({ volume: volume0to100 });
  }

  public setMuted(muted: boolean): void {
    if (muted) this.playerCore.mute();
    else this.playerCore.unMute();
    this.updateState({ isMuted: muted });
  }

  public loadVideo(videoId: string, startSeconds?: number, song?: Song): void {
    if (!videoId) return;

    if (!this.playerCore.getPlayer()) {
      this.init('youtube-player').subscribe({
        next: () => {
          this.loadVideoInternal(videoId, startSeconds, song);
        },
        error: (err) => {
          this.logger.error('Error inicializando player', err);
          this.updateState({ error: err.message });
        }
      });
      return;
    }

    this.loadVideoInternal(videoId, startSeconds, song);
  }

  private loadVideoInternal(videoId: string, startSeconds?: number, song?: Song): void {
    this.playerCore.loadVideoById(videoId, startSeconds);
    this.updateState({
      videoId,
      playing: false,
      currentTime: startSeconds ?? 0,
      currentSong: song ?? null,
      error: null,
    });

    if (song?.thumbnailUrl) {
      this.themeService.updateFromThumbnail(song.thumbnailUrl);
    }
  }

  public clearCurrentSong(): void {
    this.updateState({ currentSong: null });
    this.logger.info('Canción actual limpiada');
  }

  public searchAndPlay(query: string): Observable<string> {
    if (!query.trim()) {
      return throwError(() => new Error('Consulta de búsqueda vacía'));
    }

    if (!this.playerCore.getPlayer()) {
      return this.init('youtube-player').pipe(
        switchMap(() => this.searchAndPlay(query))
      );
    }

    return this.youtubeService.searchVideos(query).pipe(
      map((songs: Song[]) => {
        if (songs.length === 0) {
          throw new Error('No se encontraron canciones');
        }
        const bestSong = songs[0];
        if (!bestSong.videoId) {
          throw new Error('Canción sin videoId válido');
        }
        this.loadVideo(bestSong.videoId, undefined, bestSong);
        return bestSong.videoId;
      }),
      tap(videoId => this.logger.info(`Reproduciendo para "${query}": ${videoId}`)),
      catchError(error => {
        this.logger.error('Error en búsqueda y reproducción', error);
        this.updateState({ error: error.message });
        return throwError(() => error);
      })
    );
  }

  public getCurrentTime(): number {
    return this.playerCore.getCurrentTime();
  }

  public getDuration(): number {
    return this.playerCore.getDuration();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling();
    this.playerCore.destroyPlayer();
    this.updateState({ error: null });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollingSub = interval(1000).pipe(
      takeUntil(this.destroy$),
      map(() => ({
        currentTime: this.getCurrentTime(),
        duration: this.getDuration(),
      }))
    ).subscribe(({ currentTime, duration }) => {
      this.updateState({ currentTime, duration });
    });
  }

  private stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;
  }

  private updateState(partial: Partial<PlayerState>): void {
    const current = this.stateSubject.value;
    this.stateSubject.next({ ...current, ...partial });
  }
}
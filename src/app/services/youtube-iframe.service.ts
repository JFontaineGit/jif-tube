import { Injectable, inject, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { LoggerService } from './core/logger.service';
import { YoutubeService } from './youtube.service';
import { Song } from '../models/song.model';

const YT_IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
const DEFAULT_PLAYER_OPTIONS = {
  height: '360',
  width: '640',
  playerVars: {
    autoplay: 0,
    controls: 1,
  },
};

interface YTPlayer {
  loadVideoById(videoId: string, startSeconds?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
}

type YoutubeNamespace = {
  Player: new (elementId: string, options: any) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

declare global {
  interface Window {
    YT: YoutubeNamespace;
    onYouTubeIframeAPIReady: () => void;
  }
}

@Injectable({ providedIn: 'root' })
export class YoutubePlayerService {
  private logger = inject(LoggerService);
  private youtubeService = inject(YoutubeService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private player: YTPlayer | null = null;
  private apiReadySubject = new BehaviorSubject<boolean>(false);
  private playerStateSubject = new BehaviorSubject<'uninitialized' | 'ready' | 'error'>('uninitialized');
  private currentTimeSubject = new BehaviorSubject<number>(0);
  private durationSubject = new BehaviorSubject<number>(0);
  private isPlayingSubject = new BehaviorSubject<boolean>(false);
  private currentSongSubject = new BehaviorSubject<Song | null>(null);

  public apiReady$ = this.apiReadySubject.asObservable();
  public playerState$ = this.playerStateSubject.asObservable();
  public currentTime$ = this.currentTimeSubject.asObservable();
  public duration$ = this.durationSubject.asObservable();
  public isPlaying$ = this.isPlayingSubject.asObservable();
  public currentSong$ = this.currentSongSubject.asObservable();

  constructor() {
    if (this.isBrowser) {
      this.loadYoutubeIframeAPI();
    } else {
      this.logger.warn('Entorno no browser: no se carga YouTube Iframe API');
    }
  }

  public isPlayerReady(): boolean {
    return !!this.player && this.playerStateSubject.value === 'ready';
  }

  private loadYoutubeIframeAPI(): void {
    if (!this.isBrowser) return;

    if (this.getYT()) {
      this.logger.info('YouTube Iframe API ya cargada');
      this.apiReadySubject.next(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = YT_IFRAME_API_URL;
    tag.onload = () => {
      window.onYouTubeIframeAPIReady = () => {
        this.logger.info('YouTube Iframe API cargada y lista');
        this.apiReadySubject.next(true);
      };
    };
    tag.onerror = () => {
      this.logger.error('Error al cargar YouTube Iframe API');
      this.apiReadySubject.next(false);
      this.playerStateSubject.next('error');
    };
    document.body.appendChild(tag);
  }

  private getYT(): YoutubeNamespace | null {
    return this.isBrowser && window.YT ? window.YT : null;
  }

  public initializePlayer(elementId: string, options: any = {}): Observable<YTPlayer> {
    if (!this.isBrowser) {
      this.logger.error('No se puede inicializar el reproductor: entorno no browser');
      return throwError(() => new Error('No disponible en entorno server'));
    }

    const element = document.getElementById(elementId);
    if (!element) {
      this.logger.error(`Elemento DOM con id "${elementId}" no encontrado`);
      this.playerStateSubject.next('error');
      return throwError(() => new Error(`Elemento DOM "${elementId}" no encontrado`));
    }

    return this.apiReady$.pipe(
      filter((ready) => ready),
      switchMap(() => {
        const ytApi = this.getYT();
        if (!ytApi) {
          this.logger.error('YouTube Iframe API no disponible');
          this.playerStateSubject.next('error');
          return throwError(() => new Error('YouTube Iframe API no disponible'));
        }

        return new Observable<YTPlayer>((observer) => {
          this.player = new ytApi.Player(elementId, {
            ...DEFAULT_PLAYER_OPTIONS,
            ...options,
            events: {
              onReady: (event: any) => {
                this.logger.info('Reproductor de YouTube inicializado');
                this.playerStateSubject.next('ready');
                this.setupPlayerEvents();
                observer.next(event.target);
                observer.complete();
              },
              onError: (error: any) => {
                let errorMessage = 'Error desconocido en el reproductor';
                switch (error.data) {
                  case 2: errorMessage = 'Parámetros inválidos (videoId)'; break;
                  case 5: errorMessage = 'Error HTML5'; break;
                  case 100: errorMessage = 'Video no encontrado'; break;
                  case 101:
                  case 150: errorMessage = 'Video restringido'; break;
                }
                this.logger.error(`Error en YouTube Player: ${errorMessage}`, error);
                this.playerStateSubject.next('error');
                observer.error(new Error(errorMessage));
              },
              onStateChange: (event: any) => {
                this.logger.debug(`Cambio de estado: ${event.data}`);
                this.isPlayingSubject.next(event.data === ytApi.PlayerState.PLAYING);
              },
            },
          });
        });
      }),
      catchError((err) => {
        this.logger.error('Error al inicializar el reproductor', err);
        return throwError(() => err);
      })
    );
  }

  public clearCurrentSong(): void {
    this.currentSongSubject.next(null);
    this.logger.info('Canción actual limpiada');
  }

  private setupPlayerEvents(): void {
    if (!this.isPlayerReady()) return;

    const interval = setInterval(() => {
      if (this.isPlayerReady()) {
        const currentTime = this.player!.getCurrentTime();
        const duration = this.player!.getDuration();
        this.currentTimeSubject.next(currentTime);
        this.durationSubject.next(duration);
        this.logger.debug(`Tiempo actual: ${currentTime.toFixed(2)}s, duración: ${duration.toFixed(2)}s`);
      }
    }, 1000);

    this.playerState$.subscribe((state) => {
      if (state !== 'ready') clearInterval(interval);
    });
  }

  public playVideo(videoId: string, startSeconds?: number, song?: Song): void {
    if (!videoId) {
      this.logger.error('Intento de reproducir video con videoId nulo o vacío');
      return;
    }
    if (this.isPlayerReady()) {
      this.logger.info(`Reproduciendo video: ${videoId}${startSeconds ? ` desde ${startSeconds}s` : ''}`);
      this.player!.loadVideoById(videoId, startSeconds);
      if (song) {
        this.currentSongSubject.next(song);
      }
    } else {
      this.logger.warn('Reproductor no inicializado, intentando inicializar...');
      this.initializePlayer('youtube-player').subscribe({
        next: () => {
          this.logger.info('Reproductor inicializado, reproduciendo video...');
          this.player!.loadVideoById(videoId, startSeconds);
          if (song) {
            this.currentSongSubject.next(song);
          }
        },
        error: (err) => this.logger.error('Error al inicializar reproductor para playVideo', err),
      });
    }
  }

  public pauseVideo(): void {
    if (this.isPlayerReady()) {
      this.player!.pauseVideo();
      this.logger.info('Video pausado');
    } else {
      this.logger.warn('Reproductor no inicializado para pausar');
    }
  }

  public stopVideo(): void {
    if (this.isPlayerReady()) {
      this.player!.stopVideo();
      this.logger.info('Video detenido');
    } else {
      this.logger.warn('Reproductor no inicializado para detener');
    }
  }

  public searchAndPlay(query: string): Observable<string> {
    if (!query.trim()) {
      this.logger.error('Consulta de búsqueda vacía');
      return throwError(() => new Error('Consulta de búsqueda vacía'));
    }
    if (!this.isPlayerReady()) {
      this.logger.warn('Reproductor no inicializado para búsqueda y reproducción, intentando inicializar...');
      return this.initializePlayer('youtube-player').pipe(
        switchMap(() => this.searchAndPlay(query))
      );
    }

    return this.youtubeService.searchVideos(query).pipe(
      map((songs: Song[]) => {
        if (songs.length > 0) {
          const bestSong = songs[0];
          if (!bestSong.videoId) {
            throw new Error('Canción sin videoId válido');
          }
          this.playVideo(bestSong.videoId, undefined, bestSong);
          return bestSong.videoId;
        } else {
          throw new Error('No se encontraron canciones para la consulta');
        }
      }),
      tap((videoId: string) =>
        this.logger.info(`Reproduciendo la mejor coincidencia para "${query}": ${videoId}`)
      ),
      catchError((error) => {
        this.logger.error('Error al buscar y reproducir la canción', error);
        return throwError(() => new Error(error.message));
      })
    );
  }

  public seekTo(seconds: number): void {
    if (this.isPlayerReady()) {
      this.player!.seekTo(seconds, true);
      this.logger.info(`Buscando posición: ${seconds.toFixed(2)}s`);
    } else {
      this.logger.warn('Reproductor no inicializado para seek');
    }
  }

  public getCurrentTime(): number {
    if (this.isPlayerReady()) {
      const time = this.player!.getCurrentTime();
      this.logger.debug(`Tiempo actual: ${time.toFixed(2)}s`);
      return time;
    }
    return 0;
  }

  public getDuration(): number {
    if (this.isPlayerReady()) {
      const duration = this.player!.getDuration();
      this.logger.debug(`Duración: ${duration.toFixed(2)}s`);
      return duration;
    }
    return 0;
  }

  public setVolume(volume: number): void {
    if (this.isPlayerReady() && volume >= 0 && volume <= 1) {
      this.player!.setVolume(volume * 100); // YouTube usa 0-100
      this.logger.info(`Volumen ajustado a: ${volume.toFixed(2)} (0-1)`);
    } else {
      this.logger.warn('Reproductor no inicializado o volumen fuera de rango (0-1)');
    }
  }
}
// src/app/services/youtube-player-core.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { filter, switchMap, catchError } from 'rxjs/operators';
import { LoggerService } from './core/logger.service';
import { YoutubeApiLoaderService } from './youtube-api-loader.service';

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
  mute?(): void;
  unMute?(): void;
  getVolume?(): number;
  isMuted?(): boolean;
  destroy?(): void;
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
  }
}

@Injectable({ providedIn: 'root' })
export class YoutubePlayerCoreService {
  private logger = inject(LoggerService);
  private apiLoader = inject(YoutubeApiLoaderService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private player: YTPlayer | null = null;

  public initializePlayer(elementId: string, options: any = {}): Observable<YTPlayer> {
    if (!this.isBrowser) {
      return throwError(() => new Error('No disponible en entorno server'));
    }

    const element = document.getElementById(elementId);
    if (!element) {
      this.logger.error(`Elemento DOM con id "${elementId}" no encontrado`);
      return throwError(() => new Error(`Elemento DOM "${elementId}" no encontrado`));
    }

    return this.apiLoader.apiReady$.pipe(
      filter(ready => ready),
      switchMap(() => {
        if (!window.YT) {
          return throwError(() => new Error('YouTube Iframe API no disponible'));
        }

        return new Observable<YTPlayer>(observer => {
          // Destruye player anterior si existe
          this.destroyPlayer();

          this.player = new window.YT.Player(elementId, {
            ...DEFAULT_PLAYER_OPTIONS,
            ...options,
            events: {
              onReady: (event: any) => {
                this.logger.info('Reproductor de YouTube inicializado');
                observer.next(event.target);
                observer.complete();
              },
              onError: (error: any) => {
                if (error.data === 2) {
                  this.logger.warn('Player inicializado sin video (esperado)');
                  return;
                }

                let errorMessage = 'Error desconocido en el reproductor';
                switch (error.data) {
                  case 5: errorMessage = 'Error HTML5'; break;
                  case 100: errorMessage = 'Video no encontrado'; break;
                  case 101:
                  case 150: errorMessage = 'Video restringido'; break;
                }
                
                this.logger.error(`Error en YouTube Player: ${errorMessage}`, error);
                observer.error(new Error(errorMessage));
              },
            }
          });
        });
      }),
      catchError(err => {
        this.logger.error('Error al inicializar el reproductor', err);
        return throwError(() => err);
      })
    );
  }

  public playVideo(): void {
    this.player?.playVideo?.();
  }

  public pauseVideo(): void {
    this.player?.pauseVideo?.();
  }

  public stopVideo(): void {
    this.player?.stopVideo?.();
  }

  public loadVideoById(videoId: string, startSeconds?: number): void {
    this.player?.loadVideoById?.(videoId, startSeconds);
  }

  public seekTo(seconds: number): void {
    this.player?.seekTo?.(seconds, true);
  }

  public getCurrentTime(): number {
    return this.player?.getCurrentTime?.() ?? 0;
  }

  public getDuration(): number {
    return this.player?.getDuration?.() ?? 0;
  }

  public setVolume(volume0to100: number): void {
    this.player?.setVolume?.(volume0to100);
  }

  public mute(): void {
    this.player?.mute?.();
  }

  public unMute(): void {
    this.player?.unMute?.();
  }

  public getVolume(): number {
    return this.player?.getVolume?.() ?? 100;
  }

  public isMuted(): boolean {
    return !!this.player?.isMuted?.();
  }

  public destroyPlayer(): void {
    try {
      this.player?.destroy?.();
    } catch (err) {
      this.logger.warn('Error destruyendo player', err);
    }
    this.player = null;
  }

  public getPlayer(): YTPlayer | null {
    return this.player;
  }

  public isInitialized(): boolean {
    return this.player !== null;
  }
}
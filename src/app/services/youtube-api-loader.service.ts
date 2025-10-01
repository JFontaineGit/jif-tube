// src/app/services/youtube-api-loader.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { LoggerService } from './core/logger.service';

const YT_IFRAME_API_URL = 'https://www.youtube.com/iframe_api';

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

@Injectable({ providedIn: 'root' })
export class YoutubeApiLoaderService {
  private logger = inject(LoggerService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private apiReadySubject = new BehaviorSubject<boolean>(false);
  public apiReady$ = this.apiReadySubject.asObservable();

  constructor() {
    if (this.isBrowser) {
      this.loadYoutubeIframeAPI();
    }
  }

  private loadYoutubeIframeAPI(): void {
    if (window.YT) {
      this.logger.info('YouTube Iframe API ya disponible');
      this.apiReadySubject.next(true);
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      this.logger.info('YouTube Iframe API cargada y lista');
      this.apiReadySubject.next(true);
      window.onYouTubeIframeAPIReady = undefined;
    };

    const tag = document.createElement('script');
    tag.src = YT_IFRAME_API_URL;
    tag.async = true;
    tag.onerror = () => {
      this.logger.error('Error al cargar YouTube Iframe API');
      this.apiReadySubject.next(false);
    };
    document.body.appendChild(tag);
  }

  public isApiReady(): boolean {
    return this.apiReadySubject.value;
  }
}
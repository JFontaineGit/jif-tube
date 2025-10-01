import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { Song, SearchResponse, VideoDetailsResponse, SearchConfig } from '../models/song.model';
import { LoggerService } from './core/logger.service';
import { StorageService } from './core/storage.service';
import { environment } from '../environments/environment';
import { mockSongs } from '../models/mock-songs.model';
import { SearchHistoryEntry } from '../models/search-history.model';
import Fuse from 'fuse.js';

interface CacheEntry {
  data: Song[] | VideoDetailsResponse;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class YoutubeService {
  private apiUrl = 'https://www.googleapis.com/youtube/v3';
  private apiKey = environment.youtubeApiKey;
  private config: SearchConfig = {
    minDurationSeconds: 30,
    maxDurationSeconds: 600,
    cacheTTL: 60,
  };
  private forbiddenTerms = ['tiktok', 'shorts', 'reaction', 'topic', 'compilation', 'lyrics video', 'lyric video', 'visualizer'];
  private popularQueries = ['trending music', 'new releases', 'top hits 2025'];

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private storage: StorageService
  ) {
    this.initializeCache();
  }

  private initializeCache(): void {
    this.logger.info('Inicializando caché con búsquedas populares');
    this.popularQueries.forEach((query) => {
      this.searchVideos(query).subscribe({
        next: () => this.logger.debug(`Caché precargado para query: ${query}`),
        error: (err) => this.logger.error(`Error al precargar caché para ${query}`, err),
      });
    });
  }

  searchVideos(query: string): Observable<Song[]> {
    if (environment.demoMode) {
      this.logger.info(`Modo demo activado, devolviendo canciones simuladas para: ${query}`);
      return of(mockSongs);
    }

    const historyKey = 'search_history';
    this.storage.get<SearchHistoryEntry[]>(historyKey).pipe(
      switchMap((history) => {
        const updatedHistory = history || [];
        const existingEntry = updatedHistory.find((entry) => entry.query === query);
        if (existingEntry) {
          existingEntry.count += 1;
          existingEntry.timestamp = Date.now();
        } else {
          updatedHistory.push({ query, timestamp: Date.now(), count: 1 });
        }
        updatedHistory.sort((a, b) => b.timestamp - a.timestamp);
        return this.storage.save(historyKey, updatedHistory.slice(0, 10));
      })
    ).subscribe({
      next: () => this.logger.debug(`Historial de búsqueda actualizado para: ${query}`),
      error: (err) => this.logger.error(`Error al guardar historial para ${query}`, err),
    });

    const cacheKey = `search_${query.toLowerCase()}`;
    return this.storage.get<CacheEntry>(cacheKey).pipe(
      switchMap((cached) => {
        if (cached && this.isCacheValid(cached.timestamp)) {
          this.logger.debug(`Devolviendo resultados desde caché para: ${query}`);
          return of(cached.data as Song[]);
        }
        return this.fetchVideos(query, cacheKey);
      })
    );
  }

  private fetchVideos(query: string, cacheKey: string): Observable<Song[]> {
    const normalizedQuery = query
      .toLowerCase()
      .replace(/\b(a|el|la|los|las|de|del|que|y|o)\b/g, '')
      .replace(/[,\.\-!?:;]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const searchParams = new HttpParams()
      .set('part', 'snippet')
      .set('type', 'video')
      .set('videoCategoryId', '10')
      .set('order', 'viewCount')
      .set('relevanceLanguage', 'es')
      .set('regionCode', 'AR')
      .set('videoDefinition', 'high')
      .set('maxResults', '10')
      .set('q', normalizedQuery)
      .set('key', this.apiKey);

    this.logger.debug(`Realizando búsqueda normalizada: ${normalizedQuery}`);

    return this.http.get<SearchResponse>(`${this.apiUrl}/search`, { params: searchParams }).pipe(
      map((response) => response.items.map(item => item.id.videoId)),
      switchMap((videoIds) => {
        if (!videoIds.length) {
          this.logger.warn(`No se encontraron videos válidos para query: ${normalizedQuery}`);
          return of([]);
        }

        const videoParams = new HttpParams()
          .set('part', 'snippet,contentDetails,statistics')
          .set('id', videoIds.join(','))
          .set('key', this.apiKey);

        return this.http.get<VideoDetailsResponse>(`${this.apiUrl}/videos`, { params: videoParams }).pipe(
          map((response) => response.items.map((item) => {
            const duration = this.parseDuration(item.contentDetails.duration);
            const publishedAt = new Date(item.snippet.publishedAt);
            const ageDays = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
            const views = parseInt(item.statistics.viewCount || '0', 10);
            const titleTerms = item.snippet.title.toLowerCase().split(/\s+/);
            const queryTerms = normalizedQuery.split(/\s+/);
            const matchTitleRatio = queryTerms.reduce((acc, term) => acc + (titleTerms.includes(term) ? 1 : 0), 0) / queryTerms.length || 0;

            let customScore = (views * 0.5) + ((1 / ageDays) * 0.3) + (matchTitleRatio * 0.2);

            const fuse = new Fuse([item.snippet.title], { includeScore: true });
            const fuzzyResult = fuse.search(normalizedQuery)[0];
            const normalizedDistance = fuzzyResult ? fuzzyResult.score || 0 : 1;
            const semanticBoost = (item.snippet.title.toLowerCase().includes('official audio') ||
              item.snippet.title.toLowerCase().includes('topic') ||
              (item.snippet.tags || []).some(tag => tag.toLowerCase().includes('official audio') || tag.toLowerCase().includes('topic')))
              ? 1.5 : 1;
            customScore *= semanticBoost;
            customScore += (1 - normalizedDistance) * 0.1;

            return {
              id: item.id,
              videoId: item.id,
              title: item.snippet.title,
              artist: item.snippet.channelTitle,
              thumbnailUrl: this.getBestThumbnail(item.snippet.thumbnails),
              album: this.extractAlbumFromDetails({ items: [item] }),
              type: item.snippet.title.toLowerCase().includes('official audio') ? 'official-video' : 'album-track',
              duration,
              customScore,
            } as Song;
          })),
          map((songs) => songs.sort((a, b) => (b.customScore || 0) - (a.customScore || 0))),
          tap((songs) => {
            if (songs.length) {
              const cacheEntry: CacheEntry = { data: songs, timestamp: Date.now() };
              this.storage.save(cacheKey, cacheEntry).subscribe({
                next: () => this.logger.debug(`Resultados cacheados para: ${normalizedQuery}`),
                error: (err) => this.logger.error(`Error al guardar caché para ${normalizedQuery}`, err),
              });
            }
          }),
          catchError((error) => this.handleError(error, `Error en fetchVideos: ${normalizedQuery}`))
        );
      })
    );
  }

  getSearchHistory(): Observable<string[]> {
    const historyKey = 'search_history';
    return this.storage.get<SearchHistoryEntry[]>(historyKey).pipe(
      map((history) => {
        const sortedHistory = (history || []).sort((a, b) => b.count - a.count).map((entry) => entry.query);
        this.logger.debug(`Historial de búsqueda obtenido con ${sortedHistory.length} entradas`);
        return sortedHistory;
      })
    );
  }


  private getBestThumbnail(thumbnails: any): string {
    if (!thumbnails) return '';

    const priority = ['maxres', 'standard', 'high', 'medium', 'default'];
    for (const key of priority) {
      if (thumbnails[key]?.url) {
        return thumbnails[key].url;
      }
    }

    return '';
  }
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) {
      this.logger.warn(`Formato de duración no válido: ${duration}`);
      return 0;
    }
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  private extractAlbumFromDetails(details: VideoDetailsResponse | null): string {
    if (!details?.items?.length) {
      this.logger.debug('No se encontraron detalles para extraer álbum');
      return 'Desconocido';
    }
    const description = details.items[0].snippet.description;
    const tags = details.items[0].snippet.tags || [];

    const patterns = [
      /(?:Álbum|Album):\s*([^\n]+)/i,
      /from the album\s*([^\n]+)/i,
      /\(album:\s*([^\)]+)\)/i,
      /genshin impact\s*[-–]\s*([^\n]+)/i,
    ];
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        this.logger.debug(`Álbum extraído de descripción: ${match[1].trim()}`);
        return match[1].trim();
      }
    }

    const albumTag = tags.find(tag => tag.toLowerCase().includes('album') || tag.toLowerCase().includes('ost'));
    return albumTag ? albumTag.replace(/(album|ost)/i, '').trim() : 'Desconocido';
  }

  private isCacheValid(timestamp: number): boolean {
    const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);
    return ageInMinutes < this.config.cacheTTL;
  }

  private handleError(error: any, message: string): Observable<never> {
    let errorMessage = message;
    if (error.status) {
      switch (error.status) {
        case 400:
          errorMessage = `${message}: Solicitud inválida`;
          break;
        case 401:
          errorMessage = `${message}: No autorizado`;
          this.storage.clearStorage().subscribe();
          break;
        case 403:
          errorMessage = `${message}: Acceso denegado (posible límite de cuota)`;
          break;
        case 404:
          errorMessage = `${message}: Recurso no encontrado`;
          break;
        case 500:
          errorMessage = `${message}: Error del servidor`;
          break;
        default:
          errorMessage = `${message}: ${error.message || 'Error desconocido'}`;
      }
    } else {
      errorMessage = `${message}: ${error.message || 'Error desconocido'}`;
    }
    this.logger.error(errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
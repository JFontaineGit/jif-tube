import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin, throwError } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { Song } from '../models/song.model';
import { LoggerService } from './core/logger.service';
import { StorageService } from './core/storage.service';
import { SearchResponse, VideoDetailsResponse, SearchConfig } from '../models/song.model';

// Interfaz para datos almacenados en caché
interface CacheEntry {
  data: Song[];
  timestamp: number;
}

/**
 * Servicio para buscar videos musicales oficiales en YouTube y transformarlos en objetos Song.
 * Prioriza videos oficiales y audio oficial, excluyendo contenido irrelevante.
 */
@Injectable({
  providedIn: 'root',
})
export class YoutubeService {
  private apiUrl = 'https://www.googleapis.com/youtube/v3';
  private apiKey = 'AIzaSyDhUFUrs5MbqkG_6RaRIWhIFWcyOEK8qhE'
  private config: SearchConfig = {
    minDurationSeconds: 30, // Para intros cortas
    maxDurationSeconds: 600, // 10 minutos
    cacheTTL: 60, // 1 hora en minutos
  };
  private forbiddenTerms = [
    'tiktok', 'shorts', 'reaction', 'topic', 'compilation',
  ];

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private storage: StorageService
  ) {}

  /**
   * Busca videos musicales en YouTube basándose en una consulta.
   * @param query - Término de búsqueda (ej. "Fontaine" o "La vaguelette").
   * @returns Observable con un arreglo de objetos Song ordenados por relevancia.
   */
  searchVideos(query: string): Observable<Song[]> {
    const cacheKey = `search_${query.toLowerCase()}`;
    return this.storage.get<CacheEntry>(cacheKey).pipe(
      switchMap(cached => {
        if (cached && this.isCacheValid(cached.timestamp)) {
          return of(cached.data);
        }
        return this.fetchVideos(query, cacheKey);
      })
    );
  }

  /**
   * Realiza la búsqueda de videos en la API de YouTube.
   * @param query - Término de búsqueda.
   * @param cacheKey - Clave para almacenar en caché.
   * @returns Observable con un arreglo de objetos Song.
   */
  private fetchVideos(query: string, cacheKey: string): Observable<Song[]> {
    const params = new HttpParams()
      .set('part', 'snippet')
      .set('maxResults', '20')
      .set('q', query) 
      .set('type', 'video')
      .set('videoCategoryId', '10') // Categoría de música
      .set('videoDuration', 'medium')
      .set('key', this.apiKey);

    return this.http.get<SearchResponse>(`${this.apiUrl}/search`, { params }).pipe(
      map(response => response.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnailUrl: item.snippet.thumbnails.high.url,
        publishedAt: item.snippet.publishedAt,
      }))),
      switchMap(videos => {
        if (!videos.length) {
          return of([]);
        }

        const batchSize = 5;
        const batches: Observable<(Song | null)[]>[] = [];
        for (let i = 0; i < videos.length; i += batchSize) {
          const batch = videos.slice(i, i + batchSize).map(video =>
            this.getVideoDetails(video.videoId).pipe(
              map(details => this.transformToSong(video, details)),
              catchError(() => of(null))
            )
          );
          batches.push(forkJoin(batch));
        }

        return forkJoin(batches).pipe(
          map(results => results.flat().filter((song): song is Song => song !== null)),
          map(songs => this.sortByRelevance(songs)),
          tap(songs => {
            if (songs.length) {
              const cacheEntry: CacheEntry = { data: songs, timestamp: Date.now() };
              this.storage.save(cacheKey, cacheEntry).subscribe({
                error: err => this.logger.error(`Error al guardar en caché: ${err.message}`, err)
              });
            }
          })
        );
      }),
      catchError(error => this.handleError(error, `Error al buscar videos musicales con query: ${query}`))
    );
  }

  /**
   * Obtiene detalles de un video de YouTube.
   * @param videoId - ID del video.
   * @returns Observable con los detalles del video o null si falla.
   */
  private getVideoDetails(videoId: string): Observable<VideoDetailsResponse | null> {
    const params = new HttpParams()
      .set('part', 'snippet,contentDetails,statistics')
      .set('id', videoId)
      .set('key', this.apiKey);

    return this.http.get<VideoDetailsResponse>(`${this.apiUrl}/videos`, { params }).pipe(
      catchError(() => of(null))
    );
  }

  /**
   * Transforma un video y sus detalles en un objeto Song.
   * @param video - Datos básicos del video.
   * @param details - Detalles completos del video.
   * @returns Objeto Song o null si no es relevante.
   */
  private transformToSong(
    video: { videoId: string; title: string; artist: string; thumbnailUrl: string; publishedAt: string },
    details: VideoDetailsResponse | null
  ): Song | null {
    if (!details?.items?.length) return null;

    const item = details.items[0];
    const duration = this.parseDuration(item.contentDetails.duration);
    if (duration < this.config.minDurationSeconds || duration > this.config.maxDurationSeconds) {
      return null;
    }

    const title = item.snippet.title.toLowerCase();
    const description = item.snippet.description.toLowerCase();
    const tags = (item.snippet.tags || []).map(tag => tag.toLowerCase());

    // Filtrar contenido no musical
    if (this.forbiddenTerms.some(term => title.includes(term) || description.includes(term) || tags.includes(term))) {
      return null;
    }

    // Puntaje de relevancia basado solo en vistas
    const relevanceScore = parseInt(item.statistics.viewCount) / 1000000;

    return {
      id: video.videoId,
      videoId: video.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnailUrl: video.thumbnailUrl,
      album: this.extractAlbumFromDetails(details),
      type: 'album-track', // Simplificado, sin distinguir official-video
      duration,
      relevanceScore,
    };
  }

  /**
   * Parsea la duración en formato ISO (PT#M#S) a segundos.
   * @param duration - Duración en formato ISO.
   * @returns Duración en segundos.
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Extrae el nombre del álbum desde los detalles del video.
   * @param details - Respuesta de detalles del video.
   * @returns Nombre del álbum o 'Desconocido'.
   */
  private extractAlbumFromDetails(details: VideoDetailsResponse | null): string {
    if (!details?.items?.length) return 'Desconocido';
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
      if (match) return match[1].trim();
    }

    const albumTag = tags.find(tag => tag.toLowerCase().includes('album') || tag.toLowerCase().includes('ost'));
    return albumTag ? albumTag.replace(/(album|ost)/i, '').trim() : 'Desconocido';
  }

  /**
   * Ordena canciones por puntaje de relevancia.
   * @param songs - Arreglo de canciones.
   * @returns Arreglo ordenado.
   */
  private sortByRelevance(songs: Song[]): Song[] {
    return songs.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Verifica si el caché es válido según el timestamp.
   * @param timestamp - Timestamp del caché.
   * @returns True si el caché es válido.
   */
  private isCacheValid(timestamp: number): boolean {
    if (!timestamp) return false;
    const ageInMinutes = (Date.now() - timestamp) / 1000 / 60;
    return ageInMinutes < this.config.cacheTTL;
  }

  /**
   * Maneja errores de operaciones HTTP.
   * @param error - Error capturado.
   * @param message - Mensaje descriptivo.
   * @returns Observable con el error manejado.
   */
  private handleError(error: any, message: string): Observable<never> {
    let errorMessage = message;
    if (error.status) {
      switch (error.status) {
        case 400: errorMessage = `${message}: Solicitud inválida`; break;
        case 401:
          errorMessage = `${message}: No autorizado`;
          this.storage.clearStorage().subscribe({
            error: err => this.logger.error(`Error al limpiar almacenamiento: ${err.message}`, err)
          });
          break;
        case 403: errorMessage = `${message}: Acceso denegado (posible límite de cuota)`; break;
        case 404: errorMessage = `${message}: Recurso no encontrado`; break;
        case 500: errorMessage = `${message}: Error del servidor`; break;
        default: errorMessage = `${message}: ${error.message || 'Error desconocido'}`;
      }
    } else {
      errorMessage = `${message}: ${error.message || 'Error desconocido'}`;
    }
    this.logger.error(errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
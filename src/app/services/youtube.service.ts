import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Song } from '../models/song.model';
import { LoggerService } from './core/logger.service';
import { StorageService } from './core/storage.service';

// Interfaz para la respuesta de la API de búsqueda de YouTube
interface SearchResponse {
  items: {
    id: { videoId: string };
    snippet: {
      title: string;
      channelTitle: string;
      thumbnails: { high: { url: string } };
    };
  }[];
}

// Interfaz para la respuesta de detalles de video de YouTube
interface VideoDetailsResponse {
  items: {
    snippet: {
      description: string;
      tags?: string[];
      title: string;
    };
    contentDetails: {
      duration: string;
    };
  }[];
}

/**
 * Servicio para interactuar con la API de YouTube y obtener información de canciones.
 * Gestiona búsquedas de videos y detalles de videos, transformándolos en objetos Song.
 */
@Injectable({
  providedIn: 'root',
})
export class YoutubeService {
  private apiUrl = 'https://www.googleapis.com/youtube/v3';
  private apiKey = 'AIzaSyDhUFUrs5MbqkG_6RaRIWhIFWcyOEK8qhE'; // Extraído de variables de entorno

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private storage: StorageService
  ) {}

  /**
   * Busca videos en YouTube basándose en una consulta y los transforma en objetos Song.
   * @param query - Término de búsqueda para encontrar videos.
   * @returns Observable que emite un arreglo de objetos Song.
   */
  searchVideos(query: string): Observable<Song[]> {
    const params = new HttpParams()
      .set('part', 'snippet')
      .set('maxResults', '20')
      .set('q', `${query} -mix -playlist -hits -vevo -shorts -tiktok`)
      .set('type', 'video')
      .set('videoCategoryId', '10')
      .set('videoDuration', 'medium')
      .set('key', this.apiKey);

    return this.http.get<SearchResponse>(`${this.apiUrl}/search`, { params }).pipe(
      map(response =>
        response.items
          .filter(item => {
            const channelTitle = item.snippet.channelTitle.toLowerCase();
            return !(
              channelTitle.includes('spotify') ||
              channelTitle.includes('vevo') ||
              channelTitle.includes('mix') ||
              channelTitle.includes('playlist') ||
              channelTitle.includes('hits') ||
              channelTitle.includes('official charts') ||
              channelTitle.includes('music channel') ||
              channelTitle.includes('shorts') ||
              channelTitle.includes('tiktok') ||
              channelTitle.includes('reels') ||
              channelTitle.includes('topic')
            );
          })
          .map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            videoId: item.id.videoId,
            thumbnailUrl: item.snippet.thumbnails.high.url,
            artist: item.snippet.channelTitle,
            type: 'official-video' as 'official-video' | 'album-track',
          }))
      ),
      switchMap((songs: Song[]) => {
        if (songs.length === 0) return of([]);

        const detailRequests = songs.map(song =>
          this.getVideoDetails(song.videoId).pipe(
            map((details: VideoDetailsResponse | null) => {
              if (!details) return null;

              const duration = details?.items?.[0]?.contentDetails?.duration || '';
              const durationInSeconds = this.parseDuration(duration);
              if (durationInSeconds < 60 || durationInSeconds > 600) return null;

              const title = song.title.toLowerCase();
              const tags: string[] = details?.items?.[0]?.snippet?.tags || [];
              const channelTitle = song.artist.toLowerCase();

              const isOfficialVideo =
                channelTitle.includes('vevo') ||
                tags.some(tag => tag.toLowerCase().includes('official') || tag.toLowerCase().includes('music video')) ||
                title.includes('official video') ||
                title.includes('music video');

              const isAlbumTrack =
                tags.some(tag => tag.toLowerCase().includes('album')) ||
                title.includes('official audio') ||
                title.includes('album') ||
                title.includes('audio');

              const songType = isOfficialVideo ? 'official-video' : isAlbumTrack ? 'album-track' : 'official-video';

              return {
                ...song,
                album: this.extractAlbumFromDetails(details),
                type: songType,
                duration: durationInSeconds, 
              };
            }),
            catchError(error => {
              this.logger.error(`Error al obtener detalles del video ${song.videoId}`, error);
              return of(null);
            })
          )
        );

        return forkJoin(detailRequests).pipe(
          map(results => results.filter(song => song !== null) as Song[]),
          catchError(error => this.handleError(error, 'Error al procesar detalles de videos'))
        );
      }),
      catchError(error => this.handleError(error, 'Error al buscar videos'))
    );
  }

  /**
   * Obtiene detalles de un video específico de YouTube.
   * @param videoId - ID del video a consultar.
   * @returns Observable que emite los detalles del video o null si falla.
   */
  getVideoDetails(videoId: string): Observable<VideoDetailsResponse | null> {
    const params = new HttpParams()
      .set('part', 'snippet,contentDetails')
      .set('id', videoId)
      .set('key', this.apiKey);

    return this.http.get<VideoDetailsResponse>(`${this.apiUrl}/videos`, { params }).pipe(
      catchError(error => this.handleError(error, `Error al obtener detalles del video ${videoId}`))
    );
  }

  /**
   * Parsea la duración de un video en formato ISO (PT#M#S) a segundos.
   * @param duration - Duración en formato ISO (ej. PT3M45S).
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
   * @param details - Respuesta de la API de detalles del video.
   * @returns Nombre del álbum o 'Desconocido' si no se encuentra.
   */
  private extractAlbumFromDetails(details: VideoDetailsResponse | null): string {
    if (!details) return 'Desconocido';
    const description = details?.items?.[0]?.snippet?.description || '';
    const tags: string[] = details?.items?.[0]?.snippet?.tags || [];

    const albumMatch = description.match(/(?:Álbum|Album):\s*([^\n]+)/i);
    if (albumMatch) return albumMatch[1].trim();

    const albumTag = tags.find(tag => tag.toLowerCase().includes('album'));
    return albumTag ? albumTag.replace(/album/i, '').trim() : 'Desconocido';
  }

  /**
   * Maneja errores de las operaciones HTTP.
   * @param error - El error capturado.
   * @param message - Mensaje descriptivo del error.
   * @returns Observable que emite el error manejado.
   */
  private handleError(error: any, message: string): Observable<never> {
    let errorMessage = message;
    if (error.status) {
      switch (error.status) {
        case 400:
          errorMessage = `${message}: Solicitud inválida`;
          break;
        case 401:
          errorMessage = `${message}: No autorizado`;
          this.storage.clearStorage();
          break;
        case 403:
          errorMessage = `${message}: Acceso denegado`;
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
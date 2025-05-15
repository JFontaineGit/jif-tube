// src/app/services/youtube.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Song } from '../models/song.model';

// Interfaz para tipar la respuesta de la API de YouTube (detalles del video)
interface VideoDetailsResponse {
  items: {
    snippet: {
      description: string;
      tags?: string[]; // Las etiquetas son un array de strings, opcional
      title: string;
    };
    contentDetails: {
      duration: string;
    };
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class YoutubeService {
  private apiUrl = 'https://www.googleapis.com/youtube/v3';
  private apiKey = 'AIzaSyDhUFUrs5MbqkG_6RaRIWhIFWcyOEK8qhE';

  private mockSongs: Song[] = [/* ... canciones simuladas ... */];

  constructor(private http: HttpClient) {}

  searchVideos(query: string): Observable<Song[]> {
    const params = new HttpParams()
      .set('part', 'snippet')
      .set('maxResults', '20')
      .set('q', `${query} -mix -playlist -hits -vevo -shorts -tiktok`)
      .set('type', 'video')
      .set('videoCategoryId', '10')
      .set('videoDuration', 'medium')
      .set('key', this.apiKey);

    return this.http.get(`${this.apiUrl}/search`, { params }).pipe(
      map((response: any) => {
        return response.items
          .filter((item: any) => {
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
              channelTitle.includes('reels')
            );
          })
          .map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            videoId: item.id.videoId,
            thumbnailUrl: item.snippet.thumbnails.high.url,
            artist: item.snippet.channelTitle,
            type: 'official-video' as 'official-video' | 'album-track',
          }));
      }),
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
              const tags: string[] = details?.items?.[0]?.snippet?.tags || []; // Tipamos tags como string[]
              const channelTitle = song.artist.toLowerCase();

              // Determinar el tipo de canción
              const isOfficialVideo = 
                channelTitle.includes('vevo') ||
                tags.some((tag: string) => // Tipamos tag explícitamente
                  tag.toLowerCase().includes('official') ||
                  tag.toLowerCase().includes('music video')
                ) ||
                title.includes('official video') ||
                title.includes('music video');

              const isAlbumTrack = 
                tags.some((tag: string) => // Tipamos tag explícitamente
                  tag.toLowerCase().includes('album')
                ) ||
                title.includes('official audio') ||
                title.includes('album') ||
                title.includes('audio');

              const songType = isOfficialVideo ? 'official-video' : (isAlbumTrack ? 'album-track' : 'official-video');

              return {
                ...song,
                album: this.extractAlbumFromDetails(details),
                type: songType,
              };
            }),
            catchError(() => of(null))
          )
        );

        return forkJoin(detailRequests).pipe(
          map(results => results.filter(song => song !== null) as Song[]),
          catchError(() => of(songs))
        );
      }),
      catchError((error) => {
        console.error('Error fetching videos:', error);
        return of([]);
      })
    );
  }

  getVideoDetails(videoId: string): Observable<VideoDetailsResponse | null> {
    const params = new HttpParams()
      .set('part', 'snippet,contentDetails')
      .set('id', videoId)
      .set('key', this.apiKey);

    return this.http.get<VideoDetailsResponse>(`${this.apiUrl}/videos`, { params }).pipe(
      catchError((error) => {
        console.error('Error fetching video details:', error);
        return of(null);
      })
    );
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  private extractAlbumFromDetails(details: VideoDetailsResponse | null): string {
    if (!details) return 'Desconocido';
    const description = details?.items?.[0]?.snippet?.description || '';
    const tags: string[] = details?.items?.[0]?.snippet?.tags || []; // Tipamos tags como string[]

    const albumMatch = description.match(/(?:Álbum|Album):\s*([^\n]+)/i);
    if (albumMatch) return albumMatch[1].trim();

    const albumTag = tags.find((tag: string) => tag.toLowerCase().includes('album'));
    return albumTag ? albumTag.replace(/album/i, '').trim() : 'Desconocido';
  }

  getMockSongs(): Observable<Song[]> {
    return of(this.mockSongs);
  }
}
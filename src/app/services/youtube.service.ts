// src/app/services/youtube.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http'; 
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Song } from '../models/song.model';

@Injectable({
  providedIn: 'root',
})
export class YoutubeService {
  private apiUrl = 'https://www.googleapis.com/youtube/v3';
  private apiKey = 'AIzaSyDhUFUrs5MbqkG_6RaRIWhIFWcyOEK8qhE'; // Acá va la clave

  private mockSongs: Song[] = [
    {
      id: '1',
      title: 'Bohemian Rhapsody',
      videoId: 'fJ9rUzIMcZQ',
      thumbnailUrl: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
      artist: 'Queen',
    },
    {
      id: '2',
      title: 'Billie Jean',
      videoId: 'Zi_XfYBgRgI',
      thumbnailUrl: 'https://i.ytimg.com/vi/Zi_XfYBgRgI/hqdefault.jpg',
      artist: 'Michael Jackson',
    },
    {
      id: '3',
      title: 'Hotel California',
      videoId: 'BciS5krYL80',
      thumbnailUrl: 'https://i.ytimg.com/vi/BciS5krYL80/hqdefault.jpg',
      artist: 'Eagles',
    },
    {
      id: '4',
      title: 'Sweet Child O\' Mine',
      videoId: '1w7OgIMMRc4',
      thumbnailUrl: 'https://i.ytimg.com/vi/1w7OgIMMRc4/hqdefault.jpg',
      artist: 'Guns N\' Roses',
    },
    {
      id: '5',
      title: 'Imagine',
      videoId: 'VOgFZfRVaww',
      thumbnailUrl: 'https://i.ytimg.com/vi/VOgFZfRVaww/hqdefault.jpg',
      artist: 'John Lennon',
    },
    {
      id: '6',
      title: 'Smells Like Teen Spirit',
      videoId: 'hTWKbfoikeg',
      thumbnailUrl: 'https://i.ytimg.com/vi/hTWKbfoikeg/hqdefault.jpg',
      artist: 'Nirvana',
    },
  ];

  constructor(private http: HttpClient) {}

  getMockSongs(): Observable<Song[]> {
    return of(this.mockSongs);
  }

  searchVideos(query: string): Observable<Song[]> {
    const params = new HttpParams()
      .set('part', 'snippet')
      .set('maxResults', '20')
      .set('q', query)
      .set('type', 'video')
      .set('videoCategoryId', '10')
      .set('key', this.apiKey);

    return this.http.get(`${this.apiUrl}/search`, { params }).pipe(
      map((response: any) => {
        return response.items.map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          videoId: item.id.videoId,
          thumbnailUrl: item.snippet.thumbnails.high.url,
          artist: item.snippet.channelTitle,
        }));
      }),
      catchError((error) => {
        console.error('Error fetching videos:', error);
        return of(this.mockSongs);
      }),
    );
  }

  getVideoDetails(videoId: string): Observable<any> {
    const params = new HttpParams()
      .set('part', 'snippet,contentDetails')
      .set('id', videoId)
      .set('key', this.apiKey);

    return this.http.get(`${this.apiUrl}/videos`, { params }).pipe(
      catchError((error) => {
        console.error('Error fetching video details:', error);
        return of(null);
      }),
    );
  }
}
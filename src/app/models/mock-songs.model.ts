// src/app/models/mock-songs.model.ts
import { Song, SongType } from './song.model';

export const mockSongs: Song[] = [
  {
    id: 'mock1',
    videoId: 'mock1',
    title: 'Mock Song 1',
    artist: 'Mock Artist',
    thumbnailUrl: 'https://via.placeholder.com/150',
    album: 'Mock Album',
    type: SongType.AlbumTrack, // ✅ Cambio aquí
    duration: 180,
    relevanceScore: 0.5,
  },
  {
    id: 'mock2',
    videoId: 'mock2',
    title: 'Mock Song 2',
    artist: 'Mock Artist 2',
    thumbnailUrl: 'https://via.placeholder.com/150',
    album: 'Mock Album 2',
    type: SongType.AlbumTrack, // ✅ Cambio aquí
    duration: 240,
    relevanceScore: 0.7,
  },
];
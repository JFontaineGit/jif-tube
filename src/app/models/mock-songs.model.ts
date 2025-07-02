import { Song } from './song.model';

export const mockSongs: Song[] = [
  {
    id: 'mock1',
    videoId: 'mock1',
    title: 'Mock Song 1',
    artist: 'Mock Artist',
    thumbnailUrl: 'https://via.placeholder.com/150',
    album: 'Mock Album',
    type: 'album-track',
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
    type: 'album-track',
    duration: 240,
    relevanceScore: 0.7,
  },
];
// src/app/models/song.model.ts
export interface Song {
  id: string;
  title: string;
  videoId: string;
  thumbnailUrl: string;
  artist: string;
  album?: string;
  type: 'official-video' | 'album-track'; // Nuevo campo para clasificar
}
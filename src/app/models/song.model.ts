export interface Song {
  id: string;
  title: string;
  videoId: string;
  thumbnailUrl: string;
  artist: string;
  album?: string;
  type: 'official-video' | 'album-track';
  duration?: number; // Duración en segundos
  relevanceScore?: number; // Puntuación de relevancia para ordenar
}

export interface SearchResponse {
  items: {
    id: { videoId: string };
    snippet: {
      title: string;
      channelTitle: string;
      thumbnails: { high: { url: string } };
      publishedAt: string;
    };
  }[];
}

export interface VideoDetailsResponse {
  items: {
    snippet: {
      title: string;
      description: string;
      tags?: string[];
      channelTitle: string;
    };
    contentDetails: {
      duration: string;
    };
    statistics: {
      viewCount: string;
    };
  }[];
}

export interface SearchConfig {
  minDurationSeconds: number;
  maxDurationSeconds: number;
  cacheTTL: number; // Tiempo de vida del caché en minutos
}
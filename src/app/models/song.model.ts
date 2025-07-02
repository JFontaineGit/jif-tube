// models/song.model.ts

export interface Song {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  album?: string;
  type: 'official-video' | 'album-track';
  duration?: number;

  /** Puntuación basada en engagement, antigüedad y otros factores */
  relevanceScore?: number;

  /** Puntuación personalizada con boost semántico (fuzzy match, etiquetas, etc.) */
  customScore?: number;
}

export interface SearchResponse {
  items: {
    id: {
      videoId: string;
    };
    snippet: {
      title: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails: {
        high: {
          url: string;
        };
      };
    };
  }[];
}

export interface VideoDetailsResponse {
  items: {
    id: string;
    snippet: {
      title: string;
      description: string;
      tags?: string[];
      channelTitle: string;
      publishedAt: string;
      thumbnails?: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
    contentDetails: {
      /** Duración en formato ISO 8601, ej: PT3M45S */
      duration: string;
    };
    statistics: {
      viewCount: string;
      likeCount: string;
      commentCount: string;
    };
  }[];
}

export interface SearchConfig {
  /** Tiempo mínimo en segundos para una canción válida */
  minDurationSeconds: number;

  /** Tiempo máximo en segundos para una canción válida */
  maxDurationSeconds: number;

  /** Tiempo de vida del caché en minutos */
  cacheTTL: number;
}

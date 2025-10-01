// Remodernizado: Enum para type, optional state fields para player (no persistentes). Tipado estricto sin any.

export enum SongType {
  OfficialVideo = 'official-video',
  AlbumTrack = 'album-track'
}

export interface Song {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  album?: string;
  type: SongType;
  duration?: number;

  /** Puntuación basada en engagement, antigüedad y otros factores */
  relevanceScore?: number;

  /** Puntuación personalizada con boost semántico (fuzzy match, etiquetas, etc.) */
  customScore?: number;

  // State para UI (no en DB, de polling/API)
  currentTime?: number;  // Segundos actuales
  isPlaying?: boolean;   // Estado reproducción
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
      duration: string;  // ISO 8601, e.g., PT3M45S
    };
    statistics: {
      viewCount: string;
      likeCount: string;
      commentCount: string;
    };
  }[];
}

export interface SearchConfig {
  minDurationSeconds: number;
  maxDurationSeconds: number;
  cacheTTL: number;
}
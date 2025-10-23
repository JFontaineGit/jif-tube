import { Song } from '@interfaces'

export interface SongSearchResult extends Song {
  custom_score: number;
  rank: number | null;
}

export interface SearchParams {
  q: string;                     // Query string (1-500 chars)
  max_results?: number;          // 1-50, default 10
  region_code?: string;          // ISO code (2 chars, e.g., AR, US)
}

export interface SearchHistory {
  id: number;
  query: string;
  timestamp: number;             // UNIX timestamp (ms)
  count: number;                 // Número de resultados
  user_id: number;
}

export interface SearchCreate {
  query: string;
  timestamp?: number;
}

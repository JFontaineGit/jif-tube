import { Song } from '@interfaces'

/**
 * ============================================================================
 * LIBRARY INTERFACES
 * ============================================================================
 */

export interface LibraryItem {
  id: number;
  user_id: number;
  song_id: string;               // YouTube video_id
  added_at: string;              // ISO date string
  song?: Song;                   // Populated song data
}

export interface LibraryItemCreate {
  song_id: string;               // YouTube video_id (11 chars)
}

/**
 * ============================================================================
 * API RESPONSE HELPERS
 * ============================================================================
 */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ApiError {
  detail: string | Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}
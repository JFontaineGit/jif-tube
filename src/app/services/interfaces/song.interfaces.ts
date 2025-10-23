/**
 * ============================================================================
 * SONG CORE INTERFACES
 * ============================================================================
 * Interfaces básicas para canciones (estructura del backend)
 */

// =========================================================================
// THUMBNAIL TYPES
// =========================================================================

/**
 * Thumbnail completo con metadata (formato YouTube API original)
 */
export interface ThumbnailWithMetadata {
  url: string;
  width: number;
  height: number;
}

/**
 * Thumbnails puede ser:
 * 1. Un Record de URLs directas (formato simplificado del backend)
 * 2. Un Record de objetos con metadata (formato completo YouTube API)
 */
export type ThumbnailsDict = Record<string, string | ThumbnailWithMetadata>;

// Alias para compatibilidad
export type Thumbnail = ThumbnailWithMetadata;

// =========================================================================
// SONG ENTITY (Backend structure)
// =========================================================================

/**
 * Información completa de una canción desde YouTube
 */
export interface Song {
  id: string; // YouTube video_id (11 caracteres)
  title: string;
  channel_title: string | null;
  duration: string | null; // Duración en segundos (formato string: "234")
  thumbnails: ThumbnailsDict | null; // ✅ Ahora soporta ambos formatos
  published_at: string | null; // ISO date string
  created_at: string; // ISO date string
}

/**
 * Payload para crear una canción
 */
export interface SongCreate {
  id: string;
  title: string;
  channel_title?: string | null;
  duration?: string | null;
  thumbnails?: ThumbnailsDict | null;
  published_at?: string | null;
}

// =========================================================================
// UI ENUMS (Frontend only)
// =========================================================================

/**
 * Tipo de canción/video (para UI) - detectado por el título
 */
export enum SongType {
  OfficialVideo = 'official-video',
  AlbumTrack = 'album-track',
  Live = 'live',
  Cover = 'cover',
  Remix = 'remix',
  Unknown = 'unknown',
}

/**
 * Calidades de video disponibles
 */
export type VideoQuality = 
  | 'default'
  | 'small'
  | 'medium'
  | 'large'
  | 'hd720'
  | 'hd1080'
  | 'hd1440'
  | 'hd2160';

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Type guard para verificar si un objeto es una Song válida
 */
export function isSong(obj: any): obj is Song {
  return (
    obj &&
    typeof obj.id === 'string' &&
    obj.id.length === 11 &&
    typeof obj.title === 'string' &&
    typeof obj.created_at === 'string'
  );
}

/**
 * Valida que un video_id sea válido (11 caracteres alfanuméricos + - _)
 */
export function isValidVideoId(videoId: string): boolean {
  if (!videoId || typeof videoId !== 'string') return false;
  if (videoId.length !== 11) return false;

  const validPattern = /^[a-zA-Z0-9_-]{11}$/;
  return validPattern.test(videoId);
}

/**
 * Formatea duración de string a MM:SS
 */
export function formatDuration(duration: string | null): string {
  if (!duration) return '--:--';

  const totalSeconds = parseInt(duration, 10);
  if (isNaN(totalSeconds) || totalSeconds < 0) return '--:--';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Obtiene el thumbnail de mejor calidad disponible
 * ✅ SOPORTA AMBOS FORMATOS: string directo o {url, width, height}
 */
export function getBestThumbnail(
  thumbnails: ThumbnailsDict | null,
  fallback: string = '/assets/images/default-thumbnail.jpg'
): string {
  if (!thumbnails) return fallback;

  // Prioridades de calidad (de mejor a peor)
  const priorities: string[] = [
    'maxresdefault',
    'maxres',
    'sddefault',
    'standard',
    'high',
    'medium',
    'default'
  ];

  // Buscar por prioridad
  for (const priority of priorities) {
    const thumbnail = thumbnails[priority];
    
    if (!thumbnail) continue;
    
    // Caso 1: Es un string directo (formato actual del backend)
    if (typeof thumbnail === 'string') {
      return thumbnail.replace('http://', 'https://');
    }
    
    // Caso 2: Es un objeto con propiedad url
    if (typeof thumbnail === 'object' && 'url' in thumbnail && thumbnail.url) {
      return thumbnail.url.replace('http://', 'https://');
    }
  }

  // Buscar cualquier thumbnail disponible
  const keys = Object.keys(thumbnails);
  for (const key of keys) {
    const thumbnail = thumbnails[key];
    
    if (typeof thumbnail === 'string') {
      return thumbnail.replace('http://', 'https://');
    }
    
    if (typeof thumbnail === 'object' && 'url' in thumbnail && thumbnail.url) {
      return thumbnail.url.replace('http://', 'https://');
    }
  }

  return fallback;
}

/**
 * Detecta el tipo de canción basado en el título
 */
export function detectSongType(title: string): SongType {
  if (!title) return SongType.Unknown;

  const lowerTitle = title.toLowerCase();

  if (
    lowerTitle.includes('official video') ||
    lowerTitle.includes('official music video') ||
    lowerTitle.includes('(official)') ||
    lowerTitle.includes('[official')
  ) {
    return SongType.OfficialVideo;
  }

  if (
    lowerTitle.includes('live') ||
    lowerTitle.includes('en vivo') ||
    lowerTitle.includes('live performance') ||
    lowerTitle.includes('concert')
  ) {
    return SongType.Live;
  }

  if (lowerTitle.includes('cover')) {
    return SongType.Cover;
  }

  if (
    lowerTitle.includes('remix') ||
    lowerTitle.includes('mix') ||
    lowerTitle.includes('edit')
  ) {
    return SongType.Remix;
  }

  return SongType.AlbumTrack;
}

/**
 * Extrae el artista del channel_title (heurística simple)
 * Ej: "ArtistName - Topic" → "ArtistName"
 */
export function extractArtistFromChannel(channelTitle: string | null): string | null {
  if (!channelTitle) return null;

  const cleaned = channelTitle
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .trim();

  return cleaned || channelTitle;
}

/**
 * Compara dos canciones por ID
 */
export function isSameSong(song1: Song | null, song2: Song | null): boolean {
  if (!song1 || !song2) return false;
  return song1.id === song2.id;
}
import { Song } from '@interfaces'

/**
 * Estado del reproductor
 */
export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  videoId: string | null;
  volume: number;
  isMuted: boolean;
  error: string | null;
  currentSong: Song | null;
  isBuffering: boolean;
  quality: string;
}

/**
 * Opciones de reproducción
 */
export interface PlayOptions {
  autoplay?: boolean;
  startSeconds?: number;
  quality?: 'default' | 'small' | 'medium' | 'large' | 'hd720' | 'hd1080';
}

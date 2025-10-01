import { Component as LibComponent, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { PlayerService as LibPlayerService } from '../../services/player.service';
import { LibraryService } from '../../services/library.service';
import { LoggerService as LibLoggerService } from '../../services/core/logger.service';
import { Song as LibSong } from '../../models/song.model';
import { SongCardComponent as LibSongCardComponent } from '../../components/song-card/song-card.component';

@LibComponent({
  selector: 'app-library-page',
  standalone: true,
  imports: [CommonModule, LibSongCardComponent],
  templateUrl: './library-page.component.html',
  styleUrls: ['./library-page.component.scss'],
})
export class LibraryPageComponent implements OnInit, OnDestroy {
  private playerService = inject(LibPlayerService);
  private libraryService = inject(LibraryService);
  private logger = inject(LibLoggerService);
  private destroy$ = new Subject<void>();

  songs = signal<LibSong[]>([]);
  error = signal<string | null>(null);
  isLoading = signal<boolean>(false);

  ngOnInit(): void {
    this.loadLibrary();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga todas las canciones de la biblioteca
   */
  private loadLibrary(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.libraryService.getSavedSongs()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (songs) => {
          this.songs.set(songs);
          this.isLoading.set(false);
          this.logger.info(`Biblioteca cargada: ${songs.length} canciones`);
        },
        error: (err) => {
          this.logger.error('Error cargando biblioteca:', err);
          this.error.set('Error al cargar la biblioteca');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Reproduce una canción
   */
  onSongSelected(song: LibSong): void {
    if (!song?.videoId) {
      this.logger.error(`Canción sin videoId: ${song?.title}`);
      this.error.set('No se puede reproducir esta canción');
      return;
    }

    this.logger.info(`Reproduciendo desde biblioteca: ${song.title}`);
    this.playerService.loadVideo(song.videoId, 0, song);
  }

  /**
   * Elimina una canción de la biblioteca
   */
  removeSong(songId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    this.libraryService.removeSong(songId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const updated = this.songs().filter(s => s.id !== songId);
          this.songs.set(updated);
          this.logger.info('Canción eliminada de la biblioteca');
        },
        error: (err) => {
          this.logger.error('Error eliminando canción:', err);
          this.error.set('Error al eliminar la canción');
        },
      });
  }

  /**
   * TrackBy para optimizar renderizado
   */
  trackBySongId(index: number, song: LibSong): string {
    return song.id || index.toString();
  }
}
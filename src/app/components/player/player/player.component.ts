import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PlayerControlsComponent } from '../player-controls/player-controls.component';
import { PlayerProgressComponent } from '../player-progress/player-progress.component';
import { PlayerInfoComponent } from '../player-info/player-info.component';
import { YoutubePlayerService } from '../../../services/youtube-iframe.service';
import { YoutubeService } from '../../../services/youtube.service';
import { Song } from '../../../models/song.model';
import { LoggerService } from '../../../services/core/logger.service';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, FormsModule, PlayerControlsComponent, PlayerProgressComponent, PlayerInfoComponent],
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerComponent implements OnInit, OnDestroy {
  private youtubePlayerService = inject(YoutubePlayerService);
  private youtubeService = inject(YoutubeService);
  private logger = inject(LoggerService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  currentTrack: Song | null = null;
  isPlaying = false;
  currentTime = 0;
  duration = 0;
  volume = 1;
  error: string | null = null;
  searchQuery = '';

  ngOnInit(): void {
    this.youtubePlayerService.isPlaying$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isPlaying) => {
        this.isPlaying = isPlaying;
        this.cdr.markForCheck();
      });

    this.youtubePlayerService.currentTime$
      .pipe(takeUntil(this.destroy$))
      .subscribe((time) => {
        this.currentTime = time;
        this.cdr.markForCheck();
      });

    this.youtubePlayerService.duration$
      .pipe(takeUntil(this.destroy$))
      .subscribe((duration) => {
        this.duration = duration;
        this.cdr.markForCheck();
      });

    this.youtubePlayerService.currentSong$
      .pipe(takeUntil(this.destroy$))
      .subscribe((song) => {
        this.currentTrack = song;
        this.logger.info(`Actualizando pista en PlayerComponent: ${song?.title || 'Ninguna'}`);
        this.cdr.markForCheck();
      });

    this.youtubePlayerService.playerState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        if (state === 'error') {
          this.handleError('Error en el reproductor', new Error('Estado de error'));
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPlayPause(): void {
    if (this.isPlaying) {
      this.youtubePlayerService.pauseVideo();
    } else {
      if (this.currentTrack?.videoId) {
        this.youtubePlayerService.playVideo(this.currentTrack.videoId, undefined, this.currentTrack);
      } else {
        this.handleError('No hay pista seleccionada para reproducir', new Error('Sin videoId'));
      }
    }
    this.cdr.markForCheck();
  }

  onStop(): void {
    this.youtubePlayerService.stopVideo();
    this.isPlaying = false;
    this.cdr.markForCheck();
  }

  onPrevious(): void {
    this.handleError('Función previous no implementada', new Error('No implementado'));
  }

  onNext(): void {
    this.handleError('Función next no implementada', new Error('No implementado'));
  }

  onSeek(time: number): void {
    if (this.youtubePlayerService.isPlayerReady()) {
      this.youtubePlayerService.seekTo(time);
      this.currentTime = time;
      this.cdr.markForCheck();
    } else {
      this.handleError('Reproductor no listo para seek', new Error('Reproductor no inicializado'));
    }
  }

  onVolumeChange(volume: number): void {
    this.volume = volume;
    this.youtubePlayerService.setVolume(volume); // Usa el nuevo método
    this.cdr.markForCheck();
  }

  searchAndPlay(): void {
    if (!this.searchQuery.trim()) {
      this.handleError('Consulta de búsqueda vacía', new Error('No se proporcionó consulta'));
      return;
    }
    this.youtubePlayerService.searchAndPlay(this.searchQuery).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.logger.info(`Búsqueda y reproducción iniciada para: ${this.searchQuery}`);
      },
      error: (err) => this.handleError('Error al buscar y reproducir', err),
    });
  }

  private handleError(message: string, error: any): void {
    this.error = `${message}: ${error?.message || 'Error desconocido'}`;
    this.logger.error(this.error, error);
    this.cdr.markForCheck();
    setTimeout(() => {
      this.error = null;
      this.cdr.markForCheck();
    }, 5000);
  }
}
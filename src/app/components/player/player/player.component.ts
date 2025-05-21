import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { Subject, takeUntil } from "rxjs"
import { PlayerControlsComponent } from "../player-controls/player-controls.component"
import { PlayerProgressComponent } from "../player-progress/player-progress.component"
import { PlayerInfoComponent } from "../player-info/player-info.component"
import { AudioService } from "../../../services/audio.service"
import type { IAudioTrack } from "../../../models/audio-track.model"

@Component({
  selector: "app-player",
  standalone: true,
  imports: [CommonModule, FormsModule, PlayerControlsComponent, PlayerProgressComponent, PlayerInfoComponent],
  templateUrl: "./player.component.html",
  styleUrls: ["./player.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerComponent implements OnInit, OnDestroy {
  private audioService = inject(AudioService)
  private cdr = inject(ChangeDetectorRef)
  private destroy$ = new Subject<void>()

  currentTrack: IAudioTrack | null = null
  isPlaying = false
  currentTime = 0
  duration = 0
  volume = 1
  error: string | null = null

  ngOnInit(): void {
    // Suscribirse a los cambios de pista actual
    this.audioService.currentTrack$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (track) => {
        this.currentTrack = track
        this.cdr.markForCheck()
      },
      error: (err) => {
        this.handleError("Error al cargar la pista", err)
      },
    })

    // Suscribirse al estado de reproducción
    this.audioService.isPlaying$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (isPlaying) => {
        this.isPlaying = isPlaying
        this.cdr.markForCheck()
      },
      error: (err) => {
        this.handleError("Error en el estado de reproducción", err)
      },
    })

    // Suscribirse al tiempo actual
    this.audioService.currentTime$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (time) => {
        this.currentTime = time
        this.cdr.markForCheck()
      },
      error: (err) => {
        this.handleError("Error al actualizar el tiempo", err)
      },
    })

    // Suscribirse a la duración
    this.audioService.duration$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (duration) => {
        this.duration = duration
        this.cdr.markForCheck()
      },
      error: (err) => {
        this.handleError("Error al obtener la duración", err)
      },
    })

    // Suscribirse al volumen
    this.audioService.volume$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (volume) => {
        this.volume = volume
        this.cdr.markForCheck()
      },
      error: (err) => {
        this.handleError("Error al ajustar el volumen", err)
      },
    })
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  onPlayPause(): void {
    if (this.isPlaying) {
      this.audioService.pause()
    } else {
      this.audioService.play().catch((err) => {
        this.handleError("Error al reproducir", err)
      })
    }
  }

  onStop(): void {
    this.audioService.stop()
  }

  onPrevious(): void {
    this.audioService.previous().catch((err) => {
      this.handleError("Error al cambiar a la pista anterior", err)
    })
  }

  onNext(): void {
    this.audioService.next().catch((err) => {
      this.handleError("Error al cambiar a la siguiente pista", err)
    })
  }

  onSeek(time: number): void {
    this.audioService.seek(time).catch((err) => {
      this.handleError("Error al buscar posición", err)
    })
  }

  onVolumeChange(volume: number): void {
    this.audioService.setVolume(volume)
  }

  private handleError(message: string, error: any): void {
    console.error(message, error)
    this.error = `${message}: ${error?.message || "Error desconocido"}`
    this.cdr.markForCheck()

    // Limpiar el error después de 5 segundos
    setTimeout(() => {
      this.error = null
      this.cdr.markForCheck()
    }, 5000)
  }
}

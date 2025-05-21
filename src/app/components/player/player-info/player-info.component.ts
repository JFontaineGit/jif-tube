import { Component, Input, ChangeDetectionStrategy } from "@angular/core"
import { CommonModule } from "@angular/common"

import type { IAudioTrack } from "../../../models/audio-track.model"

@Component({
  selector: "app-player-info",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./player-info.component.html",
  styleUrls: ["./player-info.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerInfoComponent {
  @Input() currentTrack: IAudioTrack | null = null

  get trackTitle(): string {
    return this.currentTrack?.title || "Sin título"
  }

  get trackArtist(): string {
    return this.currentTrack?.artist || "Artista desconocido"
  }

  get trackThumbnail(): string {
    return this.currentTrack?.thumbnail || "/assets/images/default-thumbnail.jpg"
  }

  get trackViews(): string {
    if (!this.currentTrack?.views) {
      return ""
    }

    return this.formatViews(this.currentTrack.views)
  }

  get trackLikes(): string {
    if (!this.currentTrack?.likes) {
      return ""
    }

    return this.formatLikes(this.currentTrack.likes)
  }

  private formatViews(views: number): string {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M vistas`
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(0)}k vistas`
    } else {
      return `${views} vistas`
    }
  }

  private formatLikes(likes: number): string {
    if (likes >= 1000000) {
      return `${(likes / 1000000).toFixed(1)}M me gusta`
    } else if (likes >= 1000) {
      return `${(likes / 1000).toFixed(1)}K me gusta`
    } else {
      return `${likes} me gusta`
    }
  }
}

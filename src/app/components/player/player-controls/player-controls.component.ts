import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"

@Component({
  selector: "app-player-controls",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./player-controls.component.html",
  styleUrls: ["./player-controls.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerControlsComponent {
  @Input() isPlaying = false
  @Input() volume = 1

  @Output() playPause = new EventEmitter<void>()
  @Output() stop = new EventEmitter<void>()
  @Output() previous = new EventEmitter<void>()
  @Output() next = new EventEmitter<void>()
  @Output() volumeChange = new EventEmitter<number>()

  isVolumeVisible = false

  onVolumeIconClick(): void {
    this.isVolumeVisible = !this.isVolumeVisible
  }

  onVolumeChange(event: Event): void {
    const input = event.target as HTMLInputElement
    const value = Number.parseFloat(input.value)
    this.volumeChange.emit(value)
  }
}

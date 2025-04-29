import { Component, Input, Output, EventEmitter } from "@angular/core"
import type { Song } from "../../models/song.model"

@Component({
  selector: "app-song-card",
  standalone: true,
  templateUrl: "./song-card.component.html",
  styleUrls: ["./song-card.component.scss"],
})
export class SongCardComponent {
  @Input() song!: Song
  @Output() selected = new EventEmitter<Song>()

  selectSong(): void {
    this.selected.emit(this.song)
  }
}

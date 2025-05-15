// src/app/components/song-card/song-card.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Song } from '../../models/song.model';

@Component({
  selector: 'app-song-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-card.component.html',
  styleUrls: ['./song-card.component.scss'],
})
export class SongCardComponent {
  @Input() song!: Song;
  @Output() selected = new EventEmitter<Song>();

  get cardTypeClass(): string {
    return this.song.type; // Devuelve 'official-video' o 'album-track'
  }

  onSelect(): void {
    this.selected.emit(this.song);
  }
}
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Song } from '../../models/song.model';
import { LibraryService } from '../../services/library.service';

@Component({
  selector: 'app-song-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-card.component.html',
  styleUrls: ['./song-card.component.scss'],
})
export class SongCardComponent {
  @Input() song!: Song;
  @Input() showSaveButton: boolean = false;
  @Output() selected = new EventEmitter<Song>();
  @Output() save = new EventEmitter<Song>()

  savedSongs: Song[] = [];

  constructor (private libraryService: LibraryService) {}

  get cardTypeClass(): string {
    return this.song.type || 'album-track'; 
  }

  ngOnInit(): void{
    this.libraryService.getSavedSongs().subscribe(savedSongs => {
      this.savedSongs = savedSongs;
    });
  }

  onSelect(): void {
    this.selected.emit(this.song);
  }

  onSave(event: Event): void{
    event.stopPropagation(); 
    this.save.emit(this.song);
  }

  isSongSaved(): boolean{
    return this.savedSongs.some(savedSong => savedSong.id === this.song.id);
  }
}
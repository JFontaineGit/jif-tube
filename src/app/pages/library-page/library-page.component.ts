import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song } from '../../models/song.model';
import { SongCardComponent } from '../../components/song-card/song-card.component';
import { PlayerService } from '../../services/player.service';
import { LibraryService } from '../../services/library.service';

@Component({
  selector: 'app-library-page',
  standalone: true,
  imports: [CommonModule, SongCardComponent],
  templateUrl: './library-page.component.html',
  styleUrls: ['./library-page.component.scss'],
})
export class LibraryPageComponent implements OnInit {
  songs: Song[] = [];

  constructor(
    private playerService: PlayerService,
    private libraryService: LibraryService
  ) {}

  ngOnInit(): void {
    this.libraryService.getSavedSongs().subscribe(songs => {
      this.songs = songs;
    });
  }

  onSongSelected(song: Song): void {
    this.playerService.setSelectedSong(song);
  }

  removeSong(songId: string): void {
    this.libraryService.removeSong(songId).subscribe(() => {
      this.songs = this.songs.filter(song => song.id !== songId);
    });
  }
}
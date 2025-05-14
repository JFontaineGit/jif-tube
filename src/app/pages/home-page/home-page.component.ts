import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YoutubeService } from '../../services/youtube.service';
import { PlayerService } from '../../services/player.service';
import { Song } from '../../models/song.model';
import { SongCardComponent } from '../../components/song-card/song-card.component';
import { SearchButtonComponent } from '../../components/search-button/search-button.component'; // Importa el componente

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SongCardComponent, SearchButtonComponent], // Añade SearchButtonComponent
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
})
export class HomePageComponent implements OnInit {
  songs: Song[] = [];
  selectedSong: Song | null = null;

  constructor(private youtubeService: YoutubeService, private playerService: PlayerService) {}

  ngOnInit(): void {
    // Carga inicial con un término predeterminado
    this.searchSongs('popular music');
  }

  searchSongs(query: string): void {
    if (query.trim()) {
      this.youtubeService.searchVideos(query).subscribe((songs) => {
        this.songs = songs;
      });
    }
  }

  onSongSelected(song: Song): void {
    this.selectedSong = song;
    this.playerService.setSelectedSong(song);
  }
}
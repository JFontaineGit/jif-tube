// src/app/pages/home-page/home-page.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YoutubeService } from '../../services/youtube.service';
import { PlayerService } from '../../services/player.service';
import { Song } from '../../models/song.model';
import { SongCardComponent } from '../../components/song-card/song-card.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, SongCardComponent],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
})
export class HomePageComponent implements OnInit {
  songs: Song[] = [];
  selectedSong: Song | null = null;

  constructor(private youtubeService: YoutubeService, private playerService: PlayerService) {}

  ngOnInit(): void {
    this.youtubeService.getMockSongs().subscribe((songs) => {
      this.songs = songs;
    });
  }

  onSongSelected(song: Song): void {
    this.selectedSong = song;
    this.playerService.setSelectedSong(song);
  }
}
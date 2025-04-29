// src/app/components/layout/layout.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SearchButtonComponent } from '../search-button/search-button.component';
import { PlayerComponent } from '../player/player.component';
import { PlayerService } from '../../services/player.service';
import { Song } from '../../models/song.model';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, SearchButtonComponent, PlayerComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit {
  isPlayerVisible = false;
  currentSong: Song | null = null;

  constructor(private playerService: PlayerService) {}

  ngOnInit() {
    this.playerService.selectedSong$.subscribe((song) => {
      this.currentSong = song;
      this.isPlayerVisible = !!song;
    });
  }

  closePlayer(): void {
    this.playerService.setSelectedSong(null);
  }
}